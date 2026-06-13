-- TASK 13 — Perf+hardening: rimozione SELECT permissive USING(true) (GRUPPO B) (2026-06-13)
-- ============================================================
-- ⚠️  DROP POLICY (distruttivo). Qui il comportamento CAMBIA — ma in
--     senso voluto: oggi queste SELECT con USING(true), essendo
--     permissive in OR, ANNULLANO le policy "operativo" e fanno vedere
--     all'operaio tutto (dentro l'azienda). L'operaio però deve solo
--     timbrare selezionando cantiere/attività: non gli serve vedere
--     righe inattive né le anagrafiche.
--
-- Tolte le USING(true), restano le policy "*_select_operativo" che danno:
--   - cantieri: operatore → solo cantieri attivo=true
--   - dipendenti: operatore → solo dipendenti attivo=true
--   - lavorazioni_cantiere: operatore → solo attiva=true
--   - timbrature_lavorazioni: operatore → solo le proprie
-- Admin/Responsabile NON cambiano (passano dal ramo admin_or_responsabile).
-- Isolamento cross-tenant invariato (tenant_isolation RESTRICTIVE).
--
-- Eseguire su DEV, TESTARE I FLUSSI OPERAIO (login, selezione cantiere,
-- timbratura, selezione attività), poi PROD.

DROP POLICY IF EXISTS cantieri_select_authenticated ON public.cantieri;
DROP POLICY IF EXISTS dipendenti_select_authenticated ON public.dipendenti;
DROP POLICY IF EXISTS lavorazioni_select ON public.lavorazioni_cantiere;
DROP POLICY IF EXISTS timbrature_lavorazioni_select ON public.timbrature_lavorazioni;

NOTIFY pgrst, 'reload schema';
