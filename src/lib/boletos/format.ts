export function formatCurrencyBRL(value: number | null | undefined): string {
  if (value == null || !isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  // aceita YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function formatCpfCnpj(doc: string | null | undefined): string {
  if (!doc) return "—";
  const s = doc.replace(/\D/g, "");
  if (s.length === 11) return s.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (s.length === 14) return s.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

export function formatCep(cep: string | null | undefined): string {
  if (!cep) return "—";
  const s = cep.replace(/\D/g, "");
  if (s.length === 8) return s.replace(/(\d{5})(\d{3})/, "$1-$2");
  return cep;
}

export function tipoDocumentoLabel(t: string | null | undefined): string {
  if (!t) return "Documento";
  const map: Record<string, string> = {
    boleto_bancario: "Boleto bancário",
    conta_energia: "Conta de energia",
    conta_agua: "Conta de água",
    conta_telefone: "Conta de telefone",
    arrecadacao: "Guia de arrecadação",
    outro: "Documento",
  };
  return map[t] ?? t;
}