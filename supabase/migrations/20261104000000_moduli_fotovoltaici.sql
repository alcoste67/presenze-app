-- FOTOVOLTAICO — Fase 1 (2026-11-04)
-- ============================================================
-- Catalogo moduli fotovoltaici per azienda, usato per:
--  a) la pagina backoffice di anagrafica (CRUD + import automatico
--     da scheda tecnica PDF via Claude, nessun salvataggio automatico:
--     l'estrazione è sempre una preview editabile lato client);
--  b) il dropdown di scelta modulo nella checklist fotovoltaico
--     (Fase 2/3), per suggerire il modulo più adatto allo spazio
--     disponibile in falda.
--
-- A differenza di `macchinari` (anagrafica ammessa in lettura solo agli
-- ADMIN, con vista `macchinari_pubblici` per gli altri ruoli), qui non
-- ci sono dati sensibili da nascondere: la lettura è aperta a tutti i
-- dipendenti attivi dell'azienda (serve per il dropdown), la scrittura
-- resta riservata agli ADMIN.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD.

-- 1. Tabella
CREATE TABLE public.moduli_fotovoltaici (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL REFERENCES public.aziende(id),

  marca TEXT NOT NULL,
  modello TEXT NOT NULL,
  potenza_wp NUMERIC NOT NULL CHECK (potenza_wp > 0),
  lunghezza_mm NUMERIC NOT NULL CHECK (lunghezza_mm > 0),
  larghezza_mm NUMERIC NOT NULL CHECK (larghezza_mm > 0),
  spessore_mm NUMERIC CHECK (spessore_mm IS NULL OR spessore_mm > 0),
  peso_kg NUMERIC CHECK (peso_kg IS NULL OR peso_kg > 0),

  attivo BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX moduli_fotovoltaici_azienda_idx ON public.moduli_fotovoltaici (azienda_id);

-- 2. RLS: stesso pattern RESTRICTIVE + policy per ruolo di checklist_wallbox
ALTER TABLE public.moduli_fotovoltaici ENABLE ROW LEVEL SECURITY;

CREATE POLICY moduli_fotovoltaici_tenant_isolation ON public.moduli_fotovoltaici
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

CREATE POLICY moduli_fotovoltaici_select ON public.moduli_fotovoltaici
  FOR SELECT TO authenticated USING (true);

CREATE POLICY moduli_fotovoltaici_insert ON public.moduli_fotovoltaici
  FOR INSERT TO authenticated
  WITH CHECK (public.current_dipendente_ruolo() = 'ADMIN');

CREATE POLICY moduli_fotovoltaici_update ON public.moduli_fotovoltaici
  FOR UPDATE TO authenticated
  USING (public.current_dipendente_ruolo() = 'ADMIN')
  WITH CHECK (public.current_dipendente_ruolo() = 'ADMIN');

CREATE POLICY moduli_fotovoltaici_delete ON public.moduli_fotovoltaici
  FOR DELETE TO authenticated USING (public.current_dipendente_ruolo() = 'ADMIN');

-- ============================================================
-- TEST su DEV:
--   A) ADMIN azienda 1: crea/modifica/elimina modulo → ok
--   B) Operaio azienda 1: SELECT ok (serve per il dropdown), INSERT/UPDATE/DELETE → bloccato da RLS
--   C) Utente azienda 2: non vede i moduli dell'azienda 1 (tenant isolation)
NOTIFY pgrst, 'reload schema';
