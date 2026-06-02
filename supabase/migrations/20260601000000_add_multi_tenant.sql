-- Multi-tenant preparation: aggiunge azienda_id nullable a tabelle principali

-- 1. Tabella aziende
CREATE TABLE IF NOT EXISTS public.aziende (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codice_fiscale TEXT,
  partita_iva TEXT,
  indirizzo TEXT,
  email TEXT,
  telefono TEXT,
  attiva BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Seed azienda A2C SISTEMI (tenant attuale)
INSERT INTO public.aziende (id, nome, attiva)
VALUES ('00000000-0000-0000-0000-000000000001', 'A2C SISTEMI', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 3. Aggiunge azienda_id NULLABLE alle tabelle principali
ALTER TABLE public.dipendenti ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.cantieri ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.macchinari ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.lavorazioni_cantiere ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.timbrature ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.timbrature_lavorazioni ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.rapporti_intervento ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.rapporti_intervento_foto ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.rapporti_intervento_lavorazioni ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.rapporti_intervento_materiali ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.rapporti_intervento_operatori ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.sal_freeze_mensili ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.sal_freeze_lavorazioni ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.sal_freeze_foto ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.sal_freeze_macchinari ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.sal_lavorazioni_foto ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);
ALTER TABLE public.costi_macchinari_commessa ADD COLUMN IF NOT EXISTS azienda_id UUID REFERENCES public.aziende(id);

-- 4. Backfill: tutti i record esistenti → A2C SISTEMI
UPDATE public.dipendenti SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.cantieri SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.macchinari SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.lavorazioni_cantiere SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.timbrature SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.timbrature_lavorazioni SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.rapporti_intervento SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.rapporti_intervento_foto SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.rapporti_intervento_lavorazioni SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.rapporti_intervento_materiali SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.rapporti_intervento_operatori SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.sal_freeze_mensili SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.sal_freeze_lavorazioni SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.sal_freeze_foto SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.sal_freeze_macchinari SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.sal_lavorazioni_foto SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;
UPDATE public.costi_macchinari_commessa SET azienda_id = '00000000-0000-0000-0000-000000000001' WHERE azienda_id IS NULL;

-- 5. Indici per performance su query filtrate per azienda
CREATE INDEX IF NOT EXISTS idx_dipendenti_azienda ON public.dipendenti(azienda_id);
CREATE INDEX IF NOT EXISTS idx_cantieri_azienda ON public.cantieri(azienda_id);
CREATE INDEX IF NOT EXISTS idx_macchinari_azienda ON public.macchinari(azienda_id);
CREATE INDEX IF NOT EXISTS idx_lavorazioni_cantiere_azienda ON public.lavorazioni_cantiere(azienda_id);
CREATE INDEX IF NOT EXISTS idx_timbrature_azienda ON public.timbrature(azienda_id);
CREATE INDEX IF NOT EXISTS idx_rapporti_intervento_azienda ON public.rapporti_intervento(azienda_id);
CREATE INDEX IF NOT EXISTS idx_sal_freeze_mensili_azienda ON public.sal_freeze_mensili(azienda_id);
