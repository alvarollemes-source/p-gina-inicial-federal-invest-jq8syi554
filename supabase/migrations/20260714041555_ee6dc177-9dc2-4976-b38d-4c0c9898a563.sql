
-- 1) Fecha vazamento de dados de empresas para requisições anônimas
DROP POLICY IF EXISTS empresas_filiais_read ON public.empresas;
CREATE POLICY empresas_filiais_read
  ON public.empresas
  FOR SELECT
  TO authenticated
  USING (matriz_id = public.current_empresa_id());

-- 2) Revoga EXECUTE de anon nas SECURITY DEFINER usadas em RLS
--    (authenticated mantém EXECUTE — RLS precisa dele)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_federal(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_empresa_id() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_federal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_empresa_id() TO authenticated;

-- 3) Trigger-only functions: nenhum caller direto precisa de EXECUTE
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_boleto_status_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_generic_activity() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notificar_status_boleto() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
