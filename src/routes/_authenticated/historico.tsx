import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  listarHistorico,
  excluirBoleto,
  enviarParaPagamento,
  assinarArquivo,
  type BoletoRow,
} from "@/lib/boletos/storage";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { boletoEstaVencido } from "@/lib/boletos/overdue";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { PaymentCodeCard } from "@/components/boletos/PaymentCodeCard";
import { DetailsCard } from "@/components/boletos/DetailsCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History, Paperclip, X, Eye, Send, Trash2, Copy, Check } from "lucide-react";
import { copiarCodigo } from "@/lib/boletos/normalize";
import { formatCurrencyBRL, formatDateBR } from "@/lib/boletos/format";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({ meta: [{ title: "Histórico — Federal Invest" }] }),
  component: HistoricoPage,
});

const STATUS = ["rascunho", "recebido", "em_analise", "aprovado", "rejeitado", "pago"] as const;
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  recebido: "Enviado",
  em_analise: "Em análise",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  pago: "Pago",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  rascunho: "outline",
  recebido: "secondary",
  em_analise: "secondary",
  aprovado: "default",
  rejeitado: "destructive",
  pago: "default",
};

function HistoricoPage() {
  const auth = useAuth();
  const [rows, setRows] = useState<BoletoRow[]>([]);
  const [empresaMap, setEmpresaMap] = useState<Map<string, string>>(new Map());
  const [beneficiario, setBeneficiario] = useState("");
  const [valorMin, setValorMin] = useState("");
  const [valorMax, setValorMax] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [dataEnvio, setDataEnvio] = useState("");
  const [anexoF, setAnexoF] = useState<"all" | "com" | "sem">("all");
  const [statusF, setStatusF] = useState<string>("all");
  const [detailsRow, setDetailsRow] = useState<BoletoRow | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = () => listarHistorico(500).then(setRows);
  useEffect(() => {
    refresh();
    supabase
      .from("empresas")
      .select("id,nome")
      .then(({ data }) => setEmpresaMap(new Map((data ?? []).map((e) => [e.id as string, e.nome as string]))));
  }, []);

  useEffect(() => {
    const uid = auth.user?.id;
    if (!uid) return;
    const channel = supabase
      .channel(`boletos-user-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "boletos", filter: `usuario_envio_id=eq.${uid}` },
        (payload) => {
          const oldStatus = (payload.old as { status?: string })?.status;
          const newStatus = (payload.new as { status?: string })?.status;
          if (newStatus && oldStatus !== newStatus) {
            const msg: Record<string, string> = {
              aprovado: "Um boleto seu foi aprovado pela Federal Invest.",
              rejeitado: "Um boleto seu foi rejeitado pela Federal Invest.",
              pago: "Um boleto seu foi marcado como PAGO pela Federal Invest.",
              em_analise: "Um boleto seu entrou em análise.",
            };
            if (msg[newStatus]) toast.info(msg[newStatus]);
          }
          refresh();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [auth.user?.id]);

  const enviar = async (r: BoletoRow) => {
    const res = await enviarParaPagamento(r.id);
    if (!res.ok) return toast.error(res.error ?? "Falha ao enviar");
    toast.success("Boleto enviado para pagamento");
    refresh();
  };

  const excluir = async (r: BoletoRow) => {
    await excluirBoleto(r.id);
    toast.success("Boleto removido do histórico.");
    refresh();
  };

  const copiarLinha = async (r: BoletoRow) => {
    const linha = r.dados_json?.linha_digitavel?.valor;
    if (!linha) return toast.error("Linha digitável não identificada");
    try {
      await copiarCodigo(linha);
      setCopiedId(r.id);
      toast.success("Código copiado!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const limparFiltros = () => {
    setBeneficiario("");
    setValorMin("");
    setValorMax("");
    setVencimento("");
    setDataEnvio("");
    setAnexoF("all");
    setStatusF("all");
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusF !== "all" && (r.status ?? "") !== statusF) return false;
      if (beneficiario && !(r.beneficiario_nome ?? "").toLowerCase().includes(beneficiario.toLowerCase())) return false;
      const valor = Number(r.valor_cobrado ?? r.valor_documento ?? 0);
      if (valorMin && valor < Number(valorMin.replace(",", "."))) return false;
      if (valorMax && valor > Number(valorMax.replace(",", "."))) return false;
      if (vencimento && (r.vencimento ?? "").slice(0, 10) !== vencimento) return false;
      if (dataEnvio) {
        const ref = (r.data_envio ?? r.criado_em ?? "").slice(0, 10);
        if (ref !== dataEnvio) return false;
      }
      if (anexoF === "com" && !r.arquivo_url) return false;
      if (anexoF === "sem" && r.arquivo_url) return false;
      return true;
    });
  }, [rows, beneficiario, valorMin, valorMax, vencimento, dataEnvio, anexoF, statusF]);

  const abrirAnexo = async (r: BoletoRow) => {
    if (!r.arquivo_url) return toast.error("Sem anexo disponível");
    const url = await assinarArquivo(r.arquivo_url, 600);
    if (!url) return toast.error("Falha ao abrir anexo");
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">Histórico de Envios</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Controle dos boletos enviados. Filtre por beneficiário, valor, vencimento, anexo, data de envio ou status.
      </p>

      <div className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Beneficiário</label>
          <Input placeholder="Nome do beneficiário" value={beneficiario} onChange={(e) => setBeneficiario(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Valor (R$)</label>
          <div className="flex gap-2">
            <Input placeholder="Mín." value={valorMin} onChange={(e) => setValorMin(e.target.value)} inputMode="decimal" />
            <Input placeholder="Máx." value={valorMax} onChange={(e) => setValorMax(e.target.value)} inputMode="decimal" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Vencimento</label>
          <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Data de envio</label>
          <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Anexo</label>
          <Select value={anexoF} onValueChange={(v) => setAnexoF(v as typeof anexoF)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="com">Com anexo</SelectItem>
              <SelectItem value="sem">Sem anexo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {STATUS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
          <Button variant="outline" size="sm" onClick={limparFiltros}>
            <X className="mr-1 h-4 w-4" /> Limpar filtros
          </Button>
          <span className="text-xs text-muted-foreground">
            {filtered.length} de {rows.length} boleto(s)
          </span>
        </div>
      </div>

      <div className="mt-6">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
            <p className="text-sm text-muted-foreground">Nenhum boleto encontrado com os filtros atuais.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">Beneficiário</th>
                  <th className="px-4 py-2 text-left">Empresa</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2 text-left">Vencimento</th>
                  <th className="px-4 py-2 text-left">Data envio</th>
                  <th className="px-4 py-2 text-left">Anexo</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const locked = ["aprovado", "rejeitado", "pago"].includes(r.status ?? "");
                  const vencido = boletoEstaVencido(r.vencimento);
                  const atualizado = r.dados_json?.atualizacao?.aplicada === true;
                  const valorOriginal = r.dados_json?.atualizacao?.valor_original ?? r.valor_documento;
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-border"
                      style={vencido ? { backgroundColor: "#FFF8DB", borderLeft: "4px solid #FACC15" } : undefined}
                    >
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span>{r.beneficiario_nome ?? r.banco_nome ?? "—"}</span>
                          {vencido && (
                            <Badge className="border-amber-400 bg-amber-100 text-amber-900 hover:bg-amber-100" variant="outline">
                              Vencido
                            </Badge>
                          )}
                          {atualizado && (
                            <Badge className="border-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-50" variant="outline">
                              Atualizado com juros/multa
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{r.empresa_id ? (empresaMap.get(r.empresa_id) ?? "—") : "—"}</td>
                      <td className="px-4 py-2 text-right">
                        {atualizado ? (
                          <div className="flex flex-col items-end leading-tight">
                            <span className="text-xs text-muted-foreground line-through">
                              {formatCurrencyBRL(valorOriginal)}
                            </span>
                            <span className="font-medium">{formatCurrencyBRL(r.valor_cobrado)}</span>
                          </div>
                        ) : (
                          formatCurrencyBRL(r.valor_cobrado ?? r.valor_documento)
                        )}
                      </td>
                      <td className="px-4 py-2">{formatDateBR(r.vencimento)}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {r.data_envio ? new Date(r.data_envio).toLocaleString("pt-BR") : new Date(r.criado_em).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2">
                        {r.arquivo_url ? (
                          <Button size="sm" variant="ghost" onClick={() => abrirAnexo(r)}>
                            <Paperclip className="mr-1 h-3.5 w-3.5" /> Ver
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={STATUS_VARIANT[r.status ?? ""] ?? "outline"}>
                          {STATUS_LABEL[r.status ?? ""] ?? r.status ?? "—"}
                        </Badge>
                      </td>

                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button size="sm" variant="outline" onClick={() => copiarLinha(r)} disabled={!r.dados_json?.linha_digitavel?.valor}>
                            {copiedId === r.id ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
                            Copiar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDetailsRow(r)} disabled={!r.dados_json}>
                            <Eye className="mr-1 h-3.5 w-3.5" /> Detalhes
                          </Button>
                          {r.status === "rascunho" && (
                            <Button size="sm" onClick={() => enviar(r)}>
                              <Send className="mr-1 h-3.5 w-3.5" /> Enviar
                            </Button>
                          )}
                          {!locked && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" aria-label="Excluir">
                                  <Trash2 className="h-3.5 w-3.5" />
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
                                    onClick={() => excluir(r)}
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
        )}
      </div>

      <Dialog open={!!detailsRow} onOpenChange={(o) => !o && setDetailsRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do boleto</DialogTitle>
          </DialogHeader>
          {detailsRow?.dados_json && (
            <div className="space-y-4">
              <PaymentCodeCard data={detailsRow.dados_json} />
              <DetailsCard data={detailsRow.dados_json} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}