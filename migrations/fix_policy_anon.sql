-- FIX CRITICO — Policy RLS aperte al ruolo anon (2026-06-10)
-- ============================================================
-- Problema: policy PERMISSIVE con TO public e USING(true) permettono a
-- client NON autenticati (ruolo anon, es. sessione scaduta) di leggere
-- e in alcuni casi scrivere dati di TUTTE le aziende: le policy
-- RESTRICTIVE di tenant isolation valgono solo per authenticated.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD
-- (skdtczhvxvawwjanciss). Le policy sono identiche sui due ambienti.

-- 1. cantieri: SELECT aperta a tutti (causa del bug "cantieri fantasma"
--    nelle timbrature). Restano le SELECT per authenticated.
DROP POLICY IF EXISTS cantieri_select ON public.cantieri;

-- 2. rapporti_intervento e tabelle figlie: policy admin_all TO public
--    con USING(true) = accesso TOTALE anonimo in lettura E scrittura.
--    Le policy *_operativo per authenticated restano e bastano.
DROP POLICY IF EXISTS rapporti_intervento_admin_all ON public.rapporti_intervento;
DROP POLICY IF EXISTS rapporti_intervento_foto_admin_all ON public.rapporti_intervento_foto;
DROP POLICY IF EXISTS rapporti_intervento_lavorazioni_admin_all ON public.rapporti_intervento_lavorazioni;
DROP POLICY IF EXISTS rapporti_intervento_materiali_admin_all ON public.rapporti_intervento_materiali;

-- 3. sal_freeze_*: TO public ma con check sul JWT (un anon non passa il
--    check, quindi nessun leak attivo). Ricreate TO authenticated per igiene.
ALTER POLICY sal_freeze_foto_select_admin_responsabile ON public.sal_freeze_foto TO authenticated;
ALTER POLICY sal_freeze_foto_insert_admin ON public.sal_freeze_foto TO authenticated;
ALTER POLICY sal_freeze_foto_update_admin ON public.sal_freeze_foto TO authenticated;
ALTER POLICY sal_freeze_foto_delete_admin ON public.sal_freeze_foto TO authenticated;
ALTER POLICY sal_freeze_lavorazioni_select_admin_responsabile ON public.sal_freeze_lavorazioni TO authenticated;
ALTER POLICY sal_freeze_lavorazioni_insert_admin ON public.sal_freeze_lavorazioni TO authenticated;
ALTER POLICY sal_freeze_lavorazioni_update_admin ON public.sal_freeze_lavorazioni TO authenticated;
ALTER POLICY sal_freeze_lavorazioni_delete_admin ON public.sal_freeze_lavorazioni TO authenticated;
ALTER POLICY sal_freeze_macchinari_select_admin ON public.sal_freeze_macchinari TO authenticated;
ALTER POLICY sal_freeze_macchinari_insert_admin ON public.sal_freeze_macchinari TO authenticated;
ALTER POLICY sal_freeze_macchinari_update_admin ON public.sal_freeze_macchinari TO authenticated;
ALTER POLICY sal_freeze_macchinari_delete_admin ON public.sal_freeze_macchinari TO authenticated;
ALTER POLICY sal_freeze_mensili_select_admin_responsabile ON public.sal_freeze_mensili TO authenticated;
ALTER POLICY sal_freeze_mensili_insert_admin ON public.sal_freeze_mensili TO authenticated;
ALTER POLICY sal_freeze_mensili_update_admin ON public.sal_freeze_mensili TO authenticated;
ALTER POLICY sal_freeze_mensili_delete_admin ON public.sal_freeze_mensili TO authenticated;

-- ============================================================
-- 4. SOLO SU PROD — pulizia timbrature di test cross-tenant:
--    timbrature di utenti netwisp che puntano a cantieri dell'azienda
--    00000000-…-0001 (cantiere non visibile → "Destinazione non disponibile").
--    ⚠️ DELETE: eseguire solo dopo aver verificato il SELECT di controllo.

-- Controllo (deve restituire solo le righe di test di oggi):
-- SELECT t.id, t.tipo, t.created_at FROM timbrature t
--   JOIN cantieri c ON c.id = t.cantiere_id
--   WHERE t.azienda_id <> c.azienda_id;

DELETE FROM timbrature t
USING cantieri c
WHERE c.id = t.cantiere_id
  AND t.azienda_id <> c.azienda_id;

-- ============================================================
-- TEST dopo l'applicazione:
--   A) Client anon (solo apikey, senza Authorization):
--      GET /rest/v1/cantieri?select=*        → []
--      GET /rest/v1/rapporti_intervento?select=*  → []
--   B) Utente autenticato: timbrature, rapporti e back-office funzionano
--      come prima (le policy authenticated non sono state toccate).
