import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { convertToOfx } from "./convert";

function buildXlsxFile(rows: Array<Record<string, unknown>>): File {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Extrato");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new File([buf], "extrato.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("convertToOfx", () => {
  it("converte extrato com coluna valor (crédito e débito)", async () => {
    const file = buildXlsxFile([
      { Data: "01/07/2026", Descricao: "Depósito", Valor: "1.234,56" },
      { Data: "02/07/2026", Descricao: "Pagamento", Valor: "-100,00" },
      { Data: "03/07/2026", Descricao: "Compra", Valor: "(50,00)" }, // parênteses → negativo
    ]);
    const r = await convertToOfx(file);
    expect(r.lancamentos).toHaveLength(3);
    expect(r.totalCreditos).toBeCloseTo(1234.56, 2);
    expect(r.totalDebitos).toBeCloseTo(150, 2);
    expect(r.saldoFinal).toBeCloseTo(1084.56, 2);
    expect(r.ofx).toContain("<TRNTYPE>CREDIT</TRNTYPE>");
    expect(r.ofx).toContain("<TRNTYPE>DEBIT</TRNTYPE>");
    expect(r.ofx).toContain("<CURDEF>BRL</CURDEF>");
    expect(r.ofx).toContain("<DTPOSTED>20260701</DTPOSTED>");
  });

  it("suporta colunas separadas de crédito/débito", async () => {
    const file = buildXlsxFile([
      { Data: "10/01/2026", Historico: "Salário", Credito: "5000,00", Debito: "" },
      { Data: "11/01/2026", Historico: "Aluguel", Credito: "", Debito: "1500,00" },
    ]);
    const r = await convertToOfx(file);
    expect(r.lancamentos).toHaveLength(2);
    expect(r.totalCreditos).toBeCloseTo(5000, 2);
    expect(r.totalDebitos).toBeCloseTo(1500, 2);
  });

  it("descarta linhas sem data ou com valor zero", async () => {
    const file = buildXlsxFile([
      { Data: "", Descricao: "sem data", Valor: "10,00" },
      { Data: "01/01/2026", Descricao: "zero", Valor: "0,00" },
      { Data: "02/01/2026", Descricao: "válido", Valor: "10,00" },
    ]);
    const r = await convertToOfx(file);
    expect(r.lancamentos).toHaveLength(1);
    expect(r.lancamentos[0].descricao).toBe("válido");
  });

  it("lança erro quando a coluna de data está ausente", async () => {
    const file = buildXlsxFile([{ Foo: "bar", Valor: "10,00" }]);
    await expect(convertToOfx(file)).rejects.toThrow(/data/i);
  });

  it("lança erro para planilha sem lançamentos válidos", async () => {
    const file = buildXlsxFile([{ Data: "01/01/2026", Valor: "0,00" }]);
    await expect(convertToOfx(file)).rejects.toThrow(/lançamento/i);
  });

  it("escapa caracteres XML na descrição", async () => {
    const file = buildXlsxFile([
      { Data: "01/01/2026", Descricao: "A & B <x>", Valor: "10,00" },
    ]);
    const r = await convertToOfx(file);
    expect(r.ofx).toContain("A &amp; B &lt;x&gt;");
  });
});