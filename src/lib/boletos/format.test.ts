import { describe, it, expect } from "vitest";
import { formatCurrencyBRL, formatDateBR, formatCpfCnpj, formatCep, tipoDocumentoLabel } from "./format";

describe("formatCurrencyBRL", () => {
  it("formata número em BRL", () => {
    // Uses non-breaking space between R$ and the number
    expect(formatCurrencyBRL(1234.5)).toMatch(/R\$\s?1\.234,50/);
  });
  it("retorna — para null/undefined/Infinity/NaN", () => {
    expect(formatCurrencyBRL(null)).toBe("—");
    expect(formatCurrencyBRL(undefined)).toBe("—");
    expect(formatCurrencyBRL(Number.NaN)).toBe("—");
    expect(formatCurrencyBRL(Infinity)).toBe("—");
  });
});

describe("formatDateBR", () => {
  it("converte YYYY-MM-DD em DD/MM/YYYY", () => {
    expect(formatDateBR("2026-07-13")).toBe("13/07/2026");
  });
  it("aceita ISO com tempo", () => {
    expect(formatDateBR("2026-07-13T10:00:00Z")).toBe("13/07/2026");
  });
  it("retorna — para vazio e original para formato inesperado", () => {
    expect(formatDateBR(null)).toBe("—");
    expect(formatDateBR("13/07/2026")).toBe("13/07/2026");
  });
});

describe("formatCpfCnpj", () => {
  it("formata CPF (11 dígitos)", () => {
    expect(formatCpfCnpj("12345678901")).toBe("123.456.789-01");
  });
  it("formata CNPJ (14 dígitos)", () => {
    expect(formatCpfCnpj("12345678000199")).toBe("12.345.678/0001-99");
  });
  it("retorna original quando o comprimento não bate", () => {
    expect(formatCpfCnpj("123")).toBe("123");
  });
  it("retorna — para vazio", () => {
    expect(formatCpfCnpj(null)).toBe("—");
  });
});

describe("formatCep", () => {
  it("formata CEP de 8 dígitos", () => {
    expect(formatCep("01310100")).toBe("01310-100");
  });
  it("retorna original para outros tamanhos", () => {
    expect(formatCep("123")).toBe("123");
    expect(formatCep(null)).toBe("—");
  });
});

describe("tipoDocumentoLabel", () => {
  it("mapeia códigos conhecidos", () => {
    expect(tipoDocumentoLabel("boleto_bancario")).toBe("Boleto bancário");
    expect(tipoDocumentoLabel("arrecadacao")).toBe("Guia de arrecadação");
  });
  it("retorna o valor original para desconhecido e Documento para vazio", () => {
    expect(tipoDocumentoLabel("xyz")).toBe("xyz");
    expect(tipoDocumentoLabel(null)).toBe("Documento");
  });
});