
-- ============ Enums: adiciona valores solicitados ============
ALTER TYPE public.payment_doc_extract_status ADD VALUE IF NOT EXISTS 'aguardando_leitura';
ALTER TYPE public.payment_doc_extract_status ADD VALUE IF NOT EXISTS 'em_processamento';
ALTER TYPE public.payment_doc_extract_status ADD VALUE IF NOT EXISTS 'extraido';
ALTER TYPE public.payment_doc_extract_status ADD VALUE IF NOT EXISTS 'extracao_parcial';
ALTER TYPE public.payment_doc_extract_status ADD VALUE IF NOT EXISTS 'erro_leitura';

ALTER TYPE public.payment_doc_conferencia_status ADD VALUE IF NOT EXISTS 'em_conferencia';
ALTER TYPE public.payment_doc_conferencia_status ADD VALUE IF NOT EXISTS 'correcao_solicitada';

ALTER TYPE public.payment_doc_cnab_status ADD VALUE IF NOT EXISTS 'nao_elegivel';
ALTER TYPE public.payment_doc_cnab_status ADD VALUE IF NOT EXISTS 'pronto_para_lote';
ALTER TYPE public.payment_doc_cnab_status ADD VALUE IF NOT EXISTS 'incluido_em_lote';
ALTER TYPE public.payment_doc_cnab_status ADD VALUE IF NOT EXISTS 'arquivo_gerado';
ALTER TYPE public.payment_doc_cnab_status ADD VALUE IF NOT EXISTS 'erro_bancario';

-- ============ Colunas adicionais em payment_documents ============
ALTER TABLE public.payment_documents
  ADD COLUMN IF NOT EXISTS numero_interno text,
  ADD COLUMN IF NOT EXISTS numero_documento text,
  ADD COLUMN IF NOT EXISTS nosso_numero text,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS centro_custo text,
  ADD COLUMN IF NOT EXISTS banco_emissor text,
  ADD COLUMN IF NOT EXISTS beneficiario_tipo_pessoa text,
  ADD COLUMN IF NOT EXISTS classificacao_sugerida text,
  ADD COLUMN IF NOT EXISTS classificacao_confirmada text,
  ADD COLUMN IF NOT EXISTS hash_arquivo text,
  ADD COLUMN IF NOT EXISTS motivo_reprovacao text,
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS valor_calculado numeric(14,2),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_payment_documents_hash ON public.payment_documents(hash_arquivo);
CREATE INDEX IF NOT EXISTS idx_payment_documents_codigo_barras ON public.payment_documents(codigo_barras);

-- ============ document_extractions ============
CREATE TABLE IF NOT EXISTS public.document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_document_id uuid NOT NULL REFERENCES public.payment_documents(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  extracted_value text,
  confidence_score numeric(4,3),
  source_page int,
  source_type text,
  original_value text,
  confirmed_value text,
  confirmed_by uuid REFERENCES auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_extractions TO authenticated;
GRANT ALL ON public.document_extractions TO service_role;
ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_extractions_federal" ON public.document_extractions
  FOR ALL TO authenticated
  USING (public.is_federal(auth.uid()))
  WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY "doc_extractions_read_own_empresa" ON public.document_extractions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_documents p
                 WHERE p.id = payment_document_id
                 AND p.empresa_id IS NOT NULL
                 AND p.empresa_id = public.current_empresa_id()));
CREATE INDEX IF NOT EXISTS idx_doc_extractions_doc ON public.document_extractions(payment_document_id);

-- ============ document_validation_issues ============
CREATE TABLE IF NOT EXISTS public.document_validation_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_document_id uuid NOT NULL REFERENCES public.payment_documents(id) ON DELETE CASCADE,
  field_name text,
  validation_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','resolvido','ignorado')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_validation_issues TO authenticated;
GRANT ALL ON public.document_validation_issues TO service_role;
ALTER TABLE public.document_validation_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_issues_federal" ON public.document_validation_issues
  FOR ALL TO authenticated
  USING (public.is_federal(auth.uid()))
  WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY "doc_issues_read_own_empresa" ON public.document_validation_issues
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_documents p
                 WHERE p.id = payment_document_id
                 AND p.empresa_id IS NOT NULL
                 AND p.empresa_id = public.current_empresa_id()));
CREATE INDEX IF NOT EXISTS idx_doc_issues_doc ON public.document_validation_issues(payment_document_id);

-- ============ document_reviews ============
CREATE TABLE IF NOT EXISTS public.document_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_document_id uuid NOT NULL REFERENCES public.payment_documents(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id),
  review_status text NOT NULL CHECK (review_status IN ('pendente','em_conferencia','aprovado','reprovado','correcao_solicitada','reaberto')),
  rejection_reason text,
  review_notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_reviews TO authenticated;
GRANT ALL ON public.document_reviews TO service_role;
ALTER TABLE public.document_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_reviews_federal" ON public.document_reviews
  FOR ALL TO authenticated
  USING (public.is_federal(auth.uid()))
  WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY "doc_reviews_read_own_empresa" ON public.document_reviews
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_documents p
                 WHERE p.id = payment_document_id
                 AND p.empresa_id IS NOT NULL
                 AND p.empresa_id = public.current_empresa_id()));
CREATE INDEX IF NOT EXISTS idx_doc_reviews_doc ON public.document_reviews(payment_document_id);

-- ============ document_change_logs ============
CREATE TABLE IF NOT EXISTS public.document_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_document_id uuid NOT NULL REFERENCES public.payment_documents(id) ON DELETE CASCADE,
  field_name text,
  old_value text,
  new_value text,
  changed_by uuid REFERENCES auth.users(id),
  change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_change_logs TO authenticated;
GRANT ALL ON public.document_change_logs TO service_role;
ALTER TABLE public.document_change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_changelog_federal" ON public.document_change_logs
  FOR ALL TO authenticated
  USING (public.is_federal(auth.uid()))
  WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY "doc_changelog_read_own_empresa" ON public.document_change_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_documents p
                 WHERE p.id = payment_document_id
                 AND p.empresa_id IS NOT NULL
                 AND p.empresa_id = public.current_empresa_id()));
CREATE INDEX IF NOT EXISTS idx_doc_changelog_doc ON public.document_change_logs(payment_document_id);

-- ============ Storage: bucket payment-documents ============
-- Owners can read/upload their own files; Federal Invest can read/write everything.
DROP POLICY IF EXISTS "paydocs_owner_read" ON storage.objects;
DROP POLICY IF EXISTS "paydocs_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "paydocs_federal_all" ON storage.objects;

CREATE POLICY "paydocs_owner_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-documents' AND owner = auth.uid());
CREATE POLICY "paydocs_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-documents' AND owner = auth.uid());
CREATE POLICY "paydocs_federal_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'payment-documents' AND public.is_federal(auth.uid()))
  WITH CHECK (bucket_id = 'payment-documents' AND public.is_federal(auth.uid()));
