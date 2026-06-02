-- Aggiunge colonne SaaS alla tabella aziende
ALTER TABLE public.aziende
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS sito_web TEXT,
  ADD COLUMN IF NOT EXISTS colori JSONB DEFAULT '{"primary":"#e95624","secondary":"#1a1a2e"}',
  ADD COLUMN IF NOT EXISTS stato_abbonamento TEXT NOT NULL DEFAULT 'trial'
    CHECK (stato_abbonamento IN ('trial','attivo','sospeso','scaduto')),
  ADD COLUMN IF NOT EXISTS piano TEXT DEFAULT 'base'
    CHECK (piano IN ('base','pro','enterprise')),
  ADD COLUMN IF NOT EXISTS trial_scadenza TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  ADD COLUMN IF NOT EXISTS abbonamento_scadenza TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Aggiunge superadmin come ruolo dipendenti
ALTER TABLE public.dipendenti
  DROP CONSTRAINT IF EXISTS dipendenti_ruolo_check;
ALTER TABLE public.dipendenti
  ADD CONSTRAINT dipendenti_ruolo_check
  CHECK (ruolo IN ('OPERAIO','RESPONSABILE','UFFICIO','ADMIN','SUPERADMIN'));

-- RLS su aziende: admin vede solo la sua, superadmin vede tutto
ALTER TABLE public.aziende ENABLE ROW LEVEL SECURITY;

CREATE POLICY aziende_select_own ON public.aziende
  FOR SELECT TO authenticated
  USING (id = public.current_azienda_id());

CREATE POLICY aziende_update_own ON public.aziende
  FOR UPDATE TO authenticated
  USING (id = public.current_azienda_id())
  WITH CHECK (id = public.current_azienda_id());

-- Slug da nome azienda (auto-generato)
CREATE OR REPLACE FUNCTION public.genera_slug(nome TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(trim(nome), '[^a-zA-Z0-9]+', '-', 'g'))
$$;
