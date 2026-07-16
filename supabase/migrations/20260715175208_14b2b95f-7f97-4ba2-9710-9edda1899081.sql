
CREATE OR REPLACE FUNCTION public.log_generic_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user uuid := auth.uid(); v_modulo text := TG_ARGV[0]; v_acao text; v_detalhes jsonb; v_empresa uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_acao := TG_ARGV[0] || '.criado'; v_detalhes := to_jsonb(NEW);
    BEGIN v_empresa := (to_jsonb(NEW)->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa := NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_acao := TG_ARGV[0] || '.atualizado'; v_detalhes := jsonb_build_object('antes', to_jsonb(OLD), 'depois', to_jsonb(NEW));
    BEGIN v_empresa := (to_jsonb(NEW)->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa := NULL; END;
    IF TG_ARGV[0] = 'boletos' THEN
      IF (to_jsonb(OLD)->>'status') IS DISTINCT FROM (to_jsonb(NEW)->>'status') THEN
        v_acao := 'boletos.status.' || (to_jsonb(NEW)->>'status');
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := TG_ARGV[0] || '.excluido'; v_detalhes := to_jsonb(OLD);
    BEGIN v_empresa := (to_jsonb(OLD)->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa := NULL; END;
  END IF;
  INSERT INTO public.logs_atividade (user_id, empresa_id, acao, modulo, detalhes) VALUES (v_user, v_empresa, v_acao, v_modulo, v_detalhes);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $function$;

DROP POLICY IF EXISTS boletos_own_delete ON public.boletos;
CREATE POLICY boletos_own_delete ON public.boletos
  FOR DELETE
  TO authenticated
  USING (usuario_envio_id = auth.uid() AND status = 'rascunho');
