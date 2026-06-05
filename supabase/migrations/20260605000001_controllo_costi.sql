-- Contratto per cantiere
CREATE TABLE IF NOT EXISTS public.contratti_cantiere (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cantiere_id UUID NOT NULL REFERENCES public.cantieri(id) ON DELETE CASCADE,
  azienda_id UUID REFERENCES public.aziende(id),
  importo_contratto NUMERIC(14,2),
  importo_extra_lavori NUMERIC(14,2) DEFAULT 0,
  data_firma DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(cantiere_id)
);

-- Costi materiali per cantiere
CREATE TABLE IF NOT EXISTS public.costi_materiali_cantiere (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cantiere_id UUID NOT NULL REFERENCES public.cantieri(id) ON DELETE CASCADE,
  azienda_id UUID REFERENCES public.aziende(id),
  descrizione TEXT NOT NULL,
  fornitore TEXT,
  quantita NUMERIC(12,3) DEFAULT 1,
  prezzo_unitario NUMERIC(12,2) NOT NULL,
  data_acquisto DATE,
  numero_ddt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Costo orario dipendente
ALTER TABLE public.dipendenti
  ADD COLUMN IF NOT EXISTS costo_orario NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS ral NUMERIC(10,2);

-- Costo orario macchinario
ALTER TABLE public.macchinari
  ADD COLUMN IF NOT EXISTS costo_orario NUMERIC(8,2);

-- RLS
ALTER TABLE public.contratti_cantiere ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costi_materiali_cantiere ENABLE ROW LEVEL SECURITY;

CREATE POLICY contratti_cantiere_tenant_isolation ON public.contratti_cantiere
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

CREATE POLICY costi_materiali_cantiere_tenant_isolation ON public.costi_materiali_cantiere
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());
