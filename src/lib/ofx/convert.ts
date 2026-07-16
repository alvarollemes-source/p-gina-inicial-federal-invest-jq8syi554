import * as XLSX from "xlsx";

export type Lancamento = {
  data: string; // YYYYMMDD
  descricao: string;
  valor: number;
  tipo: "CREDIT" | "DEBIT";
  id: string;
};

export type ConversionResult = {
  lancamentos: Lancamento[];
  totalCreditos: number;
  totalDebitos: number;
  saldoFinal: number;
  ofx: string;
};

/** Faz o caminho reverso: OFX (SGML/XML) → Lançamentos + Workbook XLSX. */
export async function convertFromOfx(file: File): Promise<{ lancamentos: Lancamento[]; totalCreditos: number; totalDebitos: number; saldoFinal: number; xlsx: ArrayBuffer }> {
  const text = await file.text();
  const lancamentos = parseOfxText(text);
  let totalCreditos = 0;
  let totalDebitos = 0;
  for (const l of lancamentos) {
    if (l.valor >= 0) totalCreditos += l.valor;
    else totalDebitos += Math.abs(l.valor);
  }
  const saldoFinal = totalCreditos - totalDebitos;

  const wb = XLSX.utils.book_new();
  const rows = [
    ["Data", "Descrição", "Valor", "Tipo"],
    ...lancamentos.map((l) => [
      `${l.data.slice(6, 8)}/${l.data.slice(4, 6)}/${l.data.slice(0, 4)}`,
      l.descricao,
      l.valor,
      l.tipo === "CREDIT" ? "C" : "D",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Extrato");
  const xlsx = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return { lancamentos, totalCreditos, totalDebitos, saldoFinal, xlsx };
}

function firstTag(block: string, name: string): string | null {
  const rx = new RegExp(`<${name}>([\\s\\S]*?)(?=<[A-Z/]|$)`, "i");
  const m = rx.exec(block);
  return m ? m[1].trim() : null;
}

function parseOfxText(text: string): Lancamento[] {
  // Isola cada <STMTTRN>...</STMTTRN>
  const blocks: string[] = [];
  const rx = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(text))) blocks.push(m[1]);
  if (blocks.length === 0) {
    // fallback: split by <STMTTRN>
    const parts = text.split(/<STMTTRN>/i).slice(1);
    for (const p of parts) blocks.push(p);
  }
  const out: Lancamento[] = [];
  for (const b of blocks) {
    const trntype = (firstTag(b, "TRNTYPE") ?? "").toUpperCase();
    const dtposted = firstTag(b, "DTPOSTED") ?? "";
    const trnamt = firstTag(b, "TRNAMT") ?? "0";
    const memo = firstTag(b, "MEMO") ?? firstTag(b, "NAME") ?? "";
    const fitid = firstTag(b, "FITID") ?? crypto.randomUUID();
    const dataStr = dtposted.slice(0, 8);
    const valor = parseFloat(trnamt.replace(",", "."));
    if (!dataStr || isNaN(valor)) continue;
    out.push({
      id: fitid,
      data: dataStr,
      descricao: memo.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
      valor,
      tipo: trntype === "DEBIT" || valor < 0 ? "DEBIT" : "CREDIT",
    });
  }
  return out;
}

const norm = (s: unknown) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const stripLead = (s: unknown) => String(s ?? "").replace(/^['\s]+/, "").replace(/[\u0000-\u001f]/g, "").trim();

function parseValor(v: unknown): number {
  if (typeof v === "number") return v;
  const s = stripLead(v);
  if (!s) return NaN;
  // Brazilian format: "1.234,56" or "-1.234,56" or "(1.234,56)"
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  const clean = s.replace(/[()R$\s]/g, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const n = parseFloat(clean);
  if (isNaN(n)) return NaN;
  return neg && n > 0 ? -n : n;
}

function parseData(v: unknown): string | null {
  if (v instanceof Date) return fmtDate(v);
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}${String(d.m).padStart(2, "0")}${String(d.d).padStart(2, "0")}`;
  }
  const s = stripLead(v);
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    let [, dd, mm, yy] = m;
    if (yy.length === 2) yy = (Number(yy) > 50 ? "19" : "20") + yy;
    return `${yy}${mm.padStart(2, "0")}${dd.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}${iso[2]}${iso[3]}`;
  return null;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function sniffHtml(buf: ArrayBuffer): { html: true; text: string } | { html: false } {
  const head = new Uint8Array(buf, 0, Math.min(1024, buf.byteLength));
  // Detect charset from meta if present, using latin1 for sniff
  const sniff = new TextDecoder("iso-8859-1").decode(head).toLowerCase();
  if (!/<!doctype html|<html|<table|<meta|<head/.test(sniff)) return { html: false };
  let charset = "iso-8859-1";
  const m = sniff.match(/charset\s*=\s*["']?([\w-]+)/);
  if (m) charset = m[1];
  // BOM → UTF-8
  const b = new Uint8Array(buf, 0, Math.min(3, buf.byteLength));
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) charset = "utf-8";
  try {
    const text = new TextDecoder(charset).decode(buf);
    return { html: true, text };
  } catch {
    return { html: true, text: new TextDecoder("iso-8859-1").decode(buf) };
  }
}

/** Parse XLS/XLSX/CSV/HTML table into lancamentos and build OFX. */
export async function convertToOfx(file: File): Promise<ConversionResult> {
  const buf = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  const sniffed = sniffHtml(buf);
  if (sniffed.html) {
    // Preserve original cell text so "540,27" is not coerced to 54027 in en-US locale.
    wb = XLSX.read(sniffed.text, { type: "string", raw: true, cellText: true } as XLSX.ParsingOptions);
  } else {
    try {
      wb = XLSX.read(buf, { type: "array", cellDates: true });
    } catch {
      const text = new TextDecoder("utf-8").decode(buf);
      wb = XLSX.read(text, { type: "string" });
    }
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: !sniffed.html ? false : true,
  });
  if (!rows.length) throw new Error("Planilha vazia ou formato não reconhecido.");

  // Detect columns
  const headers = Object.keys(rows[0]);
  const colData = headers.find((h) => /data|date/i.test(norm(h)));
  const colDesc = headers.find((h) => /desc|hist|memo|lanc/i.test(norm(h)));
  const colValor = headers.find((h) => /valor|amount|montante/i.test(norm(h)));
  const colCred = headers.find((h) => /credito|credit|entrada/i.test(norm(h)));
  const colDeb = headers.find((h) => /debito|debit|saida/i.test(norm(h)));
  const colSinal = headers.find((h) => {
    const n = norm(h);
    return n === "c/d" || n === "cd" || n === "c\\d" || n === "tipo" || n === "d/c" || n === "dc";
  });
  if (!colData) throw new Error("Coluna de data não encontrada.");

  const lanc: Lancamento[] = [];
  let idx = 0;
  for (const row of rows) {
    const data = parseData(row[colData]);
    if (!data) continue;
    let valor: number = NaN;
    if (colValor) valor = parseValor(row[colValor]);
    if (isNaN(valor) && colCred) {
      const c = parseValor(row[colCred]);
      const d = colDeb ? parseValor(row[colDeb]) : 0;
      valor = (isNaN(c) ? 0 : c) - (isNaN(d) ? 0 : d);
    }
    if (isNaN(valor) || valor === 0) continue;
    // C/D column overrides implicit sign
    if (colSinal) {
      const raw = stripLead(row[colSinal]);
      if (/[-]|deb|d$/i.test(raw)) valor = -Math.abs(valor);
      else if (/[+]|cred|c$/i.test(raw)) valor = Math.abs(valor);
    }
    const descricao = stripLead(colDesc ? row[colDesc] : "") || "Lançamento";
    lanc.push({
      data,
      descricao,
      valor,
      tipo: valor >= 0 ? "CREDIT" : "DEBIT",
      id: `${data}${String(++idx).padStart(4, "0")}`,
    });
  }
  if (!lanc.length) throw new Error("Nenhum lançamento válido encontrado.");

  const totalCreditos = lanc.filter((l) => l.valor > 0).reduce((s, l) => s + l.valor, 0);
  const totalDebitos = lanc.filter((l) => l.valor < 0).reduce((s, l) => s + Math.abs(l.valor), 0);
  const saldoFinal = totalCreditos - totalDebitos;
  const ofx = buildOfx(lanc, saldoFinal);
  return { lancamentos: lanc, totalCreditos, totalDebitos, saldoFinal, ofx };
}

function buildOfx(lancamentos: Lancamento[], saldo: number): string {
  const now = fmtDate(new Date()) + "120000";
  const dtStart = lancamentos[0].data;
  const dtEnd = lancamentos[lancamentos.length - 1].data;
  const escape = (s: string) => s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]!);
  const trns = lancamentos
    .map(
      (l) => `      <STMTTRN>
        <TRNTYPE>${l.tipo}</TRNTYPE>
        <DTPOSTED>${l.data}</DTPOSTED>
        <TRNAMT>${l.valor.toFixed(2)}</TRNAMT>
        <FITID>${l.id}</FITID>
        <MEMO>${escape(l.descricao).slice(0, 250)}</MEMO>
      </STMTTRN>`,
    )
    .join("\n");
  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
      <DTSERVER>${now}</DTSERVER>
      <LANGUAGE>POR</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>1</TRNUID>
      <STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
      <STMTRS>
        <CURDEF>BRL</CURDEF>
        <BANKACCTFROM>
          <BANKID>0000</BANKID>
          <ACCTID>0000</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>${dtStart}</DTSTART>
          <DTEND>${dtEnd}</DTEND>
${trns}
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>${saldo.toFixed(2)}</BALAMT>
          <DTASOF>${now}</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>`;
}