
ALTER TABLE public.boletos
  ADD COLUMN IF NOT EXISTS tipo_pagamento text NOT NULL DEFAULT 'boleto',
  ADD COLUMN IF NOT EXISTS dados_pagamento jsonb;

CREATE INDEX IF NOT EXISTS idx_boletos_tipo_pagamento ON public.boletos(tipo_pagamento);
