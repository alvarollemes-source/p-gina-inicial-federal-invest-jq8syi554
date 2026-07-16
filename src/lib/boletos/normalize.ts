/**
 * Remove todo caractere não numérico.
 */
export function normalizarCodigo(valor: string | null | undefined): string {
  if (!valor) return "";
  return String(valor).replace(/\D/g, "");
}

/**
 * Formata linha digitável de boleto bancário (47 dígitos) em blocos legíveis.
 * Retorna o original quando o tamanho não é reconhecido.
 */
export function formatarLinhaDigitavel(valor: string | null | undefined): string {
  const s = normalizarCodigo(valor);
  if (s.length === 47) {
    return `${s.slice(0, 5)}.${s.slice(5, 10)} ${s.slice(10, 15)}.${s.slice(15, 21)} ${s.slice(21, 26)}.${s.slice(26, 32)} ${s.slice(32, 33)} ${s.slice(33, 47)}`;
  }
  if (s.length === 48) {
    return `${s.slice(0, 12)} ${s.slice(12, 24)} ${s.slice(24, 36)} ${s.slice(36, 48)}`;
  }
  return s;
}

/**
 * Copia código já normalizado para clipboard, com fallback para browsers antigos.
 */
export async function copiarCodigo(valor: string): Promise<void> {
  const codigo = normalizarCodigo(valor);
  if (!codigo) throw new Error("Nenhum código disponível para copiar.");
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(codigo);
    return;
  }
  // Fallback
  const el = document.createElement("textarea");
  el.value = codigo;
  el.setAttribute("readonly", "");
  el.style.position = "absolute";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(el);
  }
}