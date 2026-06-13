-- TASK 8 — Riduzione warning lint (revoke EXECUTE mirati) (2026-06-13)
-- ============================================================
-- Riduce i warning "*_security_definer_function_executable" SENZA
-- toccare le funzioni usate dentro le policy RLS (current_*, can_*),
-- che DEVONO restare eseguibili o le query si romperebbero.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- 1. Funzione vecchia non più usata (sostituita da
--    accetta_collaborazione_crea_cantiere): si rimuove del tutto.
DROP FUNCTION IF EXISTS public.accetta_collaborazione(UUID, UUID);

-- 2. Trigger function: non vanno MAI chiamate via API (girano solo dai
--    trigger). Revoca completa di EXECUTE.
REVOKE EXECUTE ON FUNCTION public.blocca_rapporto_firmato() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.blocca_delete_rapporto_firmato() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.blocca_figli_rapporto_firmato() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.blocca_stato_lavorazione_non_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.segnala_avanzamento_collaboratore() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_azienda_id_on_insert() FROM PUBLIC, anon, authenticated;

-- 3. RPC dell'app: servono solo agli utenti loggati → tolgo anon, lascio
--    authenticated. (l'app le chiama sempre da sessione autenticata)
DO $$
DECLARE fn TEXT;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'public.accetta_collaborazione_crea_cantiere(uuid)',
    'public.invia_lavorazioni_subappaltatore(uuid)',
    'public.sal_collaborazioni_cantiere(uuid)',
    'public.segna_collaborazioni_viste()'
  ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', fn);
  END LOOP;
END $$;

-- ============================================================
-- NOTA: restano (accettati, non sono vulnerabilità nel nostro contesto):
--  - 2 security_definer_view (macchinari): nascondono i prezzi ai
--    non-admin, RLS non può farlo. Deroga documentata (Task 0).
--  - current_*/can_* definer executable: usate DENTRO le policy RLS,
--    devono restare eseguibili da authenticated (toglierle romperebbe
--    ogni query). Validano comunque internamente.
--  - extension pg_trgm in public: innocua.
--  - leaked_password: non applicabile (login OTP, niente password).
-- Questi si possono marcare "Ignore" nell'Advisor di Supabase.
--
-- TEST su DEV: collaborazioni (accetta/invia/SAL/avvisi) e
-- firma/lock rapporti continuano a funzionare.
NOTIFY pgrst, 'reload schema';
