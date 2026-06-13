-- TASK 8b — Revoca anon sulle funzioni helper delle policy (2026-06-13, v2)
-- ============================================================
-- current_*/can_* sono SECURITY DEFINER usate DENTRO le policy RLS.
-- Nessuna policy è valutata in contesto anon (verificato: 0 policy TO
-- anon/public), quindi anon non le esegue mai → si può togliere a anon
-- l'EXECUTE in sicurezza. authenticated resta (le policy degli utenti
-- loggati ne hanno bisogno).
--
-- ⚠️ v1 (REVOKE FROM anon) era INEFFICACE: anon eredita EXECUTE da PUBLIC,
--    quindi il privilegio restava. Va revocato da PUBLIC e poi ri-concesso
--    solo ad authenticated.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test login + query, poi PROD.

DO $$
DECLARE fn TEXT;
BEGIN
  FOR fn IN SELECT unnest(ARRAY[
    'public.current_azienda_id()',
    'public.current_dipendente_ruolo()',
    'public.current_is_admin()',
    'public.current_is_admin_or_responsabile()',
    'public.current_is_operatore()',
    'public.can_edit_rapporto_intervento(uuid)',
    'public.can_edit_timbratura_lavorazione(uuid)',
    'public.can_view_rapporto_intervento(uuid)'
  ])
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon;', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', fn);
  END LOOP;
END $$;

-- ============================================================
-- TEST su DEV (deve continuare a funzionare tutto):
--   A) Login OTP + accesso normale (le policy girano come authenticated)
--   B) Timbrature, rapporti, SAL, collaborazioni
-- Restano accettati: gli authenticated_*_executable (necessari alle
-- policy/RPC), pg_trgm, leaked_password → marcabili "Ignore" nell'Advisor.
NOTIFY pgrst, 'reload schema';
