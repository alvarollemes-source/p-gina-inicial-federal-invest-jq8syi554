import * as XLSX from "xlsx";

export function getDataAtualBrasiliaFormatada(): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return fmt.format(new Date());
}

export function formatValorFace(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  if (!isFinite(v)) return "0.00";
  return v.toFixed(2);
}

export function limparCodigoBarras(s: string | null | undefined): string {
  return String(s ?? "").replace(/\D+/g, "");
}

export type APRow = {
  id: string;
  beneficiario_nome?: string | null;
  pagador_nome?: string | null;
  valor_cobrado?: number | null;
  valor_documento?: number | null;
  vencimento?: string | null;
  empresa_nome?: string | null;
  tipo_pagamento?: string | null;
  dados_json?: any;
  dados_pagamento?: Record<string, any> | null;
};

const AP_HEADERS = [
  "TIPO",
  "LEITORA",
  "NÚMERO",
  "SACADO",
  "VENCIMENTO",
  "VALOR FACE",
  "NOME SACADO",
  "ENDEREÇO",
  "NÚMERO END",
  "COMPLEMENTO",
  "BAIRRO",
  "CIDADE",
  "EMAIL",
  "LINHA DIGITÁVEL",
  "TELEFONE",
  "CHAVE PIX",
  "BANCO",
  "AGÊNCIA",
  "CONTA",
  "DV CONTA",
  "OBSERVAÇÃO",
];

function unwrap(v: any): any {
  if (v && typeof v === "object" && "valor" in v) return (v as any).valor;
  return v;
}

export function mapTipoPagamento(r: APRow): string {
  const t = (r.tipo_pagamento ?? "boleto").toLowerCase();
  const dp = (r.dados_pagamento ?? {}) as Record<string, any>;
  if (t === "boleto") return "DMR";
  if (t === "pix") return "PIX";
  if (t === "transferencia" || t === "ted") return "TED";
  if (t === "debito_veiculo") return "IPVA";
  if (t === "imposto") {
    const sub = String(dp.subtipo ?? dp.tipo_imposto ?? "").toUpperCase();
    if (["DARF", "DAM", "DAE", "IPVA", "IPTU"].includes(sub)) return sub;
    return "OUT";
  }
  return t.toUpperCase();
}

export function mapPagamentoParaLinhaAP(r: APRow): Record<string, string> {
  const dj = (r.dados_json ?? {}) as Record<string, any>;
  const dp = (r.dados_pagamento ?? {}) as Record<string, any>;
  const pagador = (dj.pagador ?? {}) as Record<string, any>;
  const endereco = (pagador.endereco ?? {}) as Record<string, any>;
  const banco = (dj.banco ?? {}) as Record<string, any>;
  const atualizacao = (dj.atualizacao ?? {}) as Record<string, any>;

  const tipo = mapTipoPagamento(r);
  const isPix = tipo === "PIX";
  const isTed = tipo === "TED";
  const isBoleto = tipo === "DMR";

  const valorOriginal = Number(r.valor_cobrado ?? r.valor_documento ?? 0);
  const valorAtualizado = atualizacao?.aplicada
    ? Number(atualizacao.valor_atualizado ?? valorOriginal)
    : valorOriginal;

  const documentoSacado =
    unwrap(pagador.documento) ?? dp.documento_pagador ?? "";
  const nomeSacado = unwrap(pagador.nome) ?? r.pagador_nome ?? "";

  const cidade = unwrap(endereco.cidade) ?? "";
  const uf = unwrap(endereco.estado) ?? unwrap(endereco.uf) ?? "";
  const cidadeUf = cidade && uf ? `${cidade} / ${uf}` : cidade || "";

  const linhaDigitavel = limparCodigoBarras(
    unwrap(dj.codigo_barras) ?? unwrap(dj.linha_digitavel) ?? ""
  );

  const bancoNome = isBoleto
    ? String(unwrap(banco.nome) ?? "")
    : String(dp.banco ?? "");

  const observacao = atualizacao?.aplicada
    ? `Boleto vencido atualizado com juros/multa. Valor original: ${formatValorFace(valorOriginal)}`
    : "";

  return {
    TIPO: tipo,
    LEITORA: "",
    "NÚMERO": String(r.empresa_nome ?? ""),
    SACADO: String(documentoSacado ?? ""),
    VENCIMENTO: getDataAtualBrasiliaFormatada(),
    "VALOR FACE": formatValorFace(valorAtualizado),
    "NOME SACADO": String(nomeSacado ?? ""),
    "ENDEREÇO": String(unwrap(endereco.logradouro) ?? unwrap(endereco.endereco) ?? ""),
    "NÚMERO END": String(unwrap(endereco.numero) ?? ""),
    COMPLEMENTO: String(unwrap(endereco.complemento) ?? ""),
    BAIRRO: String(unwrap(endereco.bairro) ?? ""),
    CIDADE: cidadeUf,
    EMAIL: String(unwrap(pagador.email) ?? ""),
    "LINHA DIGITÁVEL": linhaDigitavel,
    TELEFONE: String(unwrap(pagador.telefone) ?? ""),
    "CHAVE PIX": isPix ? String(dp.chave_pix ?? "") : "",
    BANCO: bancoNome,
    "AGÊNCIA": isTed || isPix ? String(dp.agencia ?? "") : "",
    CONTA: isTed || isPix ? String(dp.conta ?? "") : "",
    "DV CONTA": isTed || isPix ? String(dp.dv_conta ?? dp.digito_conta ?? "") : "",
    "OBSERVAÇÃO": observacao,
  };
}

export function gerarArquivoExcelAP(rows: APRow[]): Blob {
  const body = rows.map((r) => {
    const linha = mapPagamentoParaLinhaAP(r);
    return AP_HEADERS.map((h) => linha[h] ?? "");
  });
  const ws = XLSX.utils.aoa_to_sheet([AP_HEADERS, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "AP");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function baixarExcelAP(rows: APRow[], filename = "ModeloAP.xlsx") {
  const blob = gerarArquivoExcelAP(rows);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportarPagamentosAP(rows: APRow[]) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  baixarExcelAP(rows, `Pagamentos_AP_${stamp}.xlsx`);
}
