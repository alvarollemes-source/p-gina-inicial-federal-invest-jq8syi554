import { describe, it, expect } from "vitest";
import { formatarLinhaDigitavel } from "./normalize";
import {
  mod10,
  mod11Boleto,
  mod11Arrecadacao,
  validaLinhaDigitavelBancaria,
  validaLinhaArrecadacao,
  validaBarrasBancario,
  linhaBancariaParaBarras,
  barrasParaLinhaBancaria,
  linhaArrecadacaoParaBarras,
  extrairInfoBarrasBancario,
  classificarCodigo,
  extrairCandidatosLinha,
  extrairLinhaDoTexto,
  nomeBanco,
} from "./validate";

// Valid arrecadação sample (real boleto do usuário)
const LINHA_ARRECADACAO = "836100000014929700220668001012026108316365725225";

// Build a mathematically-valid bank barcode + linha digitável from primitives.
// Structure: banco(3) + moeda(1) + DV(1) + fator(4) + valor(10) + campoLivre(25)
function makeBarras(banco = "237", moeda = "9", fator = "8910", valor10 = "0000026035", campoLivre = "0000078271369500000633059"): string {
  const base = banco + moeda + fator + valor10 + campoLivre; // 43 digits, DV placeholder omitted
  // Compute mod 11 DV over base with 0 at DV position, i.e. base itself as "sem DV".
  const dv = mod11Boleto(base);
  return banco + moeda + String(dv) + fator + valor10 + campoLivre;
}
const BARRAS_BANCARIO = makeBarras();
const LINHA_BANCARIA = barrasParaLinhaBancaria(BARRAS_BANCARIO);

describe("mod10", () => {
  it("computes canonical FEBRABAN examples", () => {
    // Reference: "51234" → weights 2,1,2,1,2 right→left = 8+3+4+1+(10→1) = 17 → DV=3
    expect(mod10("51234")).toBe(3);
  });
  it("returns 0 for empty input", () => {
    expect(mod10("")).toBe(0);
  });
  it("ignores non-digits", () => {
    expect(mod10("5-1-2-3-4")).toBe(3);
  });
});

describe("mod11Boleto", () => {
  it("maps DV of 0/10/11 to 1", () => {
    // Constructed edge: repeat digit yielding resto 11
    expect(mod11Boleto("0")).toBe(1);
  });
  it("computes DV for the sample bank line", () => {
    const barras = linhaBancariaParaBarras(LINHA_BANCARIA);
    const semDv = barras.slice(0, 4) + barras.slice(5);
    expect(mod11Boleto(semDv)).toBe(Number(barras[4]));
  });
});

describe("mod11Arrecadacao", () => {
  it("maps DV of 0/10/11 to 0 (arrecadação rule)", () => {
    expect(mod11Arrecadacao("0")).toBe(0);
  });
});

describe("validaLinhaDigitavelBancaria", () => {
  it("aceita linha válida", () => {
    const r = validaLinhaDigitavelBancaria(LINHA_BANCARIA);
    expect(r.valido).toBe(true);
    expect(r.erros).toEqual([]);
  });
  it("aceita linha formatada com pontos e espaços", () => {
    const formatted = formatarLinhaDigitavel(LINHA_BANCARIA);
    expect(validaLinhaDigitavelBancaria(formatted).valido).toBe(true);
  });
  it("rejeita tamanho inválido", () => {
    const r = validaLinhaDigitavelBancaria("123");
    expect(r.valido).toBe(false);
    expect(r.erros[0]).toMatch(/47/);
  });
  it("detecta DV do campo 1 inválido", () => {
    // Troca DV do campo 1 (posição 9)
    const bad = LINHA_BANCARIA.slice(0, 9) + "0" + LINHA_BANCARIA.slice(10);
    const r = validaLinhaDigitavelBancaria(bad);
    expect(r.valido).toBe(false);
    expect(r.erros.some((e) => e.includes("1º campo"))).toBe(true);
  });
});

describe("validaLinhaArrecadacao", () => {
  it("aceita a linha real de arrecadação do usuário", () => {
    const r = validaLinhaArrecadacao(LINHA_ARRECADACAO);
    expect(r.valido).toBe(true);
  });
  it("rejeita tamanho inválido", () => {
    expect(validaLinhaArrecadacao("111").valido).toBe(false);
  });
  it("rejeita se não começa com 8", () => {
    const bad = "9" + LINHA_ARRECADACAO.slice(1);
    const r = validaLinhaArrecadacao(bad);
    expect(r.valido).toBe(false);
    expect(r.erros.some((e) => e.includes("começar com 8"))).toBe(true);
  });
});

describe("conversões linha ↔ barras", () => {
  it("linhaBancariaParaBarras produz 44 dígitos", () => {
    const b = linhaBancariaParaBarras(LINHA_BANCARIA);
    expect(b).toHaveLength(44);
  });
  it("barrasParaLinhaBancaria é inverso de linhaBancariaParaBarras", () => {
    const b = linhaBancariaParaBarras(LINHA_BANCARIA);
    expect(barrasParaLinhaBancaria(b)).toBe(LINHA_BANCARIA);
  });
  it("retorna string vazia para tamanhos inválidos", () => {
    expect(linhaBancariaParaBarras("123")).toBe("");
    expect(barrasParaLinhaBancaria("123")).toBe("");
    expect(linhaArrecadacaoParaBarras("123")).toBe("");
  });
  it("linhaArrecadacaoParaBarras remove os 4 DVs de bloco", () => {
    expect(linhaArrecadacaoParaBarras(LINHA_ARRECADACAO)).toHaveLength(44);
  });
});

describe("validaBarrasBancario", () => {
  it("aceita barras derivadas de linha válida", () => {
    const b = linhaBancariaParaBarras(LINHA_BANCARIA);
    expect(validaBarrasBancario(b).valido).toBe(true);
  });
  it("rejeita comprimento incorreto", () => {
    expect(validaBarrasBancario("123").valido).toBe(false);
  });
});

describe("extrairInfoBarrasBancario", () => {
  it("extrai banco, moeda, valor e vencimento", () => {
    const b = linhaBancariaParaBarras(LINHA_BANCARIA);
    const info = extrairInfoBarrasBancario(b);
    expect(info.banco).toBe("237");
    expect(info.moeda).toBe("9");
    expect(info.valor).toBeCloseTo(260.35, 2);
    expect(info.vencimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("retorna nulls para tamanho inválido", () => {
    const info = extrairInfoBarrasBancario("123");
    expect(info.banco).toBeNull();
    expect(info.valor).toBeNull();
  });
});

describe("classificarCodigo", () => {
  it.each([
    [LINHA_BANCARIA, "linha_bancaria"],
    [LINHA_ARRECADACAO, "linha_arrecadacao"],
    [linhaBancariaParaBarras(LINHA_BANCARIA), "barras_bancario"],
    [linhaArrecadacaoParaBarras(LINHA_ARRECADACAO), "barras_arrecadacao"],
    ["12345", "desconhecido"],
  ])("classifica %s corretamente", (input, expected) => {
    expect(classificarCodigo(input)).toBe(expected);
  });
});

describe("extrairCandidatosLinha", () => {
  it("acha candidato bancário em texto ruidoso", () => {
    const texto = `Boleto vencimento 01/01/2027\nLinha: ${LINHA_BANCARIA}\nvalor R$ 260,35`;
    const cs = extrairCandidatosLinha(texto);
    expect(cs.some((c) => c.tipo === "bancaria" && c.linha === LINHA_BANCARIA)).toBe(true);
  });
  it("acha candidato de arrecadação em texto ruidoso", () => {
    const texto = `Guia: ${LINHA_ARRECADACAO} — pagar até 10/01`;
    const cs = extrairCandidatosLinha(texto);
    expect(cs.some((c) => c.tipo === "arrecadacao")).toBe(true);
  });
  it("retorna [] para vazio", () => {
    expect(extrairCandidatosLinha("")).toEqual([]);
  });
  it("deduplica candidatos", () => {
    const cs = extrairCandidatosLinha(`${LINHA_BANCARIA} ${LINHA_BANCARIA}`);
    const banc = cs.filter((c) => c.linha === LINHA_BANCARIA && c.tipo === "bancaria");
    expect(banc).toHaveLength(1);
  });
});

describe("extrairLinhaDoTexto", () => {
  it("prioriza o primeiro candidato VÁLIDO mesmo com lixo antes", () => {
    const texto = `12345 lixo ${LINHA_ARRECADACAO} rodapé`;
    const c = extrairLinhaDoTexto(texto);
    expect(c?.tipo).toBe("arrecadacao");
    expect(c?.linha).toBe(LINHA_ARRECADACAO);
  });
  it("retorna null se não achar nada", () => {
    expect(extrairLinhaDoTexto("sem números aqui")).toBeNull();
  });
});

describe("nomeBanco", () => {
  it("mapeia códigos conhecidos", () => {
    expect(nomeBanco("341")).toBe("Itaú");
    expect(nomeBanco("237")).toBe("Bradesco");
  });
  it("preenche com zeros à esquerda", () => {
    expect(nomeBanco("1")).toBe("Banco do Brasil");
  });
  it("retorna null para desconhecido ou vazio", () => {
    expect(nomeBanco("999")).toBeNull();
    expect(nomeBanco(null)).toBeNull();
    expect(nomeBanco(undefined)).toBeNull();
  });
});