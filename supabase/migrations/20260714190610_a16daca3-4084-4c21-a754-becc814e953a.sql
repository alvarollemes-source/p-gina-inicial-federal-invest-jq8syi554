-- Recriação completa do schema Trustee Federal a partir das 12 migrações originais consolidadas
-- Copie o conteúdo por partes se necessário, mas aqui aplico como um bloco único.

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
CREATE POLICY "boletos_all_anon" ON public.boletos FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "boletos_all_authenticated" ON public.boletos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "boletos_storage_read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'boletos');
CREATE POLICY "boletos_storage_insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'boletos');
CREATE POLICY "boletos_storage_update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'boletos');
CREATE POLICY "boletos_storage_delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'boletos');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  responsavel TEXT,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER empresas_updated_at BEFORE UPDATE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'analista', 'operador');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_federal(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','gestor','analista'))
$$;

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_federal_read" ON public.profiles FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "empresas_federal_read" ON public.empresas FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "empresas_own_read" ON public.empresas FOR SELECT TO authenticated USING (id = public.current_empresa_id());
CREATE POLICY "empresas_admin_all" ON public.empresas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles_federal_read" ON public.user_roles FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.permissoes_individuais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pagina TEXT NOT NULL,
  pode_visualizar BOOLEAN NOT NULL DEFAULT false,
  pode_criar BOOLEAN NOT NULL DEFAULT false,
  pode_editar BOOLEAN NOT NULL DEFAULT false,
  pode_excluir BOOLEAN NOT NULL DEFAULT false,
  pode_exportar BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, pagina)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_individuais TO authenticated;
GRANT ALL ON public.permissoes_individuais TO service_role;
ALTER TABLE public.permissoes_individuais ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER permissoes_individuais_updated_at BEFORE UPDATE ON public.permissoes_individuais FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "perm_self_read" ON public.permissoes_individuais FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "perm_admin_all" ON public.permissoes_individuais FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.logs_atividade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  modulo TEXT,
  detalhes JSONB,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.logs_atividade TO authenticated;
GRANT ALL ON public.logs_atividade TO service_role;
ALTER TABLE public.logs_atividade ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs_insert_self" ON public.logs_atividade FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "logs_federal_read" ON public.logs_atividade FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "logs_admin_all" ON public.logs_atividade FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.boletos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usuario_envio_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observacoes_internas TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_cliente TEXT,
  ADD COLUMN IF NOT EXISTS metodo_extracao TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'recebido',
  ADD COLUMN IF NOT EXISTS data_envio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE TRIGGER boletos_updated_at BEFORE UPDATE ON public.boletos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS boletos_all_anon ON public.boletos;
DROP POLICY IF EXISTS boletos_all_authenticated ON public.boletos;
CREATE POLICY "boletos_own_empresa_read" ON public.boletos FOR SELECT TO authenticated USING (empresa_id = public.current_empresa_id() OR usuario_envio_id = auth.uid());
CREATE POLICY "boletos_federal_read" ON public.boletos FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "boletos_own_empresa_insert" ON public.boletos FOR INSERT TO authenticated WITH CHECK (usuario_envio_id = auth.uid());
CREATE POLICY "boletos_own_empresa_update" ON public.boletos FOR UPDATE TO authenticated USING (usuario_envio_id = auth.uid() AND status = 'recebido') WITH CHECK (usuario_envio_id = auth.uid());
CREATE POLICY "boletos_federal_update" ON public.boletos FOR UPDATE TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY "boletos_admin_all" ON public.boletos FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.historico_status_boleto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boleto_id UUID NOT NULL REFERENCES public.boletos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.historico_status_boleto TO authenticated;
GRANT ALL ON public.historico_status_boleto TO service_role;
ALTER TABLE public.historico_status_boleto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hist_read_boleto" ON public.historico_status_boleto FOR SELECT TO authenticated USING (
  public.is_federal(auth.uid()) OR EXISTS (SELECT 1 FROM public.boletos b WHERE b.id = boleto_id AND (b.empresa_id = public.current_empresa_id() OR b.usuario_envio_id = auth.uid()))
);

CREATE OR REPLACE FUNCTION public.log_boleto_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.historico_status_boleto (boleto_id, user_id, status_anterior, status_novo)
    VALUES (NEW.id, auth.uid(), CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END, NEW.status);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER boletos_status_history AFTER INSERT OR UPDATE OF status ON public.boletos FOR EACH ROW EXECUTE FUNCTION public.log_boleto_status_change();

CREATE TABLE public.conversoes_ofx (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome_arquivo_xls TEXT,
  arquivo_xls_url TEXT,
  arquivo_ofx_url TEXT,
  quantidade_lancamentos INTEGER,
  total_creditos NUMERIC(18,2),
  total_debitos NUMERIC(18,2),
  saldo_final NUMERIC(18,2),
  status_conversao TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversoes_ofx TO authenticated;
GRANT ALL ON public.conversoes_ofx TO service_role;
ALTER TABLE public.conversoes_ofx ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ofx_own_empresa_read" ON public.conversoes_ofx FOR SELECT TO authenticated USING (empresa_id = public.current_empresa_id() OR user_id = auth.uid());
CREATE POLICY "ofx_federal_read" ON public.conversoes_ofx FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "ofx_insert" ON public.conversoes_ofx FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ofx_admin_all" ON public.conversoes_ofx FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.boletos ALTER COLUMN status SET DEFAULT 'rascunho';
DROP POLICY IF EXISTS boletos_own_empresa_update ON public.boletos;
CREATE POLICY boletos_own_empresa_update ON public.boletos FOR UPDATE TO authenticated
  USING (usuario_envio_id = auth.uid() AND status IN ('rascunho','recebido'))
  WITH CHECK (usuario_envio_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.boletos;

CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  boleto_id UUID REFERENCES public.boletos(id) ON DELETE CASCADE,
  lida BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notificacoes_user_lida ON public.notificacoes(user_id, lida, criado_em DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own notifications" ON public.notificacoes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user updates own notifications" ON public.notificacoes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user deletes own notifications" ON public.notificacoes FOR DELETE TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

CREATE OR REPLACE FUNCTION public.notificar_status_boleto()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE benef TEXT; valor NUMERIC; fed RECORD;
BEGIN
  benef := COALESCE(NEW.beneficiario_nome, 'boleto');
  valor := COALESCE(NEW.valor_cobrado, NEW.valor_documento, 0);
  IF NEW.status = 'recebido' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'recebido') THEN
    FOR fed IN SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('admin','gestor','analista') LOOP
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, boleto_id)
      VALUES (fed.user_id, 'boleto_recebido', 'Novo boleto recebido', 'Boleto de ' || benef || ' foi enviado para pagamento.', NEW.id);
    END LOOP;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('aprovado','rejeitado','pago') AND NEW.usuario_envio_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, boleto_id)
    VALUES (NEW.usuario_envio_id, 'boleto_' || NEW.status,
      CASE NEW.status WHEN 'aprovado' THEN 'Boleto aprovado' WHEN 'rejeitado' THEN 'Boleto rejeitado' WHEN 'pago' THEN 'Boleto pago' END,
      'Seu boleto de ' || benef || ' foi ' || CASE NEW.status WHEN 'pago' THEN 'pago' WHEN 'aprovado' THEN 'aprovado' ELSE 'rejeitado' END || '.', NEW.id);
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_notificar_status_boleto AFTER INSERT OR UPDATE OF status ON public.boletos FOR EACH ROW EXECUTE FUNCTION public.notificar_status_boleto();

CREATE OR REPLACE FUNCTION public.log_generic_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_modulo text := TG_ARGV[0]; v_acao text; v_detalhes jsonb; v_empresa uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := TG_ARGV[0] || '.criado'; v_detalhes := to_jsonb(NEW);
    BEGIN v_empresa := (to_jsonb(NEW)->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa := NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := TG_ARGV[0] || '.atualizado'; v_detalhes := jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW));
    BEGIN v_empresa := (to_jsonb(NEW)->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa := NULL; END;
    IF TG_ARGV[0] = 'boletos' AND OLD.status IS DISTINCT FROM NEW.status THEN v_acao := 'boletos.status.' || NEW.status; END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := TG_ARGV[0] || '.excluido'; v_detalhes := to_jsonb(OLD);
    BEGIN v_empresa := (to_jsonb(OLD)->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa := NULL; END;
  END IF;
  INSERT INTO public.logs_atividade (user_id, empresa_id, acao, modulo, detalhes) VALUES (v_user, v_empresa, v_acao, v_modulo, v_detalhes);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;

CREATE TRIGGER trg_log_boletos AFTER INSERT OR UPDATE OR DELETE ON public.boletos FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('boletos');
CREATE TRIGGER trg_log_conversoes_ofx AFTER INSERT OR UPDATE OR DELETE ON public.conversoes_ofx FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('conversor-ofx');
CREATE TRIGGER trg_log_permissoes AFTER INSERT OR UPDATE OR DELETE ON public.permissoes_individuais FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('permissoes');
CREATE TRIGGER trg_log_user_roles AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('usuarios');
CREATE TRIGGER trg_log_empresas AFTER INSERT OR UPDATE OR DELETE ON public.empresas FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('empresas');
CREATE TRIGGER trg_log_profiles AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('perfil');

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS matriz_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS empresas_matriz_id_idx ON public.empresas(matriz_id);
ALTER TABLE public.empresas ADD CONSTRAINT empresas_matriz_nao_recursiva CHECK (matriz_id IS NULL OR matriz_id <> id);

ALTER TABLE public.boletos
  ADD COLUMN IF NOT EXISTS tipo_pagamento text NOT NULL DEFAULT 'boleto',
  ADD COLUMN IF NOT EXISTS dados_pagamento jsonb;
CREATE INDEX IF NOT EXISTS idx_boletos_tipo_pagamento ON public.boletos(tipo_pagamento);

CREATE TYPE public.cnab_ambiente AS ENUM ('homologacao','producao');
CREATE TYPE public.cnab_batch_status AS ENUM ('rascunho','em_conferencia','validado','arquivo_gerado','enviado_banco','processado_parcial','processado','rejeitado','cancelado');
CREATE TYPE public.payment_doc_extract_status AS ENUM ('pendente','ok','erro','revisao','aguardando_leitura','em_processamento','extraido','extracao_parcial','erro_leitura');
CREATE TYPE public.payment_doc_conferencia_status AS ENUM ('pendente','conferido','aprovado','reprovado','em_conferencia','correcao_solicitada');
CREATE TYPE public.payment_doc_cnab_status AS ENUM ('nao_incluido','em_lote','em_arquivo','enviado','processado','rejeitado','nao_elegivel','pronto_para_lote','incluido_em_lote','arquivo_gerado','erro_bancario');
CREATE TYPE public.payment_doc_tipo AS ENUM ('boleto','pix','ted','doc','tributo','concessionaria','veiculo','gps','outros');

CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  banco_codigo TEXT NOT NULL, banco_nome TEXT NOT NULL,
  agencia TEXT NOT NULL, agencia_dv TEXT, conta TEXT NOT NULL, conta_dv TEXT,
  tipo_conta TEXT DEFAULT 'corrente', convenio TEXT, carteira TEXT, variacao_carteira TEXT,
  cedente_nome TEXT, cedente_documento TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true, is_demo BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY bank_accounts_federal_all ON public.bank_accounts FOR ALL TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY bank_accounts_read_own_empresa ON public.bank_accounts FOR SELECT TO authenticated USING (empresa_id IS NOT NULL AND empresa_id = public.current_empresa_id());

CREATE TABLE public.payment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boleto_id UUID REFERENCES public.boletos(id) ON DELETE SET NULL,
  empresa_id UUID REFERENCES public.empresas(id),
  tipo public.payment_doc_tipo NOT NULL DEFAULT 'boleto',
  arquivo_url TEXT, arquivo_nome TEXT, descricao TEXT,
  beneficiario_nome TEXT, beneficiario_documento TEXT,
  codigo_barras TEXT, linha_digitavel TEXT, pix_payload TEXT, pix_chave TEXT,
  vencimento DATE, data_programada DATE,
  valor_nominal NUMERIC(14,2), desconto NUMERIC(14,2) DEFAULT 0, abatimento NUMERIC(14,2) DEFAULT 0,
  juros NUMERIC(14,2) DEFAULT 0, multa NUMERIC(14,2) DEFAULT 0, valor_final NUMERIC(14,2),
  status_extracao public.payment_doc_extract_status NOT NULL DEFAULT 'pendente',
  status_conferencia public.payment_doc_conferencia_status NOT NULL DEFAULT 'pendente',
  status_cnab public.payment_doc_cnab_status NOT NULL DEFAULT 'nao_incluido',
  observacao TEXT,
  criador_id UUID REFERENCES auth.users(id), conferente_id UUID REFERENCES auth.users(id), responsavel_id UUID REFERENCES auth.users(id),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  numero_interno text, numero_documento text, nosso_numero text, categoria text, centro_custo text,
  banco_emissor text, beneficiario_tipo_pessoa text, classificacao_sugerida text, classificacao_confirmada text,
  hash_arquivo text, motivo_reprovacao text, review_notes text, valor_calculado numeric(14,2),
  reviewed_at timestamptz, reviewed_by uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_documents TO authenticated;
GRANT ALL ON public.payment_documents TO service_role;
ALTER TABLE public.payment_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_documents_federal_all ON public.payment_documents FOR ALL TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY payment_documents_read_own_empresa ON public.payment_documents FOR SELECT TO authenticated USING (empresa_id IS NOT NULL AND empresa_id = public.current_empresa_id());
CREATE INDEX IF NOT EXISTS idx_payment_documents_hash ON public.payment_documents(hash_arquivo);
CREATE INDEX IF NOT EXISTS idx_payment_documents_codigo_barras ON public.payment_documents(codigo_barras);

CREATE TABLE public.cnab_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_interno TEXT NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  numero_remessa INTEGER, data_pagamento DATE,
  ambiente public.cnab_ambiente NOT NULL DEFAULT 'homologacao',
  status public.cnab_batch_status NOT NULL DEFAULT 'rascunho',
  quantidade_itens INTEGER NOT NULL DEFAULT 0, valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacao TEXT, criador_id UUID REFERENCES auth.users(id), validador_id UUID REFERENCES auth.users(id),
  gerado_em TIMESTAMPTZ, enviado_em TIMESTAMPTZ, is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnab_batches TO authenticated;
GRANT ALL ON public.cnab_batches TO service_role;
ALTER TABLE public.cnab_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnab_batches_federal_all ON public.cnab_batches FOR ALL TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));

CREATE TABLE public.cnab_batch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.cnab_batches(id) ON DELETE CASCADE,
  payment_document_id UUID NOT NULL REFERENCES public.payment_documents(id),
  ordem INTEGER, valor NUMERIC(14,2), status TEXT DEFAULT 'incluido',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, payment_document_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnab_batch_items TO authenticated;
GRANT ALL ON public.cnab_batch_items TO service_role;
ALTER TABLE public.cnab_batch_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnab_batch_items_federal_all ON public.cnab_batch_items FOR ALL TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));

CREATE TABLE public.cnab_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.cnab_batches(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL, storage_path TEXT, layout TEXT DEFAULT 'CNAB240',
  tamanho_bytes INTEGER, hash_sha256 TEXT, gerado_por UUID REFERENCES auth.users(id),
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT now(), is_demo BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnab_files TO authenticated;
GRANT ALL ON public.cnab_files TO service_role;
ALTER TABLE public.cnab_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnab_files_federal_all ON public.cnab_files FOR ALL TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));

CREATE TABLE public.cnab_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES public.cnab_batches(id) ON DELETE SET NULL,
  nome_arquivo TEXT NOT NULL, storage_path TEXT, layout TEXT DEFAULT 'CNAB240',
  processado_em TIMESTAMPTZ, observacao TEXT, is_demo BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnab_returns TO authenticated;
GRANT ALL ON public.cnab_returns TO service_role;
ALTER TABLE public.cnab_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnab_returns_federal_all ON public.cnab_returns FOR ALL TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));

CREATE TABLE public.cnab_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.cnab_returns(id) ON DELETE CASCADE,
  payment_document_id UUID REFERENCES public.payment_documents(id),
  codigo_retorno TEXT, descricao_retorno TEXT, valor_pago NUMERIC(14,2),
  data_efetivacao DATE, status TEXT, is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cnab_return_items TO authenticated;
GRANT ALL ON public.cnab_return_items TO service_role;
ALTER TABLE public.cnab_return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY cnab_return_items_federal_all ON public.cnab_return_items FOR ALL TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL, entidade_id UUID, acao TEXT NOT NULL, detalhes JSONB,
  user_id UUID REFERENCES auth.users(id), is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_logs_federal_read ON public.audit_logs FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY audit_logs_insert_self ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payment_documents_updated BEFORE UPDATE ON public.payment_documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cnab_batches_updated BEFORE UPDATE ON public.cnab_batches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_payment_documents_empresa ON public.payment_documents(empresa_id);
CREATE INDEX idx_payment_documents_status_cnab ON public.payment_documents(status_cnab);
CREATE INDEX idx_payment_documents_vencimento ON public.payment_documents(vencimento);
CREATE INDEX idx_cnab_batches_status ON public.cnab_batches(status);
CREATE INDEX idx_cnab_batch_items_batch ON public.cnab_batch_items(batch_id);

CREATE TABLE IF NOT EXISTS public.document_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_document_id uuid NOT NULL REFERENCES public.payment_documents(id) ON DELETE CASCADE,
  field_name text NOT NULL, extracted_value text, confidence_score numeric(4,3),
  source_page int, source_type text, original_value text, confirmed_value text,
  confirmed_by uuid REFERENCES auth.users(id), confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_extractions TO authenticated;
GRANT ALL ON public.document_extractions TO service_role;
ALTER TABLE public.document_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_extractions_federal" ON public.document_extractions FOR ALL TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY "doc_extractions_read_own_empresa" ON public.document_extractions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_documents p WHERE p.id = payment_document_id AND p.empresa_id IS NOT NULL AND p.empresa_id = public.current_empresa_id()));
CREATE INDEX IF NOT EXISTS idx_doc_extractions_doc ON public.document_extractions(payment_document_id);

CREATE TABLE IF NOT EXISTS public.document_validation_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_document_id uuid NOT NULL REFERENCES public.payment_documents(id) ON DELETE CASCADE,
  field_name text, validation_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','resolvido','ignorado')),
  resolved_by uuid REFERENCES auth.users(id), resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_validation_issues TO authenticated;
GRANT ALL ON public.document_validation_issues TO service_role;
ALTER TABLE public.document_validation_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_issues_federal" ON public.document_validation_issues FOR ALL TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY "doc_issues_read_own_empresa" ON public.document_validation_issues FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_documents p WHERE p.id = payment_document_id AND p.empresa_id IS NOT NULL AND p.empresa_id = public.current_empresa_id()));
CREATE INDEX IF NOT EXISTS idx_doc_issues_doc ON public.document_validation_issues(payment_document_id);

CREATE TABLE IF NOT EXISTS public.document_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_document_id uuid NOT NULL REFERENCES public.payment_documents(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id),
  review_status text NOT NULL CHECK (review_status IN ('pendente','em_conferencia','aprovado','reprovado','correcao_solicitada','reaberto')),
  rejection_reason text, review_notes text,
  started_at timestamptz, completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_reviews TO authenticated;
GRANT ALL ON public.document_reviews TO service_role;
ALTER TABLE public.document_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_reviews_federal" ON public.document_reviews FOR ALL TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY "doc_reviews_read_own_empresa" ON public.document_reviews FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_documents p WHERE p.id = payment_document_id AND p.empresa_id IS NOT NULL AND p.empresa_id = public.current_empresa_id()));
CREATE INDEX IF NOT EXISTS idx_doc_reviews_doc ON public.document_reviews(payment_document_id);

CREATE TABLE IF NOT EXISTS public.document_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_document_id uuid NOT NULL REFERENCES public.payment_documents(id) ON DELETE CASCADE,
  field_name text, old_value text, new_value text,
  changed_by uuid REFERENCES auth.users(id), change_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_change_logs TO authenticated;
GRANT ALL ON public.document_change_logs TO service_role;
ALTER TABLE public.document_change_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_changelog_federal" ON public.document_change_logs FOR ALL TO authenticated USING (public.is_federal(auth.uid())) WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY "doc_changelog_read_own_empresa" ON public.document_change_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payment_documents p WHERE p.id = payment_document_id AND p.empresa_id IS NOT NULL AND p.empresa_id = public.current_empresa_id()));
CREATE INDEX IF NOT EXISTS idx_doc_changelog_doc ON public.document_change_logs(payment_document_id);

CREATE POLICY "paydocs_owner_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-documents' AND owner = auth.uid());
CREATE POLICY "paydocs_owner_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-documents' AND owner = auth.uid());
CREATE POLICY "paydocs_federal_all" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'payment-documents' AND public.is_federal(auth.uid())) WITH CHECK (bucket_id = 'payment-documents' AND public.is_federal(auth.uid()));

DROP POLICY IF EXISTS empresas_filiais_read ON public.empresas;
CREATE POLICY empresas_filiais_read ON public.empresas FOR SELECT TO authenticated USING (matriz_id = public.current_empresa_id());

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_federal(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_empresa_id() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_federal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_empresa_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_boleto_status_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_generic_activity() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notificar_status_boleto() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;