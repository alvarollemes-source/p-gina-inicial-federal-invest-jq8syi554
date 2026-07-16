export type Origem = "leitura_visual" | "texto_pdf" | "ia" | "usuario";

export type StatusValidacao =
  | "valido"
  | "requer_conferencia"
  | "invalido"
  | "nao_identificado";

export interface CodigoInfo {
  valor: string | null;
  quantidade_digitos: number;
  origem: Origem | null;
  valido: boolean;
}

export interface Pessoa {
  nome: string | null;
  documento: string | null;
  tipo_documento: "CPF" | "CNPJ" | null;
  endereco: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
}

export interface GpsInfo {
  codigo_pagamento: string | null;
  competencia: string | null;
  identificador: string | null;
  valor_inss: number | null;
  valor_outras_entidades: number | null;
  atm_multa_juros: number | null;
  valor_total: number | null;
}

export interface BoletoData {
  tipo_documento: string | null;
  arquivo: {
    nome: string;
    tipo: string;
    quantidade_paginas: number;
  };
  banco: {
    codigo: string | null;
    nome: string | null;
  };
  codigo_barras: CodigoInfo;
  linha_digitavel: CodigoInfo;
  beneficiario: Pessoa;
  pagador: Pessoa;
  vencimento: string | null;
  valor_documento: number | null;
  valor_cobrado: number | null;
  data_documento: string | null;
  data_processamento: string | null;
  numero_documento: string | null;
  nosso_numero: string | null;
  agencia_codigo_beneficiario: string | null;
  carteira: string | null;
  especie: string | null;
  aceite: string | null;
  instrucoes: string[];
  juros: number | null;
  multa: number | null;
  desconto: number | null;
  outras_deducoes: number | null;
  outros_acrescimos: number | null;
  referencia: string | null;
  numero_instalacao: string | null;
  nota_fiscal: string | null;
  chave_nota_fiscal: string | null;
  informacoes_adicionais: string | null;
  gps: GpsInfo | null;
  confianca: {
    geral: number;
    codigo_barras: number;
    linha_digitavel: number;
    valor: number;
    vencimento: number;
    [k: string]: number;
  };
  validacao: {
    status: StatusValidacao;
    erros: string[];
    alertas: string[];
  };
  texto_original: string;
  atualizacao?: {
    aplicada: boolean;
    origem_dos_dados: "instrucoes_boleto" | "preenchimento_manual";
    valor_original: number;
    valor_atualizado: number;
    dias_atraso: number;
    data_calculo: string; // DD/MM/AAAA
    multa?: { tipo: "" | "percentual" | "valor_fixo"; valor_base: number; valor_calculado: number };
    juros?: {
      tipo: "" | "percentual_mensal" | "percentual_diario" | "valor_fixo_diario";
      valor_base: number;
      percentual_diario?: number | null;
      valor_calculado: number;
    };
    memoria_calculo?: unknown;
  } | null;
}


export interface ExtractedAI {
  tipo_documento?: string | null;
  banco?: { codigo?: string | null; nome?: string | null } | null;
  linha_digitavel?: string | null;
  codigo_barras?: string | null;
  beneficiario?: Partial<Pessoa> | null;
  pagador?: Partial<Pessoa> | null;
  vencimento?: string | null;
  valor_documento?: number | null;
  valor_cobrado?: number | null;
  data_documento?: string | null;
  data_processamento?: string | null;
  numero_documento?: string | null;
  nosso_numero?: string | null;
  agencia_codigo_beneficiario?: string | null;
  carteira?: string | null;
  especie?: string | null;
  aceite?: string | null;
  instrucoes?: string[] | null;
  juros?: number | null;
  multa?: number | null;
  desconto?: number | null;
  outras_deducoes?: number | null;
  outros_acrescimos?: number | null;
  referencia?: string | null;
  numero_instalacao?: string | null;
  nota_fiscal?: string | null;
  chave_nota_fiscal?: string | null;
  informacoes_adicionais?: string | null;
  gps?: Partial<GpsInfo> | null;
  texto_original?: string | null;
  confianca?: Record<string, number> | null;
}