/**
 * Utilitários para identificação e cálculo de boletos vencidos.
 * Regras: horário de Brasília, sem percentuais fixos — extrai das instruções
 * do boleto ou pede preenchimento manual.
 */

import type { BoletoData } from "./types";

export type JurosTipo = "" | "percentual_mensal" | "percentual_diario" | "valor_fixo_diario";
export type MultaTipo = "" | "percentual" | "valor_fixo";

export interface RegrasJurosMulta {
  juros_tipo: JurosTipo;
  juros_valor: number;
  multa_tipo: MultaTipo;
  multa_valor: number;
  texto_instrucoes: string;
}

export interface CalculoAtualizado {
  vencido: boolean;
  dias_atraso: number;
  valor_original: number;
  multa_tipo: MultaTipo;
  multa_valor_base: number;
  multa_calculada: number;
  juros_tipo: JurosTipo;
  juros_valor_base: number;
  juros_diario_percentual: number | null;
  juros_calculado: number;
  valor_atualizado: number;
}

export interface MemoriaCalculo {
  valor_original: number;
  vencimento: string; // DD/MM/AAAA
  data_calculo: string; // DD/MM/AAAA
  dias_atraso: number;
  multa: { tipo: MultaTipo; valor_base: number; valor_calculado: number };
  juros: {
    tipo: JurosTipo;
    valor_base: number;
    percentual_diario: number | null;
    valor_calculado: number;
  };
  valor_atualizado: number;
  origem_dos_dados: "instrucoes_boleto" | "preenchimento_manual";
}

/** Retorna a data atual (00:00) no fuso America/Sao_Paulo. */
export function getDataAtualBrasilia(): Date {
  const now = new Date();
  const brasiliaDateString = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [day, month, year] = brasiliaDateString.split("/");
  return new Date(`${year}-${month}-${day}T00:00:00`);
}

/** Aceita "DD/MM/AAAA" ou "YYYY-MM-DD". */
export function parseDataBoleto(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;
  const s = dateString.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (br) return new Date(`${br[3]}-${br[2]}-${br[1]}T00:00:00`);
  return null;
}

export function formatarDataBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function calcularDiasAtraso(dataVencimento: Date | null, dataAtual: Date): number {
  if (!dataVencimento) return 0;
  const msPorDia = 1000 * 60 * 60 * 24;
  const diff = dataAtual.getTime() - dataVencimento.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / msPorDia);
}

function parseNumberBR(raw: string): number {
  // "1.234,56" -> 1234.56 | "1,5" -> 1.5 | "0.033" -> 0.033
  const s = raw.trim();
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  return Number(s);
}

function normalizarTexto(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/\s+/g, " ")
    .toLowerCase()
    // correções comuns de OCR para a palavra "multa"
    .replace(/\bmuita\b/g, "multa")
    .replace(/\bmu1ta\b/g, "multa")
    .replace(/\brnulta\b/g, "multa")
    .replace(/\bm ulta\b/g, "multa")
    .replace(/\bmult a\b/g, "multa")
    .replace(/\bmul ta\b/g, "multa");
}

/** Extrai juros e multa das instruções do boleto. */
export function extrairRegrasJurosMulta(instrucoes: string[] | string | null | undefined): RegrasJurosMulta {
  const texto = Array.isArray(instrucoes) ? instrucoes.join(" ; ") : (instrucoes ?? "");
  const norm = normalizarTexto(texto);

  let juros_tipo: JurosTipo = "";
  let juros_valor = 0;
  let multa_tipo: MultaTipo = "";
  let multa_valor = 0;

  // ---- MULTA em valor fixo ----
  const multaFixaRe = /multa[^%]*?r\$\s*([\d.,]+)/i;
  const mFix = norm.match(multaFixaRe);
  if (mFix) {
    multa_tipo = "valor_fixo";
    multa_valor = parseNumberBR(mFix[1]);
  }

  // ---- MULTA percentual ----
  if (!multa_tipo) {
    const multaPercRe = /(?:porcentagem\s+de\s+multa|multa(?:\s+por\s+atraso)?|percentual\s+de\s+multa)[^%\d]*([\d.,]+)\s*%/i;
    const mp = norm.match(multaPercRe);
    if (mp) {
      multa_tipo = "percentual";
      multa_valor = parseNumberBR(mp[1]);
    }
  }

  // ---- JUROS em valor fixo diário ----
  // Padrões:
  //  "juros de mora: r$ 2,50 ao dia" | "juros: r$ 2,50 ao dia"
  //  "mora diaria: r$ 2,50" | "juros diario: r$ 2,50"
  //  "cobrar r$ 2,50 por dia de atraso" | "r$ 2,50 ao dia"
  const jurosPatterns: RegExp[] = [
    // juros/mora ... r$ X (ao|por) dia
    /(?:juros|mora)[^%\n;]*?r?\$?\s*([\d.,]+)\s*(?:ao|por)\s+dia/i,
    // juros/mora diario/diaria ... r$ X
    /(?:juros|mora)\s+diari[oa][^%\n;]*?r?\$?\s*([\d.,]+)/i,
    // mora/juros diaria(o): r$ X
    /(?:mora|juros)\s*diari[oa]\s*[:\-]?\s*r?\$?\s*([\d.,]+)/i,
    // r$ X (ao|por) dia (sem palavra juros perto)
    /r\$\s*([\d.,]+)\s*(?:ao|por)\s+dia/i,
  ];
  for (const re of jurosPatterns) {
    const m = norm.match(re);
    if (m) {
      const val = parseNumberBR(m[1]);
      if (isFinite(val) && val > 0) {
        // não confundir com multa fixa já capturada com o mesmo valor
        if (!(multa_tipo === "valor_fixo" && val === multa_valor && !/juros|mora|dia/.test(norm.slice(Math.max(0, (m.index ?? 0) - 10), (m.index ?? 0) + m[0].length + 10)))) {
          juros_tipo = "valor_fixo_diario";
          juros_valor = val;
          break;
        }
      }
    }
  }

  // ---- JUROS percentual diário ----
  if (!juros_tipo) {
    const jurosDiaRe = /(?:juros|mora)[^%]*?(?:ao\s+dia|por\s+dia|diari[oa]s?)[^%\d]*([\d.,]+)\s*%/i;
    const jd = norm.match(jurosDiaRe);
    if (jd) {
      juros_tipo = "percentual_diario";
      juros_valor = parseNumberBR(jd[1]);
    } else {
      const jd2 = norm.match(/([\d.,]+)\s*%[^%]*?(?:ao\s+dia|por\s+dia|diari[oa])/i);
      if (jd2 && /juros|mora/.test(norm)) {
        juros_tipo = "percentual_diario";
        juros_valor = parseNumberBR(jd2[1]);
      }
    }
  }

  // ---- JUROS percentual mensal ----
  if (!juros_tipo) {
    const jurosMesRe = /(?:juros|mora|porcentagem\s+de\s+juro\s+mora)[^%]*?(?:ao\s+mes|mensal|por\s+mes)[^%\d]*([\d.,]+)\s*%/i;
    const jm = norm.match(jurosMesRe);
    if (jm) {
      juros_tipo = "percentual_mensal";
      juros_valor = parseNumberBR(jm[1]);
    } else {
      const jm2 = norm.match(/([\d.,]+)\s*%[^%]*?(?:ao\s+mes|mensal|por\s+mes)/i);
      if (jm2 && /juros|mora/.test(norm)) {
        juros_tipo = "percentual_mensal";
        juros_valor = parseNumberBR(jm2[1]);
      }
    }
  }

  return {
    juros_tipo,
    juros_valor: isFinite(juros_valor) ? juros_valor : 0,
    multa_tipo,
    multa_valor: isFinite(multa_valor) ? multa_valor : 0,
    texto_instrucoes: texto,
  };
}

export interface CalcularParams {
  valorOriginal: number;
  vencimento: string | Date | null;
  dataAtual: Date;
  jurosTipo: JurosTipo;
  jurosValor: number;
  multaTipo: MultaTipo;
  multaValor: number;
}

export function calcularValorAtualizadoBoleto(p: CalcularParams): CalculoAtualizado {
  const venc = p.vencimento instanceof Date ? p.vencimento : parseDataBoleto(p.vencimento);
  const diasAtraso = calcularDiasAtraso(venc, p.dataAtual);
  const valor = Number(p.valorOriginal) || 0;

  let multaCalculada = 0;
  let jurosCalculado = 0;
  let jurosDiarioPercentual: number | null = null;

  if (p.multaTipo === "percentual") multaCalculada = valor * (p.multaValor / 100);
  if (p.multaTipo === "valor_fixo") multaCalculada = p.multaValor;

  if (p.jurosTipo === "percentual_mensal") {
    jurosDiarioPercentual = p.jurosValor / 30;
    jurosCalculado = valor * (jurosDiarioPercentual / 100) * diasAtraso;
  } else if (p.jurosTipo === "percentual_diario") {
    jurosDiarioPercentual = p.jurosValor;
    jurosCalculado = valor * (p.jurosValor / 100) * diasAtraso;
  } else if (p.jurosTipo === "valor_fixo_diario") {
    jurosCalculado = p.jurosValor * diasAtraso;
  }

  const valorAtualizado = valor + multaCalculada + jurosCalculado;
  const round = (n: number) => Number(n.toFixed(2));

  return {
    vencido: diasAtraso > 0,
    dias_atraso: diasAtraso,
    valor_original: round(valor),
    multa_tipo: p.multaTipo,
    multa_valor_base: p.multaValor,
    multa_calculada: round(multaCalculada),
    juros_tipo: p.jurosTipo,
    juros_valor_base: p.jurosValor,
    juros_diario_percentual: jurosDiarioPercentual !== null ? Number(jurosDiarioPercentual.toFixed(6)) : null,
    juros_calculado: round(jurosCalculado),
    valor_atualizado: round(valorAtualizado),
  };
}

export function boletoEstaVencido(vencimento: string | null | undefined, dataAtual: Date = getDataAtualBrasilia()): boolean {
  return calcularDiasAtraso(parseDataBoleto(vencimento), dataAtual) > 0;
}

/**
 * Extrai regras combinando instruções (regex) e, se necessário, os campos
 * numéricos `multa` (assumido percentual) e `juros` (assumido percentual mensal)
 * que o extrator/AI normalmente popula quando o valor está em campo próprio
 * do boleto e não como texto de instrução.
 */
export function extrairRegrasCompletas(
  data: Pick<BoletoData, "instrucoes" | "informacoes_adicionais" | "multa" | "juros">,
): RegrasJurosMulta {
  const textos = [
    ...(Array.isArray(data.instrucoes) ? data.instrucoes : []),
    data.informacoes_adicionais ?? "",
  ].filter(Boolean) as string[];
  const r = extrairRegrasJurosMulta(textos);
  // Se a IA devolver o percentual como fração (ex.: 0.02 para 2%), normalizamos.
  // O valor base guarda o percentual como aparece no boleto; a divisão por 100
  // acontece apenas dentro da fórmula de cálculo.
  const normalizarPercentual = (n: number): number => (n > 0 && n < 1 ? n * 100 : n);
  if (!r.multa_tipo && typeof data.multa === "number" && data.multa > 0) {
    r.multa_tipo = "percentual";
    r.multa_valor = normalizarPercentual(data.multa);
  }
  if (!r.juros_tipo && typeof data.juros === "number" && data.juros > 0) {
    r.juros_tipo = "percentual_mensal";
    r.juros_valor = normalizarPercentual(data.juros);
  }
  return r;
}

export interface PreviewAtualizacao {
  calculo: CalculoAtualizado;
  regras: RegrasJurosMulta;
  temRegras: boolean;
}

export function preverAtualizacao(row: {
  vencimento: string | null;
  valor_documento: number | null;
  valor_cobrado: number | null;
  dados_json: BoletoData | null;
}): PreviewAtualizacao | null {
  if (!row.dados_json) return null;
  if (!boletoEstaVencido(row.vencimento)) return null;
  const regras = extrairRegrasCompletas(row.dados_json);
  const valorOriginal = Number(
    row.dados_json.valor_documento ??
      row.dados_json.valor_cobrado ??
      row.valor_documento ??
      row.valor_cobrado ??
      0,
  );
  const calculo = calcularValorAtualizadoBoleto({
    valorOriginal,
    vencimento: row.vencimento,
    dataAtual: getDataAtualBrasilia(),
    jurosTipo: regras.juros_tipo,
    jurosValor: regras.juros_valor,
    multaTipo: regras.multa_tipo,
    multaValor: regras.multa_valor,
  });
  return { calculo, regras, temRegras: !!(regras.multa_tipo || regras.juros_tipo) };
}

