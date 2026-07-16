
CREATE TABLE public.boletos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text,
  arquivo_url text,
  arquivo_nome text,
  arquivo_tipo text,
  tipo_documento text,
  texto_extraido text,
  codigo_barras text,
  codigo_barras_original text,
  linha_digitavel text,
  linha_digitavel_original text,
  banco_codigo text,
  banco_nome text,
  beneficiario_nome text,
  beneficiario_documento text,
  beneficiario_tipo_documento text,
  beneficiario_endereco text,
  pagador_nome text,
  pagador_documento text,
  pagador_tipo_documento text,
  pagador_endereco text,
  pagador_cidade text,
  pagador_estado text,
  pagador_cep text,
  vencimento date,
  valor_documento numeric(14,2),
  valor_cobrado numeric(14,2),
  data_documento date,
  data_processamento date,
  numero_documento text,
  nosso_numero text,
  agencia_beneficiario text,
  carteira text,
  referencia text,
  instrucoes jsonb,
  status_validacao text,
  nivel_confianca numeric(5,4),
  campos_baixa_confianca jsonb,
  erros_validacao jsonb,
  alertas_validacao jsonb,
  dados_json jsonb,
  confirmado_pelo_usuario boolean NOT NULL DEFAULT false,
  usuario_confirmacao text,
  data_confirmacao timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por text
);

CREATE INDEX boletos_codigo_barras_idx ON public.boletos (codigo_barras);
CREATE INDEX boletos_linha_digitavel_idx ON public.boletos (linha_digitavel);
CREATE INDEX boletos_nosso_numero_idx ON public.boletos (nosso_numero);
CREATE INDEX boletos_session_id_idx ON public.boletos (session_id);
CREATE INDEX boletos_criado_em_idx ON public.boletos (criado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boletos TO anon, authenticated;
GRANT ALL ON public.boletos TO service_role;

ALTER TABLE public.boletos ENABLE ROW LEVEL SECURITY;

-- Sem autenticação ainda: acesso público total à tabela (será restringido quando o login for ativado)
CREATE POLICY "boletos_all_anon" ON public.boletos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "boletos_all_authenticated" ON public.boletos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage policies para o bucket privado 'boletos'
CREATE POLICY "boletos_storage_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'boletos');
CREATE POLICY "boletos_storage_insert" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'boletos');
CREATE POLICY "boletos_storage_update" ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'boletos');
CREATE POLICY "boletos_storage_delete" ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'boletos');
