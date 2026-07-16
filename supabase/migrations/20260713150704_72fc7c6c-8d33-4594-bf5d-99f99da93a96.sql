
-- Notificações internas
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'boleto_recebido' | 'boleto_aprovado' | 'boleto_rejeitado' | 'boleto_pago'
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

CREATE POLICY "user reads own notifications" ON public.notificacoes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user updates own notifications" ON public.notificacoes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "user deletes own notifications" ON public.notificacoes
  FOR DELETE TO authenticated USING (user_id = auth.uid());
-- Sem INSERT policy para authenticated: notificações são criadas via trigger SECURITY DEFINER.

ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;

-- Trigger: cria notificações a cada mudança de status relevante
CREATE OR REPLACE FUNCTION public.notificar_status_boleto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  benef TEXT;
  valor NUMERIC;
  fed RECORD;
BEGIN
  benef := COALESCE(NEW.beneficiario_nome, 'boleto');
  valor := COALESCE(NEW.valor_cobrado, NEW.valor_documento, 0);

  -- Operador enviou para pagamento (rascunho -> recebido, ou insert direto como recebido)
  IF NEW.status = 'recebido' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'recebido') THEN
    FOR fed IN
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('admin','gestor','analista')
    LOOP
      INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, boleto_id)
      VALUES (fed.user_id, 'boleto_recebido',
              'Novo boleto recebido',
              'Boleto de ' || benef || ' foi enviado para pagamento.',
              NEW.id);
    END LOOP;
  END IF;

  -- Federal alterou status: notifica operador que enviou
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status IN ('aprovado','rejeitado','pago')
     AND NEW.usuario_envio_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (user_id, tipo, titulo, mensagem, boleto_id)
    VALUES (
      NEW.usuario_envio_id,
      'boleto_' || NEW.status,
      CASE NEW.status
        WHEN 'aprovado' THEN 'Boleto aprovado'
        WHEN 'rejeitado' THEN 'Boleto rejeitado'
        WHEN 'pago' THEN 'Boleto pago'
      END,
      'Seu boleto de ' || benef || ' foi ' ||
        CASE NEW.status WHEN 'pago' THEN 'pago' WHEN 'aprovado' THEN 'aprovado' ELSE 'rejeitado' END || '.',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notificar_status_boleto
AFTER INSERT OR UPDATE OF status ON public.boletos
FOR EACH ROW EXECUTE FUNCTION public.notificar_status_boleto();
