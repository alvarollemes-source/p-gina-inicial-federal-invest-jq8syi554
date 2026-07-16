import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizarCodigo, formatarLinhaDigitavel, copiarCodigo } from "./normalize";

describe("normalizarCodigo", () => {
  it.each([
    [null, ""],
    [undefined, ""],
    ["", ""],
    ["abc", ""],
    ["1 2.3-4", "1234"],
  ])("normaliza %p → %p", (input, expected) => {
    expect(normalizarCodigo(input as string | null | undefined)).toBe(expected);
  });
});

describe("formatarLinhaDigitavel", () => {
  it("formata linha bancária de 47 dígitos", () => {
    const out = formatarLinhaDigitavel("23793381286000782713695000063305989100000026035");
    expect(out).toBe("23793.38128 60007.827136 95000.063305 9 89100000026035");
  });
  it("formata linha de arrecadação de 48 dígitos em 4 blocos", () => {
    const out = formatarLinhaDigitavel("836100000014929700220668001012026108316365725225");
    expect(out.split(" ")).toHaveLength(4);
  });
  it("retorna dígitos crus quando o tamanho é desconhecido", () => {
    expect(formatarLinhaDigitavel("123")).toBe("123");
  });
  it("aceita null/undefined", () => {
    expect(formatarLinhaDigitavel(null)).toBe("");
  });
});

describe("copiarCodigo", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("usa navigator.clipboard quando disponível", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copiarCodigo("12-34");
    expect(writeText).toHaveBeenCalledWith("1234");
  });

  it("lança erro quando o código é vazio", async () => {
    await expect(copiarCodigo("")).rejects.toThrow(/Nenhum código/);
  });
});