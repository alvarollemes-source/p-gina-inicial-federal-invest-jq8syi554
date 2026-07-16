
CREATE OR REPLACE FUNCTION public.empresas_permitidas(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (SELECT empresa_id FROM public.profiles WHERE id = _user_id)
  SELECT e.id FROM public.empresas e, me
  WHERE me.empresa_id IS NOT NULL
    AND (e.id = me.empresa_id OR e.matriz_id = me.empresa_id)
$$;

DROP POLICY IF EXISTS boletos_own_empresa_read ON public.boletos;
CREATE POLICY boletos_own_empresa_read ON public.boletos
FOR SELECT
USING (
  empresa_id IN (SELECT public.empresas_permitidas(auth.uid()))
  OR usuario_envio_id = auth.uid()
);
