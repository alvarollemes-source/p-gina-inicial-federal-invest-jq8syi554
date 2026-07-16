
CREATE OR REPLACE FUNCTION public.log_generic_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_modulo text := TG_ARGV[0];
  v_acao text;
  v_detalhes jsonb;
  v_empresa uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := TG_ARGV[0] || '.criado';
    v_detalhes := to_jsonb(NEW);
    BEGIN v_empresa := (to_jsonb(NEW)->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa := NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := TG_ARGV[0] || '.atualizado';
    v_detalhes := jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW));
    BEGIN v_empresa := (to_jsonb(NEW)->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa := NULL; END;
    -- Ação especializada para mudança de status de boleto
    IF TG_ARGV[0] = 'boletos' AND OLD.status IS DISTINCT FROM NEW.status THEN
      v_acao := 'boletos.status.' || NEW.status;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := TG_ARGV[0] || '.excluido';
    v_detalhes := to_jsonb(OLD);
    BEGIN v_empresa := (to_jsonb(OLD)->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa := NULL; END;
  END IF;

  INSERT INTO public.logs_atividade (user_id, empresa_id, acao, modulo, detalhes)
  VALUES (v_user, v_empresa, v_acao, v_modulo, v_detalhes);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_boletos ON public.boletos;
CREATE TRIGGER trg_log_boletos
AFTER INSERT OR UPDATE OR DELETE ON public.boletos
FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('boletos');

DROP TRIGGER IF EXISTS trg_log_conversoes_ofx ON public.conversoes_ofx;
CREATE TRIGGER trg_log_conversoes_ofx
AFTER INSERT OR UPDATE OR DELETE ON public.conversoes_ofx
FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('conversor-ofx');

DROP TRIGGER IF EXISTS trg_log_permissoes ON public.permissoes_individuais;
CREATE TRIGGER trg_log_permissoes
AFTER INSERT OR UPDATE OR DELETE ON public.permissoes_individuais
FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('permissoes');

DROP TRIGGER IF EXISTS trg_log_user_roles ON public.user_roles;
CREATE TRIGGER trg_log_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('usuarios');

DROP TRIGGER IF EXISTS trg_log_empresas ON public.empresas;
CREATE TRIGGER trg_log_empresas
AFTER INSERT OR UPDATE OR DELETE ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('empresas');

DROP TRIGGER IF EXISTS trg_log_profiles ON public.profiles;
CREATE TRIGGER trg_log_profiles
AFTER UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.log_generic_activity('perfil');
