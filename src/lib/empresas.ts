// Helpers cliente para trabalhar com hierarquia matriz/filial.
import type { AppRole } from "@/lib/rbac/roles";

export type EmpresaLike = {
  id: string;
  nome: string;
  matriz_id: string | null;
  ativo?: boolean;
};

/** Rótulo do tipo baseado em matriz_id. */
export function tipoEmpresa(e: Pick<EmpresaLike, "matriz_id">): "matriz" | "filial" {
  return e.matriz_id ? "filial" : "matriz";
}

/**
 * Retorna as empresas que o usuário pode operar.
 * - admin: todas as ativas
 * - gestor/analista: todas as ativas (permissões finas ficam a cargo do backend/RLS)
 * - operador vinculado a matriz: a matriz + suas filiais ativas
 * - operador vinculado a filial: apenas aquela filial
 * - sem empresa vinculada: []
 */
export function getEmpresasPermitidas(
  role: AppRole | null,
  vinculo: { empresa_id: string | null; empresa_matriz_id: string | null } | null,
  todas: EmpresaLike[],
): EmpresaLike[] {
  const ativas = todas.filter((e) => e.ativo !== false);
  if (role === "admin" || role === "gestor" || role === "analista") return ativas;
  if (role !== "operador") return [];
  const empresaId = vinculo?.empresa_id;
  if (!empresaId) return [];
  const propria = ativas.find((e) => e.id === empresaId);
  if (!propria) return [];
  if (propria.matriz_id) return [propria];
  // é matriz — inclui suas filiais
  return [propria, ...ativas.filter((e) => e.matriz_id === propria.id)];
}

export function rotuloEmpresaComTipo(e: EmpresaLike, matrizNome?: string | null): string {
  if (!e.matriz_id) return `${e.nome} — Matriz`;
  return matrizNome ? `${e.nome} — Filial de ${matrizNome}` : `${e.nome} — Filial`;
}
