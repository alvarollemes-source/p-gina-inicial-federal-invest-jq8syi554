
-- ============================================================
-- FEDERAL INVEST TRUSTEE — MIGRATION 001 (foundation)
-- ============================================================

-- ---------- Helper: updated_at trigger ----------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- EMPRESAS
-- ============================================================
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

CREATE TRIGGER empresas_updated_at
BEFORE UPDATE ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- PROFILES
-- ============================================================
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

CREATE TRIGGER profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- ROLES
-- ============================================================
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

-- has_role: security definer to prevent recursive RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- is_federal: gestor/admin/analista (Federal Invest staff)
CREATE OR REPLACE FUNCTION public.is_federal(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'gestor', 'analista')
  )
$$;

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- PROFILES / EMPRESAS / USER_ROLES policies
-- ============================================================
CREATE POLICY "profiles_self_read" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_federal_read" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "empresas_federal_read" ON public.empresas
  FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "empresas_own_read" ON public.empresas
  FOR SELECT TO authenticated USING (id = public.current_empresa_id());
CREATE POLICY "empresas_admin_all" ON public.empresas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_self_read" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_roles_federal_read" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "user_roles_admin_all" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- PERMISSOES INDIVIDUAIS
-- ============================================================
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
CREATE TRIGGER permissoes_individuais_updated_at
BEFORE UPDATE ON public.permissoes_individuais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "perm_self_read" ON public.permissoes_individuais
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "perm_admin_all" ON public.permissoes_individuais
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- LOGS
-- ============================================================
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

CREATE POLICY "logs_insert_self" ON public.logs_atividade
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "logs_federal_read" ON public.logs_atividade
  FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "logs_admin_all" ON public.logs_atividade
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- BOLETOS: enrich existing table
-- ============================================================
ALTER TABLE public.boletos
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usuario_envio_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observacoes_internas TEXT,
  ADD COLUMN IF NOT EXISTS observacoes_cliente TEXT,
  ADD COLUMN IF NOT EXISTS metodo_extracao TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'recebido',
  ADD COLUMN IF NOT EXISTS data_envio TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER boletos_updated_at
BEFORE UPDATE ON public.boletos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Replace permissive policies
DROP POLICY IF EXISTS boletos_all_anon ON public.boletos;
DROP POLICY IF EXISTS boletos_all_authenticated ON public.boletos;

CREATE POLICY "boletos_own_empresa_read" ON public.boletos
  FOR SELECT TO authenticated USING (
    empresa_id = public.current_empresa_id() OR usuario_envio_id = auth.uid()
  );
CREATE POLICY "boletos_federal_read" ON public.boletos
  FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "boletos_own_empresa_insert" ON public.boletos
  FOR INSERT TO authenticated WITH CHECK (
    usuario_envio_id = auth.uid()
  );
CREATE POLICY "boletos_own_empresa_update" ON public.boletos
  FOR UPDATE TO authenticated
  USING (usuario_envio_id = auth.uid() AND status = 'recebido')
  WITH CHECK (usuario_envio_id = auth.uid());
CREATE POLICY "boletos_federal_update" ON public.boletos
  FOR UPDATE TO authenticated
  USING (public.is_federal(auth.uid()))
  WITH CHECK (public.is_federal(auth.uid()));
CREATE POLICY "boletos_admin_all" ON public.boletos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- HISTORICO STATUS BOLETO
-- ============================================================
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

CREATE POLICY "hist_read_boleto" ON public.historico_status_boleto
  FOR SELECT TO authenticated USING (
    public.is_federal(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.boletos b
      WHERE b.id = boleto_id AND (b.empresa_id = public.current_empresa_id() OR b.usuario_envio_id = auth.uid())
    )
  );

CREATE OR REPLACE FUNCTION public.log_boleto_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.historico_status_boleto (boleto_id, user_id, status_anterior, status_novo)
    VALUES (NEW.id, auth.uid(), CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER boletos_status_history
AFTER INSERT OR UPDATE OF status ON public.boletos
FOR EACH ROW EXECUTE FUNCTION public.log_boleto_status_change();

-- ============================================================
-- CONVERSOES OFX
-- ============================================================
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

CREATE POLICY "ofx_own_empresa_read" ON public.conversoes_ofx
  FOR SELECT TO authenticated USING (empresa_id = public.current_empresa_id() OR user_id = auth.uid());
CREATE POLICY "ofx_federal_read" ON public.conversoes_ofx
  FOR SELECT TO authenticated USING (public.is_federal(auth.uid()));
CREATE POLICY "ofx_insert" ON public.conversoes_ofx
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "ofx_admin_all" ON public.conversoes_ofx
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- handle_new_user trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
