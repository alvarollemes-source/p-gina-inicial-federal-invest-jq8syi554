
-- Enums for CNAB flow
DO $$ BEGIN
  CREATE TYPE public.cnab_ambiente AS ENUM ('homologacao','producao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cnab_batch_status AS ENUM (
    'rascunho','em_conferencia','validado','arquivo_gerado','enviado_banco',
    'processado_parcial','processado','rejeitado','cancelado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_doc_extract_status AS ENUM ('pendente','ok','erro','revisao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_doc_conferencia_status AS ENUM ('pendente','conferido','aprovado','reprovado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_doc_cnab_status AS ENUM ('nao_incluido','em_lote','em_arquivo','enviado','processado','rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_doc_tipo AS ENUM ('boleto','pix','ted','doc','tributo','concessionaria','veiculo','gps','outros');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 1) Bank accounts
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  banco_codigo TEXT NOT NULL,
  banco_nome TEXT NOT NULL,
  agencia TEXT NOT NULL,
  agencia_dv TEXT,
  conta TEXT NOT NULL,
  conta_dv TEXT,
  tipo_conta TEXT DEFAULT 'corrente',
  convenio TEXT,
  carteira TEXT,
  variacao_carteira TEXT,
  cedente_nome TEXT,
  cedente_documento TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_accounts_federal_all ON public.bank_accounts FOR ALL TO authenticated
  USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY bank_accounts_read_own_empresa ON public.bank_accounts FOR SELECT TO authenticated
  USING (empresa_id IS NOT NULL AND empresa_id = public.current_empresa_id());


-- 2) Payment documents
CREATE TABLE public.payment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boleto_id UUID REFERENCES public.boletos(id) ON DELETE SET NULL,
  empresa_id UUID REFERENCES public.empresas(id),
  tipo public.payment_doc_tipo NOT NULL DEFAULT 'boleto',
  arquivo_url TEXT,
  arquivo_nome TEXT,
  descricao TEXT,
  beneficiario_nome TEXT,
  beneficiario_documento TEXT,
  codigo_barras TEXT,
  linha_digitavel TEXT,
  pix_payload TEXT,
  pix_chave TEXT,
  vencimento DATE,
  data_programada DATE,
  valor_nominal NUMERIC(14,2),
  desconto NUMERIC(14,2) DEFAULT 0,
  abatimento NUMERIC(14,2) DEFAULT 0,
  juros NUMERIC(14,2) DEFAULT 0,
  multa NUMERIC(14,2) DEFAULT 0,
  valor_final NUMERIC(14,2),
  status_extracao public.payment_doc_extract_status NOT NULL DEFAULT 'pendente',
  status_conferencia public.payment_doc_conferencia_status NOT NULL DEFAULT 'pendente',
  status_cnab public.payment_doc_cnab_status NOT NULL DEFAULT 'nao_incluido',
  observacao TEXT,
  criador_id UUID REFERENCES auth.users(id),
  conferente_id UUID REFERENCES auth.users(id),
  responsavel_id UUID REFERENCES auth.users(id),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_documents TO authenticated;
GRANT ALL ON public.payment_documents TO service_role;
ALTER TABLE public.payment_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_documents_federal_all ON public.payment_documents FOR ALL TO authenticated
  USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY payment_documents_read_own_empresa ON public.payment_documents FOR SELECT TO authenticated
  USING (empresa_id IS NOT NULL AND empresa_id = public.current_empresa_id());


-- 3) CNAB batches
CREATE TABLE public.cnab_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_interno TEXT NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  numero_remessa INTEGER,
  data_pagamento DATE,
  ambiente public.cnab_ambiente NOT NULL DEFAULT 'homologacao',
  status public.cnab_batch_status NOT NULL DEFAULT 'rascunho',
  quantidade_itens INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  criador_id UUID REFERENCES auth.users(id),
  validador_id UUID REFERENCES auth.users(id),
  gerado_em TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnab_batches TO authenticated;
GRANT ALL ON public.cnab_batches TO service_role;
ALTER TABLE public.cnab_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnab_batches_federal_all ON public.cnab_batches FOR ALL TO authenticated
  USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));


-- 4) CNAB batch items
CREATE TABLE public.cnab_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.cnab_batches(id) ON DELETE CASCADE,
  payment_document_id UUID NOT NULL REFERENCES public.payment_documents(id),
  ordem INTEGER,
  valor NUMERIC(14,2),
  status TEXT DEFAULT 'incluido',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, payment_document_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnab_batch_items TO authenticated;
GRANT ALL ON public.cnab_batch_items TO service_role;
ALTER TABLE public.cnab_batch_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnab_batch_items_federal_all ON public.cnab_batch_items FOR ALL TO authenticated
  USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));


-- 5) CNAB files (generated remessa)
CREATE TABLE public.cnab_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.cnab_batches(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT,
  layout TEXT DEFAULT 'CNAB240',
  tamanho_bytes INTEGER,
  hash_sha256 TEXT,
  gerado_por UUID REFERENCES auth.users(id),
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_demo BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnab_files TO authenticated;
GRANT ALL ON public.cnab_files TO service_role;
ALTER TABLE public.cnab_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnab_files_federal_all ON public.cnab_files FOR ALL TO authenticated
  USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));


-- 6) CNAB returns
CREATE TABLE public.cnab_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.cnab_batches(id) ON DELETE SET NULL,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT,
  layout TEXT DEFAULT 'CNAB240',
  processado_em TIMESTAMPTZ,
  observacao TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnab_returns TO authenticated;
GRANT ALL ON public.cnab_returns TO service_role;
ALTER TABLE public.cnab_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnab_returns_federal_all ON public.cnab_returns FOR ALL TO authenticated
  USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));


-- 7) CNAB return items
CREATE TABLE public.cnab_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.cnab_returns(id) ON DELETE CASCADE,
  payment_document_id UUID REFERENCES public.payment_documents(id),
  codigo_retorno TEXT,
  descricao_retorno TEXT,
  valor_pago NUMERIC(14,2),
  data_efetivacao DATE,
  status TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnab_return_items TO authenticated;
GRANT ALL ON public.cnab_return_items TO service_role;
ALTER TABLE public.cnab_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnab_return_items_federal_all ON public.cnab_return_items FOR ALL TO authenticated
  USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));


-- 8) Audit logs (CNAB scoped)
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  entidade_id UUID,
  acao TEXT NOT NULL,
  detalhes JSONB,
  user_id UUID REFERENCES auth.users(id),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_federal_read ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_federal(auth.uid()));
CREATE POLICY audit_logs_insert_self ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);


-- updated_at triggers
CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payment_documents_updated BEFORE UPDATE ON public.payment_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cnab_batches_updated BEFORE UPDATE ON public.cnab_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Indexes
CREATE INDEX idx_payment_documents_empresa ON public.payment_documents(empresa_id);
CREATE INDEX idx_payment_documents_status_cnab ON public.payment_documents(status_cnab);
CREATE INDEX idx_payment_documents_vencimento ON public.payment_documents(vencimento);
CREATE INDEX idx_cnab_batches_status ON public.cnab_batches(status);
CREATE INDEX idx_cnab_batch_items_batch ON public.cnab_batch_items(batch_id);


-- Seed demo data (marked with is_demo = true)
DO $$
DECLARE
  v_empresa UUID;
  v_bank UUID := gen_random_uuid();
  v_batch UUID := gen_random_uuid();
  v_doc1 UUID := gen_random_uuid();
  v_doc2 UUID := gen_random_uuid();
  v_doc3 UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_empresa FROM public.empresas ORDER BY created_at LIMIT 1;

  INSERT INTO public.bank_accounts (id, empresa_id, banco_codigo, banco_nome, agencia, conta, conta_dv, convenio, cedente_nome, is_demo)
  VALUES (v_bank, v_empresa, '237', 'Bradesco', '1234', '567890', '1', '9876543', 'Empresa Demo Ltda', true);

  INSERT INTO public.payment_documents
    (id, empresa_id, tipo, beneficiario_nome, beneficiario_documento, vencimento, data_programada,
     valor_nominal, valor_final, status_extracao, status_conferencia, status_cnab, is_demo)
  VALUES
    (v_doc1, v_empresa, 'boleto', 'Fornecedor Alfa S.A.', '12.345.678/0001-90', CURRENT_DATE + 3, CURRENT_DATE + 3, 1250.50, 1250.50, 'ok', 'aprovado', 'nao_incluido', true),
    (v_doc2, v_empresa, 'pix',    'Beneficiário Beta ME', '98.765.432/0001-10', CURRENT_DATE + 1, CURRENT_DATE + 1,  480.00,  480.00, 'ok', 'pendente', 'nao_incluido', true),
    (v_doc3, v_empresa, 'tributo','DARF - Receita Federal', NULL,            CURRENT_DATE + 7, CURRENT_DATE + 7, 3200.00, 3200.00, 'revisao', 'pendente', 'nao_incluido', true);

  INSERT INTO public.cnab_batches (id, nome_interno, empresa_id, bank_account_id, data_pagamento, ambiente, status, quantidade_itens, valor_total, is_demo)
  VALUES (v_batch, 'Lote Demonstração 001', v_empresa, v_bank, CURRENT_DATE + 3, 'homologacao', 'rascunho', 1, 1250.50, true);

  INSERT INTO public.cnab_batch_items (batch_id, payment_document_id, ordem, valor, is_demo)
  VALUES (v_batch, v_doc1, 1, 1250.50, true);
END $$;
