import { Check, Loader2 } from "lucide-react";
import type { StepId } from "@/lib/boletos/pipeline";
import { cn } from "@/lib/utils";

const STEPS: { id: StepId; label: string }[] = [
  { id: "preparar", label: "Preparando documento" },
  { id: "buscar_barras", label: "Procurando código de barras" },
  { id: "extrair_texto", label: "Extraindo texto" },
  { id: "validar", label: "Validando informações" },
  { id: "organizar", label: "Organizando resultado" },
];

export function ProcessingSteps({ current }: { current: StepId | null }) {
  const currentIdx = current ? STEPS.findIndex((s) => s.id === current) : -1;
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-card p-5">
      <p className="mb-3 text-sm font-medium text-foreground">Processando seu boleto</p>
      <ul className="space-y-2">
        {STEPS.map((s, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <li key={s.id} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-primary/10 text-primary",
                  !done && !active && "border-border bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="text-[10px]">{idx + 1}</span>}
              </div>
              <span className={cn("text-sm", done || active ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}