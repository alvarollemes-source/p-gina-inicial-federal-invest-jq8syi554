import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrencyBRL } from "@/lib/boletos/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/AuthProvider";
import { assinarArquivo } from "@/lib/boletos/storage";
import { Paperclip, Check, X as XIcon, DollarSign, Eye, FileSpreadsheet } from "lucide-react";
import { exportarPagamentosAP } from "@/lib/boletos/export-ap";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { PaymentCodeCard } from "@/components/boletos/PaymentCodeCard";
import { DetailsCard } from "@/components/boletos/DetailsCard";
import type { BoletoData } from "@/lib/boletos/types";
import { boletoEstaVencido } from "@/lib/boletos/overdue";

export const Route = createFileRoute("/_authenticated/boletos-recebidos")({
  head: () => ({ meta: [{ title: "Pagamentos Recebidos — Federal Invest" }] }),
  component: BoletosRecebidosPage,
});

const STATUS = ["recebido", "em_analise", "aprovado", "rejeitado", "pago"] as const;
type Status = (typeof STATUS)[number];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  recebido: "secondary",
  em_analise: "secondary",
  aprovado: "default",
  rejeitado: "destructive",
  pago: "default",
};

const TIPO_LABEL: Record<string, string> = {
  boleto: "Boleto",
  pix: "PIX",
  transferencia: "Transferência",
  debito_veiculo: "Débito veículo",
};

type Boleto = {
  id: string;
  beneficiario_nome: string | null;
  pagador_nome: string | null;
  valor_cobrado: number | null;
  valor_documento: number | null;
  vencimento: string | null;
  status: string;
  status_validacao: string | null;
  empresa_id: string | null;
  usuario_envio_id: string | null;
  data_envio: string | null;
  criado_em: string;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  dados_json: BoletoData | null;
  tipo_pagamento: string | null;
  dados_pagamento: Record<string, unknown> | null;
  operador_nome?: string | null;
  operador_email?: string | null;
  empresa_nome?: string | null;
};

const formatBRT = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

function BoletosRecebidosPage() {
  const auth = useAuth();
  const [rows, setRows] = useState<Boleto[]>([]);
  const [filter, setFilter] = useState("");
  const [statusF, setStatusF] = useState<string>("all");
  const [operadorF, setOperadorF] = useState<string>("all");
  const [empresaF, setEmpresaF] = useState<string>("all");
  const [tipoF, setTipoF] = useState<string>("all");
  const [beneficiarioF, setBeneficiarioF] = useState<string>("");
  const [dataIni, setDataIni] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  const [detailsRow, setDetailsRow] = useState<Boleto | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canManage = auth.isFederal;

  const refresh = async () => {
    const { data } = await supabase
      .from("boletos")
      .select("id,beneficiario_nome,pagador_nome,valor_cobrado,valor_documento,vencimento,status,status_validacao,empresa_id,usuario_envio_id,data_envio,criado_em,arquivo_url,arquivo_nome,dados_json,tipo_pagamento,dados_pagamento")
      .neq("status", "rascunho")
      .order("criado_em", { ascending: false })
      .limit(500);
    const base = (data ?? []) as Boleto[];
    const userIds = Array.from(new Set(base.map((b) => b.usuario_envio_id).filter(Boolean))) as string[];
    const empIds = Array.from(new Set(base.map((b) => b.empresa_id).filter(Boolean))) as string[];
    const [profsRes, empsRes] = await Promise.all([
      userIds.length ? supabase.from("profiles").select("id,nome,email").in("id", userIds) : Promise.resolve({ data: [] as { id: string; nome: string | null; email: string | null }[] }),
      empIds.length ? supabase.from("empresas").select("id,nome").in("id", empIds) : Promise.resolve({ data: [] as { id: string; nome: string | null }[] }),
    ]);
    const pMap = new Map((profsRes.data ?? []).map((p) => [p.id, p]));
    const eMap = new Map((empsRes.data ?? []).map((e) => [e.id, e]));
    setRows(
      base.map((b) => ({
        ...b,
        operador_nome: b.usuario_envio_id ? pMap.get(b.usuario_envio_id)?.nome ?? null : null,
        operador_email: b.usuario_envio_id ? pMap.get(b.usuario_envio_id)?.email ?? null : null,
        empresa_nome: b.empresa_id ? eMap.get(b.empresa_id)?.nome ?? null : null,
      })),
    );
  };
  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("boletos-recebidos")
      .on("postgres_changes", { event: "*", schema: "public", table: "boletos" }, () => {
        refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusF !== "all" && r.status !== statusF) return false;
      if (operadorF !== "all" && r.usuario_envio_id !== operadorF) return false;
      if (empresaF !== "all" && r.empresa_id !== empresaF) return false;
      if (tipoF !== "all" && (r.tipo_pagamento ?? "boleto") !== tipoF) return false;
      if (beneficiarioF && !(r.beneficiario_nome ?? "").toLowerCase().includes(beneficiarioF.toLowerCase())) return false;
      const ref = r.data_envio ?? r.criado_em;
      if (dataIni && (!ref || ref < dataIni)) return false;
      if (dataFim && (!ref || ref > `${dataFim}T23:59:59`)) return false;
      if (filter && !`${r.beneficiario_nome ?? ""} ${r.pagador_nome ?? ""} ${r.operador_nome ?? ""} ${r.empresa_nome ?? ""}`.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [rows, filter, statusF, operadorF, empresaF, tipoF, beneficiarioF, dataIni, dataFim]);

  const operadoresOpts = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.usuario_envio_id) map.set(r.usuario_envio_id, r.operador_nome ?? r.operador_email ?? r.usuario_envio_id);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const empresasOpts = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => {
      if (r.empresa_id) map.set(r.empresa_id, r.empresa_nome ?? r.empresa_id);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [filter, statusF, operadorF, empresaF, tipoF, beneficiarioF, dataIni, dataFim, pageSize]);

  const updateStatus = async (id: string, novo: Status, atual: string) => {
    const target: string = atual === novo ? "recebido" : novo;
    const { error } = await supabase.from("boletos").update({ status: target }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(atual === novo ? "Ação desfeita" : "Status atualizado");
    refresh();
  };

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelAll = (ids: string[], all: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (all) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const bulkUpdate = async (novo: Status) => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    const { error } = await supabase.from("boletos").update({ status: novo }).in("id", ids);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} boleto(s) marcados como ${novo}`);
    setSelected(new Set());
    refresh();
  };

  const abrirAnexo = async (path: string | null) => {
    if (!path) return toast.error("Arquivo não disponível");
    const url = await assinarArquivo(path, 600);
    if (!url) return toast.error("Falha ao abrir anexo");
    window.open(url, "_blank", "noopener");
  };

  const selectedRows = filtered.filter((r) => selected.has(r.id));
  const selectedSum = selectedRows.reduce((acc, r) => acc + Number(r.valor_cobrado ?? r.valor_documento ?? 0), 0);
  const visibleIds = paged.map((r) => r.id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pagamentos Recebidos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Análise de todos os pagamentos (boleto, PIX, transferência e débitos de veículo) enviados por operadores.</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (selectedRows.length === 0) return toast.error("Nenhum pagamento selecionado para exportação.");
            const dedup = Array.from(new Map(selectedRows.map((r) => [r.id, r])).values());
            exportarPagamentosAP(dedup);
            toast.success("Exportação gerada com sucesso.");
          }}
        >
          <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Exportar Excel AP
        </Button>
      </div>


      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input placeholder="Buscar geral…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <Input placeholder="Beneficiário" value={beneficiarioF} onChange={(e) => setBeneficiarioF(e.target.value)} />
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={operadorF} onValueChange={setOperadorF}>
          <SelectTrigger><SelectValue placeholder="Operador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os operadores</SelectItem>
            {operadoresOpts.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={empresaF} onValueChange={setEmpresaF}>
          <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {empresasOpts.map(([id, nome]) => <SelectItem key={id} value={id}>{nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={tipoF} onValueChange={setTipoF}>
          <SelectTrigger><SelectValue placeholder="Tipo de pagamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="boleto">Boleto</SelectItem>
            <SelectItem value="pix">PIX</SelectItem>
            <SelectItem value="transferencia">Transferência</SelectItem>
            <SelectItem value="debito_veiculo">Débito de veículo</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground shrink-0">De</label>
          <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground shrink-0">Até</label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
        <div className="flex items-center justify-end gap-2 lg:col-span-1">
          <Button variant="ghost" size="sm" onClick={() => { setFilter(""); setBeneficiarioF(""); setStatusF("all"); setOperadorF("all"); setEmpresaF("all"); setTipoF("all"); setDataIni(""); setDataFim(""); }}>Limpar filtros</Button>
        </div>
      </div>

      {canManage && selected.size > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="text-sm">
            <span className="font-semibold">{selected.size}</span> selecionado(s) — Soma:{" "}
            <span className="font-semibold text-primary">{formatCurrencyBRL(selectedSum)}</span>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkUpdate("aprovado")}>
              <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulkUpdate("rejeitado")}>
              <XIcon className="mr-1 h-3.5 w-3.5" /> Rejeitar
            </Button>
            <Button size="sm" onClick={() => bulkUpdate("pago")}>
              <DollarSign className="mr-1 h-3.5 w-3.5" /> Marcar pagos
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpar</Button>
          </div>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              {canManage && (
                <th className="px-3 py-2 text-left">
                  <Checkbox checked={allSelected} onCheckedChange={() => toggleSelAll(visibleIds, allSelected)} aria-label="Selecionar todos" />
                </th>
              )}
              <th className="px-4 py-2 text-left">Operador</th>
              <th className="px-4 py-2 text-left">Empresa</th>
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-left">Enviado em</th>
              <th className="px-4 py-2 text-left">Beneficiário</th>
              <th className="px-4 py-2 text-right">Valor</th>
              <th className="px-4 py-2 text-left">Vencimento</th>
              <th className="px-4 py-2 text-left">Anexo</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Detalhes</th>
              {canManage && <th className="px-4 py-2 text-left">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {paged.map((b) => {
              const vencido = boletoEstaVencido(b.vencimento);
              const atualizado = b.dados_json?.atualizacao?.aplicada === true;
              const valorOriginal = b.dados_json?.atualizacao?.valor_original ?? b.valor_documento;
              return (
              <tr
                key={b.id}
                className={`border-t border-border ${selected.has(b.id) ? "bg-primary/5" : ""}`}
                style={vencido ? { backgroundColor: "#FFF8DB", borderLeft: "4px solid #FACC15" } : undefined}
              >
                {canManage && (
                  <td className="px-3 py-2">
                    <Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggleSel(b.id)} aria-label="Selecionar boleto" />
                  </td>
                )}
                <td className="px-4 py-2">
                  <div className="font-medium">{b.operador_nome ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{b.operador_email ?? ""}</div>
                </td>
                <td className="px-4 py-2">{b.empresa_nome ?? "—"}</td>
                <td className="px-4 py-2"><Badge variant="outline">{TIPO_LABEL[b.tipo_pagamento ?? "boleto"] ?? (b.tipo_pagamento ?? "—")}</Badge></td>
                <td className="px-4 py-2 text-xs">{formatBRT(b.data_envio ?? b.criado_em)}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{b.beneficiario_nome ?? "—"}</span>
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
                <td className="px-4 py-2 text-right">
                  {atualizado ? (
                    <div className="flex flex-col items-end leading-tight">
                      <span className="text-xs text-muted-foreground line-through">{formatCurrencyBRL(Number(valorOriginal ?? 0))}</span>
                      <span className="font-medium">{formatCurrencyBRL(Number(b.valor_cobrado ?? 0))}</span>
                    </div>
                  ) : (
                    formatCurrencyBRL(Number(b.valor_cobrado ?? b.valor_documento ?? 0))
                  )}
                </td>
                <td className="px-4 py-2">{b.vencimento ? new Date(b.vencimento).toLocaleDateString("pt-BR") : "—"}</td>

                <td className="px-4 py-2">
                  {b.arquivo_url ? (
                    <Button size="sm" variant="ghost" onClick={() => abrirAnexo(b.arquivo_url)}>
                      <Paperclip className="mr-1 h-3.5 w-3.5" /> Ver
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  <Badge variant={STATUS_VARIANT[b.status] ?? "outline"}>{b.status}</Badge>
                </td>
                <td className="px-4 py-2">
                  <Button size="sm" variant="ghost" onClick={() => setDetailsRow(b)} disabled={!b.dados_json && !b.dados_pagamento}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> Ver
                  </Button>
                </td>
                {canManage && (
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm"
                        variant={b.status === "aprovado" ? "default" : "outline"}
                        onClick={() => updateStatus(b.id, "aprovado", b.status)}
                        title={b.status === "aprovado" ? "Clique para desfazer" : "Aprovar"}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant={b.status === "rejeitado" ? "destructive" : "outline"}
                        onClick={() => updateStatus(b.id, "rejeitado", b.status)}
                        title={b.status === "rejeitado" ? "Clique para desfazer" : "Rejeitar"}
                      >
                        <XIcon className="mr-1 h-3.5 w-3.5" /> Rejeitar
                      </Button>
                      <Button
                        size="sm"
                        variant={b.status === "pago" ? "default" : "outline"}
                        onClick={() => updateStatus(b.id, "pago", b.status)}
                        title={b.status === "pago" ? "Clique para desfazer" : "Marcar como pago"}
                      >
                        <DollarSign className="mr-1 h-3.5 w-3.5" /> Pago
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
              );
            })}

            {filtered.length === 0 && <tr><td colSpan={canManage ? 12 : 10} className="px-4 py-10 text-center text-muted-foreground">Nenhum pagamento encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Itens por página</span>
          <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[10, 25, 50, 100, 200].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">
            {filtered.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)}`} de {filtered.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>Anterior</Button>
          <span className="text-muted-foreground">Página {currentPage} de {totalPages}</span>
          <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Próxima</Button>
        </div>
      </div>

      <Dialog open={!!detailsRow} onOpenChange={(o) => !o && setDetailsRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do pagamento</DialogTitle>
          </DialogHeader>
          {detailsRow?.dados_json ? (
            <div className="space-y-4">
              <PaymentCodeCard data={detailsRow.dados_json} />
              <DetailsCard data={detailsRow.dados_json} />
            </div>
          ) : detailsRow?.dados_pagamento ? (
            <div className="space-y-2 text-sm">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs uppercase text-muted-foreground">Tipo</p>
                <p className="font-medium">{TIPO_LABEL[detailsRow.tipo_pagamento ?? "boleto"] ?? detailsRow.tipo_pagamento}</p>
              </div>
              {Object.entries(detailsRow.dados_pagamento).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-border/60 py-1.5">
                  <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                  <span className="font-medium text-right">{String(v)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}