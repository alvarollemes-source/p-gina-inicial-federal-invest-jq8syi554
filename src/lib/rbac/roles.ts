import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  gestor: "Gestor Federal Invest",
  analista: "Analista Federal Invest",
  operador: "Operador Cliente",
};

export const PAGES = [
  "dashboard",
  "pagamentos",
  "upload-boletos",
  "pagamentos-manuais",
  "historico",
  "boletos-recebidos",
  "conversor-ofx",
  "relatorios",
  "separar-comprovantes",
  "financeiro-documentos",
  "financeiro-cnab",
  "financeiro-retornos",
  "financeiro-config-bancaria",
  "usuarios",
  "empresas",
  "permissoes",
  "configuracoes",
  "logs",
] as const;
export type PageKey = (typeof PAGES)[number];

/** Default role→page visibility. Individual permissions override this. */
export const DEFAULT_ROLE_PAGES: Record<AppRole, PageKey[]> = {
  admin: [
    "dashboard",
    "pagamentos",
    "upload-boletos",
    "pagamentos-manuais",
    "historico",
    "boletos-recebidos",
    "conversor-ofx",
    "relatorios",
    "separar-comprovantes",
    "financeiro-documentos",
    "financeiro-cnab",
    "financeiro-retornos",
    "financeiro-config-bancaria",
    "usuarios",
    "empresas",
    "permissoes",
    "configuracoes",
    "logs",
  ],
  gestor: [
    "dashboard",
    "boletos-recebidos",
    "historico",
    "relatorios",
    "conversor-ofx",
    "separar-comprovantes",
    "financeiro-documentos",
    "financeiro-cnab",
    "financeiro-retornos",
    "financeiro-config-bancaria",
    "usuarios",
    "empresas",
  ],
  analista: [
    "dashboard",
    "boletos-recebidos",
    "historico",
    "conversor-ofx",
    "separar-comprovantes",
    "financeiro-documentos",
    "financeiro-cnab",
    "financeiro-retornos",
  ],
  operador: ["dashboard", "pagamentos", "upload-boletos", "pagamentos-manuais", "historico"],
};

export function isFederal(role: AppRole | null): boolean {
  return role === "admin" || role === "gestor" || role === "analista";
}