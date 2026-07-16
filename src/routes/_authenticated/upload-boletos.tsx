import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ScanLine, Sparkles, History, Clock, Copy, Check, Eye, Send, Trash2, Building2, CheckCircle2, Pencil } from "lucide-react";
import { UploadArea } from "@/components/boletos/UploadArea";
import { ProcessingSteps } from "@/components/boletos/ProcessingSteps";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PaymentCodeCard } from "@/components/boletos/PaymentCodeCard";
import { DetailsCard } from "@/components/boletos/DetailsCard";
import { EditBoletoForm } from "@/components/boletos/EditBoletoForm";
import { ValidationBadge } from "@/components/boletos/ValidationBadge";
import { formatCurrencyBRL, formatDateBR } from "@/lib/boletos/format";
import { copiarCodigo } from "@/lib/boletos/normalize";
import type { StatusValidacao } from "@/lib/boletos/types";
import { toast } from "sonner";
import { processarBoleto, type StepId } from "@/lib/boletos/pipeline";

import { atualizarDadosBoleto, atualizarEmpresaBoleto, buscarDuplicado, confirmarAtualizacaoEEnviar, enviarParaPagamento, excluirBoleto, listarHistorico, salvarBoleto, type BoletoRow } from "@/lib/boletos/storage";
import type { BoletoData } from "@/lib/boletos/types";
import { supabase } from "@/integrations/supabase/client";
import type { EmpresaOption } from "@/components/boletos/BoletoUploadCard";
import { OverdueBoletoDialog } from "@/components/boletos/OverdueBoletoDialog";
import { boletoEstaVencido, preverAtualizacao } from "@/lib/boletos/overdue";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getEmpresasPermitidas } from "@/lib/empresas";


// No head() here: the home route inherits title/description/og/twitter from
// __root.tsx, and ships no og:image so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/_authenticated/upload-boletos")({
  component: Index,
});

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  recebido: { label: "Enviado — aguardando", variant: "secondary" },
  em_analise: { label: "Em análise", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
  pago: { label: "Pago", variant: "default" },
};

function Index() {
  const auth = useAuth();
  const [step, setStep] = useState<StepId | null>(null);
  const [processing, setProcessing] = useState(false);
  const [queue, setQueue] = useState<{ name: string; status: "processando" | "ok" | "erro"; msg?: string }[]>([]);
  const [history, setHistory] = useState<BoletoRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);

  const refreshHistory = useCallback(async () => {
    const h = await listarHistorico(200);
    setHistory(h);
  }, []);

  useEffect(() => {
    refreshHistory();
    supabase
      .from("empresas")
      .select("id,nome,matriz_id,ativo")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        const todas = (data ?? []) as (EmpresaOption & { ativo: boolean })[];
        const permitidas = getEmpresasPermitidas(
          auth.role,
          auth.profile ? { empresa_id: auth.profile.empresa_id, empresa_matriz_id: auth.profile.empresa_matriz_id } : null,
          todas,
        );
        setEmpresas(permitidas as EmpresaOption[]);
      });
    const ch = supabase
      .channel("boletos-upload")
      .on("postgres_changes", { event: "*", schema: "public", table: "boletos" }, () => {
        refreshHistory();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refreshHistory, auth.role, auth.profile?.empresa_id, auth.profile?.empresa_matriz_id]);

  const handleFile = useCallback(
    async (picked: File) => {
      setError(null);
      setProcessing(true);
      setStep("preparar");
      setQueue((q) => [...q, { name: picked.name, status: "processando" }]);
      try {
        const { data } = await processarBoleto({ file: picked, onProgress: (p) => setStep(p.step) });
        const dup = await buscarDuplicado(data.codigo_barras.valor, data.linha_digitavel.valor);
        if (dup) toast.warning(`${picked.name}: boleto já lido anteriormente.`);
        const row = await salvarBoleto(picked, data);
        setQueue((q) => q.map((x) => (x.name === picked.name && x.status === "processando" ? { ...x, status: row ? "ok" : "erro", msg: row ? undefined : "Falha ao salvar" } : x)));
        await refreshHistory();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro desconhecido.";
        setError(msg);
        setQueue((q) => q.map((x) => (x.name === picked.name && x.status === "processando" ? { ...x, status: "erro", msg } : x)));
      } finally {
        setProcessing(false);
        setStep(null);
      }
    },
    [refreshHistory],
  );

  const deleteHistoric = async (row: BoletoRow) => {
    await excluirBoleto(row.id);
    toast.success("Boleto removido do histórico.");
    refreshHistory();
  };

  const [overdueRow, setOverdueRow] = useState<BoletoRow | null>(null);

  const enviar = async (row: BoletoRow) => {
    if (!row.empresa_id) return toast.error("Selecione a empresa antes de enviar.");
    if (boletoEstaVencido(row.vencimento) && !row.dados_json?.atualizacao?.aplicada) {
      setOverdueRow(row);
      return;
    }
    const r = await enviarParaPagamento(row.id);
    if (!r.ok) return toast.error(r.error ?? "Falha ao enviar");
    toast.success("Boleto enviado para pagamento");
    refreshHistory();
  };

  const enviarTodos = async () => {
    const pendentes = history.filter((h) => h.status === "rascunho" && h.empresa_id);
    const semEmpresa = history.filter((h) => h.status === "rascunho" && !h.empresa_id).length;
    const vencidosSemCalculo = pendentes.filter(
      (h) => boletoEstaVencido(h.vencimento) && !h.dados_json?.atualizacao?.aplicada,
    );
    if (semEmpresa > 0) toast.warning(`${semEmpresa} boleto(s) sem empresa foram ignorados.`);
    if (vencidosSemCalculo.length > 0) {
      toast.warning(`${vencidosSemCalculo.length} boleto(s) vencido(s) precisam do cálculo — envie individualmente.`);
    }
    const enviar = pendentes.filter((h) => !boletoEstaVencido(h.vencimento) || h.dados_json?.atualizacao?.aplicada);
    if (enviar.length === 0) return;
    for (const r of enviar) await enviarParaPagamento(r.id);
    toast.success(`${enviar.length} boleto(s) enviados para pagamento`);
    refreshHistory();
  };


  const aguardando = useMemo(() => history.filter((h) => h.status === "rascunho"), [history]);
  const enviados = useMemo(() => history.filter((h) => h.status !== "rascunho"), [history]);
  const pendentesCount = aguardando.filter((h) => h.empresa_id).length;

  const handleEmpresa = async (row: BoletoRow, empresaId: string | null) => {
    const r = await atualizarEmpresaBoleto(row.id, empresaId);
    if (!r.ok) return toast.error(r.error ?? "Falha ao atualizar empresa");
    refreshHistory();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b border-border/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight text-foreground">Upload de Boletos</h1>
              <p className="text-xs text-muted-foreground">Envie um ou mais boletos e clique em Enviar para pagamento</p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 sm:flex">
            <Sparkles className="h-3.5 w-3.5" /> Powered by IA
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <section aria-label="Upload">
          <UploadArea onFile={handleFile} disabled={false} multiple />
        </section>

        {processing && (
          <section className="mt-6">
            <ProcessingSteps current={step} />
          </section>
        )}

        {queue.length > 0 && (
          <section className="mt-6 space-y-1 rounded-2xl border border-border bg-card p-3 text-sm">
            {queue.map((q, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">{q.name}</span>
                <span className={q.status === "erro" ? "text-destructive text-xs" : q.status === "ok" ? "text-emerald-600 text-xs" : "text-muted-foreground text-xs"}>
                  {q.status === "processando" ? "Processando…" : q.status === "ok" ? "Lido" : `Erro: ${q.msg}`}
                </span>
              </div>
            ))}
          </section>
        )}

        {error && !processing && (
          <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-800">Não foi possível ler o boleto</p>
                <p className="mt-1 text-xs text-red-700">{error}</p>
                <p className="mt-2 text-xs text-red-700">
                  Dicas: envie a página com o código de barras visível, sem cortes, com boa iluminação e foco. Prefira o PDF original se você tiver.
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-foreground">Aguardando envio</h2>
              <Badge variant="outline" className="ml-1">{aguardando.length}</Badge>
            </div>
            {pendentesCount > 0 && (
              <Button size="sm" onClick={enviarTodos}>
                <Send className="mr-1.5 h-4 w-4" /> Enviar {pendentesCount} para pagamento
              </Button>
            )}
          </div>
          <BoletosTable
            rows={aguardando}
            empty="Nenhum boleto aguardando envio."
            mode="aguardando"
            empresas={empresas}
            onSend={enviar}
            onDelete={deleteHistoric}
            onEmpresaChange={handleEmpresa}
          />
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">Histórico de envios</h2>
            <Badge variant="outline" className="ml-1">{enviados.length}</Badge>
          </div>
          <BoletosTable
            rows={enviados}
            empty="Nenhum boleto enviado ainda."
            mode="enviados"
            empresas={empresas}
          />
        </section>

        <footer className="mt-12 border-t border-border/60 pt-6 text-center text-xs text-muted-foreground">
          <p>
            Os arquivos ficam armazenados de forma privada nesta sessão. Este app não substitui a
            conferência final feita pelo pagador — sempre verifique valor e vencimento antes de pagar.
          </p>
        </footer>
      </main>

      <OverdueBoletoDialog
        row={overdueRow}
        open={!!overdueRow}
        onOpenChange={(o) => !o && setOverdueRow(null)}
        onConfirm={async ({ valorAtualizado, memoria, origem }) => {
          if (!overdueRow?.dados_json) return;
          const r = await confirmarAtualizacaoEEnviar(overdueRow.id, overdueRow.dados_json, valorAtualizado, memoria, origem);
          if (!r.ok) {
            toast.error(r.error ?? "Falha ao enviar");
            return;
          }
          toast.success(`Boleto atualizado (R$ ${valorAtualizado.toFixed(2).replace(".", ",")}) e enviado para pagamento`);
          setOverdueRow(null);
          refreshHistory();
        }}

      />
    </div>
  );
}


interface TableProps {
  rows: BoletoRow[];
  empty: string;
  mode: "aguardando" | "enviados";
  empresas: EmpresaOption[];
  onSend?: (row: BoletoRow) => void;
  onDelete?: (row: BoletoRow) => void;
  onEmpresaChange?: (row: BoletoRow, empresaId: string | null) => void;
}

function BoletosTable({ rows, empty, mode, empresas, onSend, onDelete, onEmpresaChange }: TableProps) {
  const [detailRow, setDetailRow] = useState<BoletoRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const copy = async (row: BoletoRow) => {
    const linha = row.dados_json?.linha_digitavel?.valor;
    if (!linha) return toast.error("Linha digitável não identificada");
    try {
      await copiarCodigo(linha);
      setCopiedId(row.id);
      toast.success("Código copiado!");
      setTimeout(() => setCopiedId((c) => (c === row.id ? null : c)), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    );
  }

  const empresasSorted = [...empresas].sort(
    (a, b) => (a.matriz_id ? 1 : 0) - (b.matriz_id ? 1 : 0) || a.nome.localeCompare(b.nome),
  );

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div>
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-[26%] px-3 py-2.5 text-left font-medium">Beneficiário</th>
                <th className="w-[20%] px-3 py-2.5 text-left font-medium">Empresa</th>
                <th className="w-[11%] px-3 py-2.5 text-left font-medium">Vencimento</th>
                <th className="w-[11%] px-3 py-2.5 text-right font-medium">Valor</th>
                <th className="w-[14%] px-3 py-2.5 text-left font-medium">Status</th>
                <th className="w-[18%] px-3 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const statusMeta = row.status ? STATUS_LABEL[row.status] : undefined;
                const empresaNome = empresas.find((e) => e.id === row.empresa_id)?.nome ?? null;
                const isPago = row.status === "pago";
                const isLocked = ["aprovado", "rejeitado", "pago"].includes(row.status ?? "");
                const linhaDig = row.dados_json?.linha_digitavel?.valor ?? null;
                const preview = mode === "aguardando" ? preverAtualizacao(row) : null;
                const jaAtualizado = row.dados_json?.atualizacao?.aplicada === true;
                const vencido = boletoEstaVencido(row.vencimento);
                return (
                  <tr
                    key={row.id}
                    className={
                      isPago
                        ? "bg-emerald-50/40"
                        : vencido && mode === "aguardando"
                          ? "bg-amber-50/60 hover:bg-amber-50"
                          : "hover:bg-muted/20"
                    }
                  >
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex items-center gap-2">
                        {isPago && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium text-foreground">
                            {row.beneficiario_nome ?? row.banco_nome ?? row.arquivo_nome ?? "Boleto"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{row.banco_nome ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      {mode === "aguardando" && onEmpresaChange ? (
                        <select
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                          value={row.empresa_id ?? ""}
                          onChange={(e) => onEmpresaChange(row, e.target.value || null)}
                        >
                          <option value="">— selecionar —</option>
                          {empresasSorted.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.matriz_id ? `↳ ${emp.nome}` : emp.nome}
                            </option>
                          ))}
                        </select>
                      ) : empresaNome ? (
                        <span className="inline-flex items-center gap-1 text-xs text-foreground">
                          <Building2 className="h-3 w-3 text-muted-foreground" /> {empresaNome}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground">
                      {formatDateBR(row.vencimento)}
                      {vencido && mode === "aguardando" && (
                        <div className="mt-0.5 text-[10px] font-medium text-amber-700">
                          Vencido — {preview?.calculo.dias_atraso ?? 0} dia(s)
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                      <div>{formatCurrencyBRL(row.valor_cobrado ?? row.valor_documento)}</div>
                      {mode === "aguardando" && vencido && !jaAtualizado && preview && (
                        <div
                          className={`text-[10px] font-normal ${preview.temRegras ? "text-amber-700" : "text-muted-foreground"}`}
                          title={
                            preview.temRegras
                              ? "Valor estimado com juros e multa das instruções do boleto"
                              : "Juros/multa não identificados — informe no envio"
                          }
                        >
                          {preview.temRegras
                            ? `(${formatCurrencyBRL(preview.calculo.valor_atualizado)} c/ juros)`
                            : "(informar juros/multa)"}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {statusMeta ? <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge> : null}
                        {mode === "aguardando" && vencido && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                            Vencido
                          </Badge>
                        )}
                        <ValidationBadge
                          status={(row.status_validacao as StatusValidacao | null) ?? "nao_identificado"}
                          size="sm"
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2.5 align-top">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copy(row)} disabled={!linhaDig} title="Copiar linha digitável">
                          {copiedId === row.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDetailRow(row)} disabled={!row.dados_json} title="Ver detalhes">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {mode === "aguardando" && onSend && (
                          <Button
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onSend(row)}
                            disabled={!row.empresa_id}
                            title={row.empresa_id ? "Enviar para pagamento" : "Selecione a empresa"}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {onDelete && !isLocked && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Excluir">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir envio</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Deseja realmente apagar o envio desse boleto? Essa ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onDelete(row)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do boleto</DialogTitle>
          </DialogHeader>
          {detailRow?.dados_json && (
            <div className="space-y-4">
              {editing && detailRow.status === "rascunho" ? (
                <EditBoletoForm
                  data={detailRow.dados_json}
                  onCancel={() => setEditing(false)}
                  onSave={async (next: BoletoData) => {
                    const r = await atualizarDadosBoleto(detailRow.id, next);
                    if (!r.ok) {
                      toast.error(r.error ?? "Falha ao salvar");
                      return;
                    }
                    toast.success("Boleto atualizado");
                    setEditing(false);
                    setDetailRow((d) => (d ? { ...d, dados_json: next, vencimento: next.vencimento, valor_cobrado: next.valor_cobrado, valor_documento: next.valor_documento, beneficiario_nome: next.beneficiario.nome } : d));
                  }}
                />
              ) : (
                <>
                  {detailRow.status === "rascunho" && (
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        <Pencil className="mr-1.5 h-4 w-4" /> Editar documento
                      </Button>
                    </div>
                  )}
                  <PaymentCodeCard data={detailRow.dados_json} />
                  <DetailsCard data={detailRow.dados_json} />
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
