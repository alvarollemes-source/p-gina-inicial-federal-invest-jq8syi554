-- Adiciona vínculo matriz/filial para empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS matriz_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS empresas_matriz_id_idx ON public.empresas(matriz_id);

-- Impede loop: uma matriz não pode apontar para si mesma
ALTER TABLE public.empresas
  DROP CONSTRAINT IF EXISTS empresas_matriz_nao_recursiva;
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_matriz_nao_recursiva CHECK (matriz_id IS NULL OR matriz_id <> id);