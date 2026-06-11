-- TASK 4b — Attività "Cantiere nuovo" (2026-06-11)
-- ============================================================
-- I responsabili devono poter creare un cantiere dal campo (flusso
-- timbratura: entrata su attività CANTIERE_NUOVO, alla timbratura di
-- uscita inseriscono i dati del cantiere che viene creato al volo).
-- La INSERT su cantieri oggi è riservata all'admin.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- Nuova attività CANTIERE_NUOVO nel CHECK delle timbrature
ALTER TABLE public.timbrature
  DROP CONSTRAINT IF EXISTS timbrature_attivita_tipo_check;
ALTER TABLE public.timbrature
  ADD CONSTRAINT timbrature_attivita_tipo_check
  CHECK (
    attivita_tipo IS NULL
    OR attivita_tipo = ANY (ARRAY[
      'ACQUISTI'::text, 'TRASFERTA'::text, 'MAGAZZINO'::text,
      'UFFICIO'::text, 'SOPRALLUOGO'::text, 'ASSISTENZA'::text,
      'VISITA_MEDICA'::text, 'FORMAZIONE'::text, 'CANTIERE_NUOVO'::text,
      'ALTRO'::text
    ])
  );

DROP POLICY IF EXISTS cantieri_insert_responsabile ON public.cantieri;
CREATE POLICY cantieri_insert_responsabile ON public.cantieri
  FOR INSERT TO authenticated
  WITH CHECK (public.current_is_admin_or_responsabile());

-- ============================================================
-- TEST su DEV:
--   A) Responsabile: crea cantiere dal flusso uscita → ok
--   B) Operaio: INSERT cantiere → negato
NOTIFY pgrst, 'reload schema';
