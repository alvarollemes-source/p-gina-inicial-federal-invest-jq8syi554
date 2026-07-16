import { Trash2, FileText, ChevronRight } from "lucide-react";
import type { BoletoRow } from "@/lib/boletos/storage";
import { formatCurrencyBRL, formatDateBR } from "@/lib/boletos/format";
import { ValidationBadge } from "./ValidationBadge";
import type { StatusValidacao } from "@/lib/boletos/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  items: BoletoRow[];
  onSelect: (row: BoletoRow) => void;
  onDelete: (row: BoletoRow) => void;
  onSend?: (row: BoletoRow) => void;
}

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  rascunho: { label: "Rascunho", variant: "outline" },
  recebido: { label: "Enviado — aguardando", variant: "secondary" },
  em_analise: { label: "Em análise", variant: "secondary" },
  aprovado: { label: "Aprovado", variant: "default" },
  rejeitado: { label: "Rejeitado", variant: "destructive" },
  pago: { label: "Pago", variant: "default" },
};

export function HistoryList({ items, onSelect, onDelete, onSend }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
        <p className="text-sm text-muted-foreground">Nenhum boleto processado ainda.</p>
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.id}>
          <div className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.02]">
            <button
              onClick={() => onSelect(r)}
              className="flex flex-1 items-center gap-3 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {r.beneficiario_nome ?? r.banco_nome ?? r.arquivo_nome ?? "Boleto"}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>Venc. {formatDateBR(r.vencimento)}</span>
                  <span>{formatCurrencyBRL(r.valor_cobrado ?? r.valor_documento)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.status && STATUS_LABEL[r.status] ? (
                  <Badge variant={STATUS_LABEL[r.status].variant}>{STATUS_LABEL[r.status].label}</Badge>
                ) : (
                  <ValidationBadge status={(r.status_validacao as StatusValidacao | null) ?? "nao_identificado"} size="sm" />
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
            {onSend && r.status === "rascunho" && (
              <Button size="sm" onClick={() => onSend(r)}>
                Enviar para pagamento
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(r)}
              aria-label="Excluir"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}