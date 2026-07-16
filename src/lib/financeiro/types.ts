// Domain types for Central de Pagamentos CNAB.
// NOTE: as tabelas foram criadas via migration; até o próximo regen dos types
// do Supabase, os queries usam cast controlado (helpers em lib/financeiro/db.ts).

export type CnabAmbiente = "homologacao" | "producao";

export type CnabBatchStatus =
  | "rascunho"
  | "em_conferencia"
  | "validado"
  | "arquivo_gerado"
  | "enviado_banco"
  | "processado_parcial"
  | "processado"
  | "rejeitado"
  | "cancelado";

export type PaymentDocExtractStatus = "pendente" | "ok" | "erro" | "revisao";
export type PaymentDocConferenciaStatus = "pendente" | "conferido" | "aprovado" | "reprovado";
export type PaymentDocCnabStatus =
  | "nao_incluido"
  | "em_lote"
  | "em_arquivo"
  | "enviado"
  | "processado"
  | "rejeitado";

// Novos estados solicitados na Etapa 2 (existem também os legados acima)
export type PaymentDocExtractStatusV2 =
  | "aguardando_leitura"
  | "em_processamento"
  | "extraido"
  | "extracao_parcial"
  | "erro_leitura"
  | PaymentDocExtractStatus;

export type PaymentDocConferenciaStatusV2 =
  | "em_conferencia"
  | "correcao_solicitada"
  | PaymentDocConferenciaStatus;

export type PaymentDocCnabStatusV2 =
  | "nao_elegivel"
  | "pronto_para_lote"
  | "incluido_em_lote"
  | "arquivo_gerado"
  | "erro_bancario"
  | PaymentDocCnabStatus;

export type DocumentClassification =
  | "boleto_bancario"
  | "conta_convenio_tributo"
  | "nao_identificado"
  | "nao_suportado";

export type PaymentDocTipo =
  | "boleto" | "pix" | "ted" | "doc" | "tributo" | "concessionaria" | "veiculo" | "gps" | "outros";

export interface BankAccount {
  id: string;
  empresa_id: string | null;
  banco_codigo: string;
  banco_nome: string;
  agencia: string;
  conta: string;
  conta_dv: string | null;
  convenio: string | null;
  cedente_nome: string | null;
  ativo: boolean;
  is_demo: boolean;
}

export interface PaymentDocument {
  id: string;
  empresa_id: string | null;
  tipo: PaymentDocTipo;
  arquivo_nome: string | null;
  arquivo_url?: string | null;
  descricao: string | null;
  beneficiario_nome: string | null;
  beneficiario_documento: string | null;
  beneficiario_tipo_pessoa?: string | null;
  banco_emissor?: string | null;
  codigo_barras?: string | null;
  linha_digitavel?: string | null;
  numero_interno?: string | null;
  numero_documento?: string | null;
  nosso_numero?: string | null;
  categoria?: string | null;
  centro_custo?: string | null;
  desconto?: number | null;
  abatimento?: number | null;
  juros?: number | null;
  multa?: number | null;
  valor_calculado?: number | null;
  classificacao_sugerida?: DocumentClassification | string | null;
  classificacao_confirmada?: DocumentClassification | string | null;
  hash_arquivo?: string | null;
  motivo_reprovacao?: string | null;
  review_notes?: string | null;
  observacao?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  vencimento: string | null;
  data_programada: string | null;
  valor_nominal: number | null;
  valor_final: number | null;
  status_extracao: PaymentDocExtractStatusV2;
  status_conferencia: PaymentDocConferenciaStatusV2;
  status_cnab: PaymentDocCnabStatusV2;
  responsavel_id: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface CnabBatch {
  id: string;
  nome_interno: string;
  empresa_id: string | null;
  bank_account_id: string | null;
  data_pagamento: string | null;
  ambiente: CnabAmbiente;
  status: CnabBatchStatus;
  quantidade_itens: number;
  valor_total: number;
  observacao: string | null;
  is_demo: boolean;
  created_at: string;
}

export const BATCH_STATUS_LABEL: Record<CnabBatchStatus, string> = {
  rascunho: "Rascunho",
  em_conferencia: "Em conferência",
  validado: "Validado",
  arquivo_gerado: "Arquivo gerado",
  enviado_banco: "Enviado ao banco",
  processado_parcial: "Processado parcial",
  processado: "Processado",
  rejeitado: "Rejeitado",
  cancelado: "Cancelado",
};

export const DOC_TIPO_LABEL: Record<PaymentDocTipo, string> = {
  boleto: "Boleto",
  pix: "PIX",
  ted: "TED",
  doc: "DOC",
  tributo: "Tributo",
  concessionaria: "Concessionária",
  veiculo: "Veículo",
  gps: "GPS",
  outros: "Outros",
};

export const CLASSIFICATION_LABEL: Record<DocumentClassification, string> = {
  boleto_bancario: "Boleto bancário",
  conta_convenio_tributo: "Conta / convênio / tributo",
  nao_identificado: "Não identificado",
  nao_suportado: "Não suportado nesta etapa",
};

export const REJECTION_REASONS: { value: string; label: string }[] = [
  { value: "documento_ilegivel", label: "Documento ilegível" },
  { value: "codigo_barras_invalido", label: "Código de barras inválido" },
  { value: "valor_divergente", label: "Valor divergente" },
  { value: "beneficiario_incorreto", label: "Beneficiário incorreto" },
  { value: "documento_duplicado", label: "Documento duplicado" },
  { value: "documento_vencido", label: "Documento vencido" },
  { value: "empresa_pagadora_incorreta", label: "Empresa pagadora incorreta" },
  { value: "documento_incompleto", label: "Documento incompleto" },
  { value: "outro", label: "Outro" },
];

export interface DocumentExtraction {
  id: string;
  payment_document_id: string;
  field_name: string;
  extracted_value: string | null;
  confidence_score: number | null;
  source_page: number | null;
  source_type: string | null;
  original_value: string | null;
  confirmed_value: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
}

export interface DocumentValidationIssue {
  id: string;
  payment_document_id: string;
  field_name: string | null;
  validation_code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  status: "aberto" | "resolvido" | "ignorado";
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface DocumentReview {
  id: string;
  payment_document_id: string;
  reviewer_id: string | null;
  review_status: string;
  rejection_reason: string | null;
  review_notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface DocumentChangeLog {
  id: string;
  payment_document_id: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
}