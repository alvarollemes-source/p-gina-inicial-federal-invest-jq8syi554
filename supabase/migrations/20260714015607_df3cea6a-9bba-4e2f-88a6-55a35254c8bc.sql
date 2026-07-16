CREATE POLICY empresas_filiais_read ON public.empresas
FOR SELECT
USING (matriz_id = public.current_empresa_id());