ALTER TABLE public.lavorazioni_cantiere
  ADD COLUMN IF NOT EXISTS categoria TEXT,
  ADD COLUMN IF NOT EXISTS unita_misura TEXT,
  ADD COLUMN IF NOT EXISTS quantita NUMERIC(12,3),
  ADD COLUMN IF NOT EXISTS prezzo_unitario NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS note TEXT;

-- Indice per raggruppamento per categoria
CREATE INDEX IF NOT EXISTS idx_lavorazioni_cantiere_categoria
  ON public.lavorazioni_cantiere(cantiere_id, categoria);
