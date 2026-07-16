import { normalizarCodigo } from "./normalize";

/**
 * Módulo 10 (padrão FEBRABAN): pesos alternando 2 e 1 da direita p/ esquerda,
 * soma dos dígitos dos produtos, DV = (10 - soma%10) % 10.
 */
export function mod10(input: string): number {
  const digits = input.replace(/\D/g, "");
  let peso = 2;
  let soma = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    let mult = Number(digits[i]) * peso;
    if (mult > 9) mult = Math.floor(mult / 10) + (mult % 10);
    soma += mult;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

/**
 * Módulo 11 (padrão FEBRABAN): pesos 2..9 ciclicamente, DV = 11 - soma%11.
 * Para boleto bancário: DV geral: 0,10,11 → 1. Para arrecadação: 0/10/11 → 0 (modalidade "mod 11 arrecadação").
 */
export function mod11Boleto(input: string): number {
  const digits = input.replace(/\D/g, "");
  let peso = 2;
  let soma = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    soma += Number(digits[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  if (dv === 0 || dv === 10 || dv === 11) return 1;
  return dv;
}

export function mod11Arrecadacao(input: string): number {
  const digits = input.replace(/\D/g, "");
  let peso = 2;
  let soma = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    soma += Number(digits[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  if (dv === 0 || dv === 10 || dv === 11) return 0;
  return dv;
}

/** Valida os 3 DVs mod10 dos campos + DV geral mod11 (posição 4 → 33) de uma linha digitável de 47 dígitos. */
export function validaLinhaDigitavelBancaria(linha: string): {
  valido: boolean;
  erros: string[];
} {
  const s = normalizarCodigo(linha);
  const erros: string[] = [];
  if (s.length !== 47) {
    return { valido: false, erros: ["Linha digitável precisa ter 47 dígitos."] };
  }
  // Campo 1: pos 0-9 (10 dígitos) - DV na pos 9
  const c1 = s.slice(0, 9);
  const dv1 = Number(s[9]);
  if (mod10(c1) !== dv1) erros.push("DV do 1º campo (mod 10) inválido.");
  // Campo 2: pos 10-20 (11 dígitos) - DV na pos 20
  const c2 = s.slice(10, 20);
  const dv2 = Number(s[20]);
  if (mod10(c2) !== dv2) erros.push("DV do 2º campo (mod 10) inválido.");
  // Campo 3: pos 21-31 (11 dígitos) - DV na pos 31
  const c3 = s.slice(21, 31);
  const dv3 = Number(s[31]);
  if (mod10(c3) !== dv3) erros.push("DV do 3º campo (mod 10) inválido.");
  // DV geral mod11 → pos 32
  const barras = linhaBancariaParaBarras(s);
  const dvGeral = Number(barras[4]);
  const semDv = barras.slice(0, 4) + barras.slice(5);
  if (mod11Boleto(semDv) !== dvGeral) erros.push("DV geral (mod 11) inválido.");
  return { valido: erros.length === 0, erros };
}

/** Converte linha digitável bancária (47) em código de barras (44). */
export function linhaBancariaParaBarras(linha: string): string {
  const s = normalizarCodigo(linha);
  if (s.length !== 47) return "";
  // Estrutura da linha:
  // Campo 1: BBBBB.CCCCD (0-9)  → banco(3) + moeda(1) + 5 primeiros do "campo livre"
  //    banco = s[0..2], moeda = s[3], AAAAA = s[4..8]
  // Campo 2: DDDDDD.DDDDDD D2 (10-20) → 10 do campo livre (11º é DV do campo)
  // Campo 3: DDDDDD.DDDDDD D3 (21-31)
  // Pos 32 = DV geral
  // Campos 33-46 = fator vencimento (4) + valor (10)
  const banco = s.slice(0, 3);
  const moeda = s.slice(3, 4);
  const dvGeral = s.slice(32, 33);
  const fatorValor = s.slice(33, 47);
  const campoLivre =
    s.slice(4, 9) + s.slice(10, 20) + s.slice(21, 31); // 5 + 10 + 10 = 25
  return banco + moeda + dvGeral + fatorValor + campoLivre; // 3+1+1+14+25=44
}

/** Converte código de barras bancário (44) em linha digitável (47). */
export function barrasParaLinhaBancaria(barras: string): string {
  const s = normalizarCodigo(barras);
  if (s.length !== 44) return "";
  const banco = s.slice(0, 3);
  const moeda = s.slice(3, 4);
  const dvGeral = s.slice(4, 5);
  const fatorValor = s.slice(5, 19);
  const campoLivre = s.slice(19, 44); // 25 dígitos
  const cl1 = campoLivre.slice(0, 5);
  const cl2 = campoLivre.slice(5, 15);
  const cl3 = campoLivre.slice(15, 25);
  const c1 = banco + moeda + cl1;
  const c2 = cl2.slice(0, 10);
  const c3 = cl3.slice(0, 10);
  const dv1 = mod10(c1);
  const dv2 = mod10(c2);
  const dv3 = mod10(c3);
  return `${c1}${dv1}${c2}${dv2}${c3}${dv3}${dvGeral}${fatorValor}`;
}

/** Valida um código de barras bancário de 44 dígitos (DV geral mod 11). */
export function validaBarrasBancario(barras: string): { valido: boolean; erros: string[] } {
  const s = normalizarCodigo(barras);
  if (s.length !== 44) return { valido: false, erros: ["Código de barras precisa ter 44 dígitos."] };
  const dv = Number(s[4]);
  const semDv = s.slice(0, 4) + s.slice(5);
  if (mod11Boleto(semDv) !== dv) return { valido: false, erros: ["DV geral do código de barras (mod 11) inválido."] };
  return { valido: true, erros: [] };
}

/** Valida linha digitável de arrecadação (48 dígitos, começa com 8). */
export function validaLinhaArrecadacao(linha: string): { valido: boolean; erros: string[] } {
  const s = normalizarCodigo(linha);
  const erros: string[] = [];
  if (s.length !== 48) return { valido: false, erros: ["Linha de arrecadação precisa ter 48 dígitos."] };
  if (s[0] !== "8") erros.push("Linha de arrecadação deve começar com 8.");
  const idMoeda = Number(s[2]);
  const usaMod11 = idMoeda === 8 || idMoeda === 9;
  const dvFn = usaMod11 ? mod11Arrecadacao : mod10;
  // 4 blocos de 12; último dígito de cada bloco é DV
  for (let i = 0; i < 4; i++) {
    const bloco = s.slice(i * 12, (i + 1) * 12);
    const base = bloco.slice(0, 11);
    const dv = Number(bloco[11]);
    if (dvFn(base) !== dv) erros.push(`DV do bloco ${i + 1} inválido.`);
  }
  return { valido: erros.length === 0, erros };
}

/** Converte linha de arrecadação (48) em código de barras (44). Estrutura: retira os 4 DVs de bloco. */
export function linhaArrecadacaoParaBarras(linha: string): string {
  const s = normalizarCodigo(linha);
  if (s.length !== 48) return "";
  // Blocos de 12, dígito 11 (índice) é DV; concatena posições 0..10 de cada bloco = 44
  let out = "";
  for (let i = 0; i < 4; i++) out += s.slice(i * 12, i * 12 + 11);
  return out;
}

/**
 * Extrai informações do código de barras bancário (44 dígitos): banco, moeda, fator vencimento, valor.
 */
export function extrairInfoBarrasBancario(barras: string): {
  banco: string | null;
  moeda: string | null;
  fatorVencimento: number | null;
  vencimento: string | null;
  valor: number | null;
} {
  const s = normalizarCodigo(barras);
  if (s.length !== 44) return { banco: null, moeda: null, fatorVencimento: null, vencimento: null, valor: null };
  const banco = s.slice(0, 3);
  const moeda = s.slice(3, 4);
  const fator = Number(s.slice(5, 9));
  const valorNum = Number(s.slice(9, 19)) / 100;
  // Fator de vencimento: base 07/10/1997 = fator 1000. A partir de 22/02/2025 (fator 10000) o ciclo continua.
  // Implementação simples: base 1000 = 07/10/1997.
  let venc: string | null = null;
  if (fator > 0) {
    const base = new Date(Date.UTC(1997, 9, 7));
    const days = fator - 1000;
    const d = new Date(base.getTime() + days * 86400_000);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      venc = `${y}-${m}-${day}`;
    }
  }
  return {
    banco,
    moeda,
    fatorVencimento: fator,
    vencimento: venc,
    valor: isFinite(valorNum) ? valorNum : null,
  };
}

/** Tenta detectar automaticamente que tipo de código é o valor informado (44/47/48). */
export function classificarCodigo(valor: string): "barras_bancario" | "linha_bancaria" | "linha_arrecadacao" | "barras_arrecadacao" | "desconhecido" {
  const s = normalizarCodigo(valor);
  if (s.length === 44 && s[0] !== "8") return "barras_bancario";
  if (s.length === 44 && s[0] === "8") return "barras_arrecadacao";
  if (s.length === 47) return "linha_bancaria";
  if (s.length === 48 && s[0] === "8") return "linha_arrecadacao";
  return "desconhecido";
}

/**
 * Regex para localizar linha digitável em texto extraído de PDF.
 * Aceita a versão formatada (com pontos/espaços) ou 47/48 dígitos corridos.
 */
export type LinhaCandidato = { linha: string; tipo: "bancaria" | "arrecadacao" };

/**
 * Coleta TODOS os candidatos a linha digitável no texto — bancária (47) e
 * arrecadação (48) — sem descartar por ordem. O chamador valida cada um.
 */
export function extrairCandidatosLinha(texto: string): LinhaCandidato[] {
  const out: LinhaCandidato[] = [];
  const seen = new Set<string>();
  const push = (linha: string, tipo: "bancaria" | "arrecadacao") => {
    const key = `${tipo}:${linha}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ linha, tipo });
  };
  if (!texto) return out;

  // 1. Arrecadação formatada: 4 blocos de 12 dígitos começando com 8.
  const reArr = /(8\d{11})[\s.\-]{0,3}(\d{12})[\s.\-]{0,3}(\d{12})[\s.\-]{0,3}(\d{12})/g;
  for (const m of texto.matchAll(reArr)) {
    const s = m.slice(1).join("").replace(/\D/g, "");
    if (s.length === 48) push(s, "arrecadacao");
  }

  // 2. Bancária formatada: 5+5 . 5+6 . 5+6 . 1 . 14 (não começa com 8).
  const reBanc =
    /(\d{5})[.\s\-]?(\d{5})[\s]{0,3}(\d{5})[.\s\-]?(\d{6})[\s]{0,3}(\d{5})[.\s\-]?(\d{6})[\s]{0,3}(\d)[\s]{0,3}(\d{14})/g;
  for (const m of texto.matchAll(reBanc)) {
    const s = m.slice(1).join("").replace(/\D/g, "");
    if (s.length === 47 && s[0] !== "8") push(s, "bancaria");
  }

  // 3. Varredura no fluxo puro de dígitos — pega qualquer sequência longa.
  const nums = texto.replace(/\D/g, "");
  // Arrecadação: 48 dígitos começando com 8 (janela deslizante).
  for (let i = 0; i + 48 <= nums.length; i++) {
    if (nums[i] !== "8") continue;
    push(nums.slice(i, i + 48), "arrecadacao");
  }
  // Bancária: 47 dígitos que não comecem com 8.
  for (let i = 0; i + 47 <= nums.length; i++) {
    if (nums[i] === "8") continue;
    push(nums.slice(i, i + 47), "bancaria");
  }

  return out;
}

/**
 * Compatibilidade: devolve o primeiro candidato VÁLIDO (Mod 10 / Mod 11).
 * Se nenhum validar, devolve o primeiro candidato encontrado (para permitir
 * edição manual) ou null.
 */
export function extrairLinhaDoTexto(
  texto: string,
): LinhaCandidato | null {
  const candidatos = extrairCandidatosLinha(texto);
  if (candidatos.length === 0) return null;
  for (const c of candidatos) {
    const v =
      c.tipo === "bancaria"
        ? validaLinhaDigitavelBancaria(c.linha)
        : validaLinhaArrecadacao(c.linha);
    if (v.valido) return c;
  }
  return candidatos[0];
}

/**
 * Nomes de bancos conhecidos (código FEBRABAN → nome curto).
 */
const BANCOS: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "070": "BRB",
  "077": "Inter",
  "104": "Caixa Econômica Federal",
  "133": "Cresol",
  "136": "Unicred",
  "212": "Banco Original",
  "237": "Bradesco",
  "260": "Nu Pagamentos",
  "290": "PagBank",
  "323": "Mercado Pago",
  "336": "C6 Bank",
  "341": "Itaú",
  "356": "Banco Real",
  "389": "Mercantil do Brasil",
  "399": "HSBC",
  "422": "Safra",
  "745": "Citibank",
  "748": "Sicredi",
  "756": "Sicoob",
};

export function nomeBanco(codigo: string | null | undefined): string | null {
  if (!codigo) return null;
  const k = codigo.padStart(3, "0");
  return BANCOS[k] ?? null;
}