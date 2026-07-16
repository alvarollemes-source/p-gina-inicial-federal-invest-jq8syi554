// Client-side port of the pdf-comprovante-splitter skill.
// Extracts type/date/beneficiary/amount from a Bradesco receipt page text.

import { PDFDocument } from "pdf-lib";

export type ReceiptType = "boleto" | "transferir" | "ted" | "unknown";

export interface ParsedReceipt {
  page: number;
  tipo: ReceiptType;
  data: string; // DD.MM.YYYY or 00.00.0000
  beneficiario: string; // UPPERCASE or DESCONHECIDO
  valor: string; // Brazilian format 1.250,90 or 0,00
}

/**
 * Reconstitui texto tipo "pdftotext -layout" a partir dos itens do pdfjs.
 * Agrupa por linha usando o Y da transform, ordena Y (topo→base) e X (esq→dir).
 */
export function layoutTextFromPdfjsItems(
  items: Array<{ str: string; transform: number[] }>,
): string {
  if (items.length === 0) return "";
  type Row = { y: number; items: Array<{ x: number; str: string }> };
  const rows: Row[] = [];
  const tol = 2.5;
  for (const it of items) {
    if (!it.str) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let row = rows.find((r) => Math.abs(r.y - y) <= tol);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, str: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((r) =>
      r.items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.str)
        .join(" ")
        .replace(/[ \t]+/g, " ")
        .trim(),
    )
    .filter((l) => l.length > 0)
    .join("\n");
}

export function detectType(text: string): ReceiptType {
  if (/Boletos?\s+de\s+Cobran[çc]a/i.test(text)) return "boleto";
  if (/Transfer[êe]ncias?\s+Para\s+Contas?\s+de\s+Outros\s+Bancos/i.test(text)) return "ted";
  if (/Transferir/i.test(text)) return "transferir";
  if (/Nome do favorecido/i.test(text)) return "ted";
  if (/Dados de quem\s+recebeu/i.test(text)) return "transferir";
  if (/Raz[ãa]o\s+Social/i.test(text)) return "boleto";
  return "unknown";
}

function cleanName(raw: string): string {
  // Cut at the first "field-like" label that could follow the name on the same reconstructed line.
  const stopLabels = [
    /\bBenefici[áa]rio:/i,
    /\bCPF\/CNPJ\b/i,
    /\bCPF\b/i,
    /\bCNPJ\b/i,
    /\bAg[êe]ncia\b/i,
    /\bConta\b/i,
    /\bBanco\b/i,
    /\bTipo de conta\b/i,
    /\bChave\b/i,
    /\bInstitui[çc][ãa]o\b/i,
    /\bData\b/i,
    /\bValor\b/i,
    /\bIdentificador\b/i,
  ];
  let cut = raw;
  for (const rx of stopLabels) {
    const m = cut.match(rx);
    if (m && m.index !== undefined) cut = cut.slice(0, m.index);
  }
  return cut.replace(/\s+/g, " ").trim();
}

export function extractBeneficiario(text: string, tipo: ReceiptType): string {
  let name: string | null = null;

  if (tipo === "boleto") {
    // "Razão Social" possibly followed by name (same line) then Beneficiário: on next
    const m1 = text.match(/Raz[ãa]o\s+Social[:\s]+([^\n]+?)(?:\n\s*Benefici[áa]rio:)/i);
    if (m1) name = m1[1];
    if (!name) {
      const m2 = text.match(/Raz[ãa]o\s+Social[:\s]+([^\n]+)/i);
      if (m2) name = m2[1];
    }
  } else if (tipo === "ted") {
    const m = text.match(/Nome do favorecido[:\s]+([^\n]+)/i);
    if (m) name = m[1];
  } else if (tipo === "transferir") {
    // Prefer Nome inside "Dados de quem recebeu" section
    const sec = text.match(/Dados de quem\s+recebeu([\s\S]*?)(?:\n\s*\n|$)/i);
    const scope = sec ? sec[1] : text;
    const m = scope.match(/(?:^|\n)\s*Nome[:\s]+([^\n]+)/i);
    if (m) name = m[1];
  }

  if (!name) {
    const patterns = [
      /Raz[ãa]o\s+Social[:\s]+([^\n]+?)(?:\n\s*Benefici[áa]rio:)/i,
      /Nome do favorecido[:\s]+([^\n]+)/i,
      /(?:^|\n)\s*Nome[:\s]+([A-ZÀ-Ÿ][^\n]+)/,
    ];
    for (const rx of patterns) {
      const m = text.match(rx);
      if (m) {
        name = m[1];
        break;
      }
    }
  }

  if (!name) return "DESCONHECIDO";
  const cleaned = cleanName(name);
  return cleaned ? cleaned.toUpperCase() : "DESCONHECIDO";
}

export function extractData(text: string): string {
  let m = text.match(/Data de d[ée]bito[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
  if (m) return m[1].replace(/\//g, ".");
  m = text.match(/Data da opera[çc][ãa]o[:\s]+(\d{2}\/\d{2}\/\d{4})/i);
  if (m) return m[1].replace(/\//g, ".");
  return "00.00.0000";
}

export function extractValor(text: string, tipo: ReceiptType): string {
  if (tipo === "boleto") {
    const m = text.match(/Valor\s+total[:\s]*R\$\s*([\d.,]+)/i);
    if (m) return m[1].trim();
  }
  // Transferir / TED / fallback: "Valor" (not "Valor total", not "Valor da tarifa")
  // Try isolated "Valor R$" or "Valor: R$" excluding tarifa/total/agendado
  const negatives = /(total|tarifa|agendado|saldo|limite)/i;
  const lines = text.split(/\n/);
  for (const ln of lines) {
    if (!/\bValor\b/i.test(ln)) continue;
    if (negatives.test(ln)) continue;
    const m = ln.match(/\bValor[:\s]*R\$\s*([\d.,]+)/i);
    if (m) return m[1].trim();
  }
  // Last resort: fallback to Valor total
  const mTotal = text.match(/Valor\s+total[:\s]*R\$\s*([\d.,]+)/i);
  if (mTotal) return mTotal[1].trim();
  return "0,00";
}

export function parseReceiptText(text: string, page: number): ParsedReceipt {
  const tipo = detectType(text);
  return {
    page,
    tipo,
    data: extractData(text),
    beneficiario: extractBeneficiario(text, tipo),
    valor: extractValor(text, tipo),
  };
}

/** Remove acentos combinantes. */
export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Sanitiza um nome de arquivo conforme regras do produto. */
export function sanitizeFilename(raw: string, options?: { removeAccents?: boolean }): string {
  let out = raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[/\\]/g, "-")
    .replace(/[:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (options?.removeAccents) out = stripAccents(out);
  if (out.length > 180) out = out.slice(0, 180).trim();
  return out;
}

export function buildFilename(p: Pick<ParsedReceipt, "data" | "beneficiario" | "valor">, opts?: { removeAccents?: boolean }): string {
  const base = `${p.data} - ${p.beneficiario} ${p.valor}.pdf`;
  return sanitizeFilename(base, opts);
}

/** Garante nome único aplicando " (n)" quando necessário. */
export function uniqueFilename(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  const dot = name.lastIndexOf(".pdf");
  const stem = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : "";
  let i = 1;
  while (used.has(`${stem} (${i})${ext}`)) i++;
  const finalName = `${stem} (${i})${ext}`;
  used.add(finalName);
  return finalName;
}

export function requiresReview(r: ParsedReceipt): boolean {
  return (
    r.tipo === "unknown" ||
    r.beneficiario === "DESCONHECIDO" ||
    r.valor === "0,00" ||
    r.data === "00.00.0000"
  );
}

/** Extrai UMA página como um PDF novo (mantém a página vetorial original). */
export async function extractPageAsPdf(srcBytes: ArrayBuffer, pageIndex: number): Promise<Uint8Array> {
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: false });
  const out = await PDFDocument.create();
  const [copied] = await out.copyPages(src, [pageIndex]);
  out.addPage(copied);
  return out.save();
}