
ALTER TABLE public.boletos ALTER COLUMN status SET DEFAULT 'rascunho';

DROP POLICY IF EXISTS boletos_own_empresa_update ON public.boletos;
CREATE POLICY boletos_own_empresa_update ON public.boletos
  FOR UPDATE TO authenticated
  USING (usuario_envio_id = auth.uid() AND status IN ('rascunho','recebido'))
  WITH CHECK (usuario_envio_id = auth.uid());
