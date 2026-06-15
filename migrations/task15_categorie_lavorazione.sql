-- TASK 15 — Categorie lavorazioni personalizzabili per azienda (2026-06-15)
-- ============================================================
-- Vocabolario di macro-aree (IMPIANTI ELETTRICI, DATI, DOMOTICA, ...)
-- gestibile da Backoffice. lavorazioni_cantiere.categoria resta TEXT (il
-- nome): questa tabella popola i menu/filtri, non è un vincolo rigido.
-- Multi-tenant: ogni azienda ha le sue categorie.
--
-- Idempotente: ri-eseguibile senza errori (IF NOT EXISTS / DROP POLICY).
-- Eseguire su DEV (mkfedjazibcmstkjxkfm) e su PROD (skdtczhvxvawwjanciss).

CREATE TABLE IF NOT EXISTS public.categorie_lavorazione (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL,
  nome TEXT NOT NULL,
  ordine INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- niente doppioni (case-insensitive) per azienda
CREATE UNIQUE INDEX IF NOT EXISTS categorie_lavorazione_azienda_nome_uidx
  ON public.categorie_lavorazione (azienda_id, lower(nome));

CREATE INDEX IF NOT EXISTS categorie_lavorazione_azienda_idx
  ON public.categorie_lavorazione (azienda_id);

ALTER TABLE public.categorie_lavorazione ENABLE ROW LEVEL SECURITY;

-- Isolamento tenant (gate RESTRICTIVE come le altre tabelle)
DROP POLICY IF EXISTS categorie_lavorazione_tenant_isolation ON public.categorie_lavorazione;
CREATE POLICY categorie_lavorazione_tenant_isolation
  ON public.categorie_lavorazione
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

-- Lettura: qualunque dipendente dell'azienda (dropdown + filtro timbratura)
DROP POLICY IF EXISTS categorie_lavorazione_select ON public.categorie_lavorazione;
CREATE POLICY categorie_lavorazione_select
  ON public.categorie_lavorazione
  FOR SELECT TO authenticated
  USING (public.current_dipendente_ruolo() IS NOT NULL);

-- Scrittura: solo admin/responsabile
DROP POLICY IF EXISTS categorie_lavorazione_insert ON public.categorie_lavorazione;
CREATE POLICY categorie_lavorazione_insert
  ON public.categorie_lavorazione
  FOR INSERT TO authenticated
  WITH CHECK (public.current_is_admin_or_responsabile());

DROP POLICY IF EXISTS categorie_lavorazione_update ON public.categorie_lavorazione;
CREATE POLICY categorie_lavorazione_update
  ON public.categorie_lavorazione
  FOR UPDATE TO authenticated
  USING (public.current_is_admin_or_responsabile())
  WITH CHECK (public.current_is_admin_or_responsabile());

DROP POLICY IF EXISTS categorie_lavorazione_delete ON public.categorie_lavorazione;
CREATE POLICY categorie_lavorazione_delete
  ON public.categorie_lavorazione
  FOR DELETE TO authenticated
  USING (public.current_is_admin_or_responsabile());

-- ============================================================
-- TEST:
--   A) admin crea/rinomina/elimina categorie → ok
--   B) operatore legge le categorie (timbratura) → ok, ma non scrive
--   C) azienda B non vede le categorie di azienda A (isolamento)
NOTIFY pgrst, 'reload schema';
