import { useState } from "react";
import { Copy, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { BoletoData } from "@/lib/boletos/types";
import { copiarCodigo, formatarLinhaDigitavel, normalizarCodigo } from "@/lib/boletos/normalize";
import { ValidationBadge } from "./ValidationBadge";

const ORIGEM_LABEL: Record<string, string> = {
  leitura_visual: "leitura visual do código",
  texto_pdf: "texto do PDF",
  ia: "IA visual",
  usuario: "informado manualmente",
};

function CopyButton({ valor, label, variant = "default" }: { valor: string | null; label: string; variant?: "default" | "outline" }) {
  const [copied, setCopied] = useState(false);
  const disabled = !valor || normalizarCodigo(valor).length === 0;
  const onClick = async () => {
    if (!valor) return;
    try {
      await copiarCodigo(valor);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };
  return (
    <Button onClick={onClick} disabled={disabled} variant={variant} className="w-full sm:w-auto">
      {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
      {copied ? "Copiado" : label}
    </Button>
  );
}

export function PaymentCodeCard({ data }: { data: BoletoData }) {
  const cb = data.codigo_barras;
  const ld = data.linha_digitavel;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Código para pagamento</h2>
            <p className="text-xs text-muted-foreground">Copie apenas o valor numérico — sem espaços nem pontos.</p>
          </div>
        </div>
        <ValidationBadge status={data.validacao.status} />
      </div>

      <div className="mt-5 space-y-5">
        {/* Código de barras */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Código de barras</p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {cb.valor && <span>{cb.quantidade_digitos} dígitos</span>}
              {cb.origem && <span>· {ORIGEM_LABEL[cb.origem] ?? cb.origem}</span>}
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-3 sm:px-4 sm:py-4">
            <p className="break-all font-mono text-sm text-foreground sm:text-base">
              {cb.valor ?? <span className="text-muted-foreground">Não identificado</span>}
            </p>
          </div>
          <div className="mt-3">
            <CopyButton valor={cb.valor} label="Copiar código de barras" />
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Linha digitável */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Linha digitável</p>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {ld.valor && <span>{ld.quantidade_digitos} dígitos</span>}
              {ld.origem && <span>· {ORIGEM_LABEL[ld.origem] ?? ld.origem}</span>}
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 px-3 py-3 sm:px-4 sm:py-4">
            <p className="break-all font-mono text-sm text-foreground sm:text-base">
              {ld.valor ? formatarLinhaDigitavel(ld.valor) : <span className="text-muted-foreground">Não identificada</span>}
            </p>
          </div>
          <div className="mt-3">
            <CopyButton valor={ld.valor} label="Copiar linha digitável" variant="outline" />
          </div>
        </div>
      </div>

      {(data.validacao.erros.length > 0 || data.validacao.alertas.length > 0) && (
        <div className="mt-5 space-y-2">
          {data.validacao.erros.map((e, i) => (
            <p key={`err-${i}`} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {e}
            </p>
          ))}
          {data.validacao.alertas.map((a, i) => (
            <p key={`alr-${i}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {a}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}