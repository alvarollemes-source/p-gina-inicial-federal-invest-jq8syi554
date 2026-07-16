import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import type { StatusValidacao } from "@/lib/boletos/types";
import { cn } from "@/lib/utils";

const CFG: Record<StatusValidacao, { label: string; icon: typeof CheckCircle2; className: string }> = {
  valido: {
    label: "Validado",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  requer_conferencia: {
    label: "Requer conferência",
    icon: AlertTriangle,
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  invalido: {
    label: "Inválido",
    icon: XCircle,
    className: "bg-red-50 text-red-700 border-red-200",
  },
  nao_identificado: {
    label: "Não identificado",
    icon: HelpCircle,
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

export function ValidationBadge({ status, size = "md" }: { status: StatusValidacao; size?: "sm" | "md" }) {
  const cfg = CFG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        cfg.className,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {cfg.label}
    </span>
  );
}