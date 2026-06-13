-- TASK 12 — Perf: rimozione policy permissive ridondanti (GRUPPO A) (2026-06-13)
-- ============================================================
-- ⚠️  DROP POLICY (distruttivo, ma SICURO): ogni policy rimossa qui è
--     già COMPLETAMENTE coperta da un'altra policy permissive sulla
--     stessa tabella/azione (le permissive sono in OR). Quindi il
--     comportamento — chi può fare cosa — NON cambia. Si riduce solo il
--     numero di policy valutate per query (warning multiple_permissive).
--
-- L'isolamento cross-tenant resta garantito da *_tenant_isolation
-- (RESTRICTIVE, non toccate).
--
-- NON include il "gruppo B" (le SELECT USING true): quello cambierebbe
-- la visibilità degli operatori → decisione separata.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- cantieri INSERT: insert_admin (admin) ⊂ insert_responsabile (admin_or_resp)
DROP POLICY IF EXISTS cantieri_insert_admin ON public.cantieri;

-- lavorazioni_cantiere DELETE: delete_admin (admin) ⊂ lavorazioni_delete (admin_or_resp)
DROP POLICY IF EXISTS lavorazioni_cantiere_delete_admin ON public.lavorazioni_cantiere;

-- lavorazioni_cantiere INSERT: insert_admin e insert_proposta ⊂ lavorazioni_insert
--   (admin_or_resp, senza vincolo di stato → già la più larga in OR)
DROP POLICY IF EXISTS lavorazioni_cantiere_insert_admin ON public.lavorazioni_cantiere;
DROP POLICY IF EXISTS lavorazioni_cantiere_insert_proposta ON public.lavorazioni_cantiere;

-- lavorazioni_cantiere UPDATE: lavorazioni_update (admin_or_resp) ⊂
--   lavorazioni_cantiere_update_operativo (admin_or_resp OR operatore su attiva).
--   Tengo update_operativo (superset, mantiene anche l'operatore).
DROP POLICY IF EXISTS lavorazioni_update ON public.lavorazioni_cantiere;

NOTIFY pgrst, 'reload schema';
