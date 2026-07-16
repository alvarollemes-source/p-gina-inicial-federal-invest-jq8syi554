import { useState } from "react";
import { Copy, Check, FileText, Trash2, Send, Eye, CheckCircle2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { BoletoRow } from "@/lib/boletos/storage";
import { formatCurrencyBRL, formatDateBR } from "@/lib/boletos/format";
import { copiarCodigo } from "@/lib/boletos/normalize";
import { PaymentCodeCard } from "./PaymentCodeCard";
import { DetailsCard } from "./DetailsCard";
import { ValidationBadge } from "./ValidationBadge";
import type { StatusValidacao } from "@/lib/boletos/types";
import { Building2 } from "lucide-react";

export type EmpresaOption = { id: string; nome: string; matriz_id: string | null };

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  recebido: { label: "Enviado — aguardando", variant: "secondary" },
  em_analise: { label: "Em análise", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
  pago: { label: "Pago", variant: "default" },
};

interface Props {
  row: BoletoRow;
  onSend?: (row: BoletoRow) => void;
  onDelete?: (row: BoletoRow) => void;
  empresas?: EmpresaOption[];
  onEmpresaChange?: (row: BoletoRow, empresaId: string | null) => void;
}

export function BoletoUploadCard({ row, onSend, onDelete, empresas, onEmpresaChange }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const data = row.dados_json;
  const linhaDig = data?.linha_digitavel?.valor ?? null;
  const statusMeta = row.status ? STATUS_LABEL[row.status] : undefined;
  const isPago = row.status === "pago";
  const isLocked = ["aprovado", "rejeitado", "pago"].includes(row.status ?? "");
  const canDelete = !isLocked;
  const isRascunho = row.status === "rascunho";
  const empresaAtual = row.empresa_id ?? null;
  const empresaNome = empresas?.find((e) => e.id === empresaAtual)?.nome ?? null;
  const podeEnviar = !!empresaAtual;

  const copy = async () => {
    if (!linhaDig) return toast.error("Linha digitável não identificada");
    try {
      await copiarCodigo(linhaDig);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <>
      <div
        className={
          isPago
            ? "relative overflow-hidden rounded-2xl border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-4 shadow-sm ring-1 ring-emerald-500/20"
            : "rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
        }
      >
        {isPago && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
            <CheckCircle2 className="h-3.5 w-3.5" /> Pago
          </div>
        )}
        <div className="flex items-start gap-3">
          <div
            className={
              isPago
                ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white"
                : "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            }
          >
            {isPago ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {row.beneficiario_nome ?? row.banco_nome ?? row.arquivo_nome ?? "Boleto"}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Venc. {formatDateBR(row.vencimento)}</span>
              <span className="font-medium text-foreground">
                {formatCurrencyBRL(row.valor_cobrado ?? row.valor_documento)}
              </span>
            </div>
            {!isPago && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {statusMeta ? <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge> : null}
                <ValidationBadge
                  status={(row.status_validacao as StatusValidacao | null) ?? "nao_identificado"}
                  size="sm"
                />
                {empresaNome && (
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" /> {empresaNome}
                  </Badge>
                )}
              </div>
            )}
          </div>
          {onDelete && canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Excluir"
                  className="text-muted-foreground hover:text-destructive"
                >
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

        {isRascunho && empresas && onEmpresaChange && (
          <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-2">
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Empresa (matriz ou filial) *
            </label>
            <select
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={empresaAtual ?? ""}
              onChange={(e) => onEmpresaChange(row, e.target.value || null)}
            >
              <option value="">— selecionar empresa —</option>
              {[...empresas]
                .sort((a, b) => (a.matriz_id ? 1 : 0) - (b.matriz_id ? 1 : 0) || a.nome.localeCompare(b.nome))
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.matriz_id ? `↳ ${emp.nome} (filial)` : emp.nome}
                  </option>
                ))}
            </select>
            {!empresaAtual && (
              <p className="mt-1 text-[11px] text-amber-700">Selecione a empresa antes de enviar para pagamento.</p>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={copy} disabled={!linhaDig}>
            {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
            {copied ? "Copiado" : "Copiar linha digitável"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={!data}>
            <Eye className="mr-1.5 h-4 w-4" /> Ver detalhes
          </Button>
          {onSend && row.status === "rascunho" && (
            <Button size="sm" onClick={() => onSend(row)} className="ml-auto" disabled={!podeEnviar} title={podeEnviar ? "" : "Selecione a empresa"}>
              <Send className="mr-1.5 h-4 w-4" /> Enviar para pagamento
            </Button>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do boleto</DialogTitle>
          </DialogHeader>
          {data && (
            <div className="space-y-4">
              <PaymentCodeCard data={data} />
              <DetailsCard data={data} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}