export type BoletoErrorCode =
  | "arquivo_nao_suportado"
  | "arquivo_muito_grande"
  | "pdf_protegido"
  | "pdf_sem_paginas"
  | "codigo_ilegivel"
  | "codigo_incompleto"
  | "linha_invalida"
  | "erro_ocr"
  | "erro_ia"
  | "nao_reconhecido"
  | "falha_temporaria";

export const ERRORS: Record<BoletoErrorCode, string> = {
  arquivo_nao_suportado: "Formato de arquivo não suportado. Envie PDF, JPG, JPEG ou PNG.",
  arquivo_muito_grande: "Arquivo muito grande. O limite é de 15 MB por boleto.",
  pdf_protegido: "Este PDF está protegido por senha e não pôde ser aberto.",
  pdf_sem_paginas: "O documento enviado não possui páginas legíveis.",
  codigo_ilegivel: "Não foi possível ler o código de barras do documento.",
  codigo_incompleto: "O código encontrado está incompleto — confira o boleto original.",
  linha_invalida: "A linha digitável identificada não passou na validação dos dígitos verificadores.",
  erro_ocr: "Falha ao extrair o texto do documento. Tente uma imagem mais nítida.",
  erro_ia: "O serviço de leitura inteligente está indisponível no momento.",
  nao_reconhecido: "Este documento não parece ser um boleto ou guia de arrecadação.",
  falha_temporaria: "Falha temporária no processamento. Tente novamente em alguns instantes.",
};

export class BoletoError extends Error {
  code: BoletoErrorCode;
  constructor(code: BoletoErrorCode, message?: string) {
    super(message ?? ERRORS[code]);
    this.code = code;
  }
}