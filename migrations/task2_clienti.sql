-- TASK 2 — Anagrafica clienti (2026-06-11)
-- ============================================================
-- Tabella clienti per azienda + aggancio a cantieri e rapporti.
-- Il campo testuale cliente_committente sui rapporti resta come
-- snapshot del nome (i rapporti firmati sono immutabili).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- 1. Estensione trigram per l'anti-doppioni (ricerca per similarità)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Tabella clienti
CREATE TABLE public.clienti (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL,
  ragione_sociale TEXT NOT NULL,
  email TEXT,            -- necessaria per il Task 5 (invio PDF)
  telefono TEXT,
  indirizzo TEXT,
  note TEXT DEFAULT '' NOT NULL,
  attivo BOOLEAN NOT NULL DEFAULT true,
  creato_da UUID,
  creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX clienti_ragione_sociale_trgm_idx
  ON public.clienti USING gin (ragione_sociale gin_trgm_ops);
CREATE INDEX clienti_azienda_idx ON public.clienti (azienda_id);

ALTER TABLE public.clienti ENABLE ROW LEVEL SECURITY;

CREATE POLICY clienti_tenant_isolation ON public.clienti
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

CREATE POLICY clienti_select ON public.clienti
  FOR SELECT TO authenticated USING (true);

-- Inserimento rapido anche dal flusso rapporto: admin E responsabili
CREATE POLICY clienti_insert ON public.clienti
  FOR INSERT TO authenticated
  WITH CHECK (public.current_is_admin_or_responsabile());

CREATE POLICY clienti_update ON public.clienti
  FOR UPDATE TO authenticated
  USING (public.current_is_admin_or_responsabile())
  WITH CHECK (public.current_is_admin_or_responsabile());

CREATE POLICY clienti_delete_admin ON public.clienti
  FOR DELETE TO authenticated USING (public.current_is_admin());

-- 3. Aggancio a cantieri e rapporti (nullable: i dati esistenti
--    restano col solo testo)
ALTER TABLE public.cantieri
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clienti(id);
ALTER TABLE public.rapporti_intervento
  ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.clienti(id);

-- 4. RPC anti-doppioni: clienti con ragione sociale simile (trigram).
--    SECURITY INVOKER: rispetta le RLS (vede solo la propria azienda).
CREATE OR REPLACE FUNCTION public.cerca_clienti_simili(nome TEXT)
RETURNS SETOF public.clienti
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT *
  FROM public.clienti
  WHERE attivo = true
    AND similarity(ragione_sociale, nome) > 0.35
  ORDER BY similarity(ragione_sociale, nome) DESC
  LIMIT 5;
$$;

-- ============================================================
-- TEST su DEV:
--   A) Responsabile: crea cliente → ok; utente azienda 2 non lo vede
--   B) Operaio: SELECT ok, INSERT negato
--   C) similarity('Rossi Srl', 'rossi s.r.l.') > 0.3 → vero (pg_trgm ok)
--   D) Cantiere e rapporto con cliente_id valorizzato → FK ok
