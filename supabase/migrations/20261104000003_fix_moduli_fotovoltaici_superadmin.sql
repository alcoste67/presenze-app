-- FOTOVOLTAICO — fix ruolo SUPERADMIN su moduli_fotovoltaici (2026-11-04)
-- ============================================================
-- Le policy di scrittura create in 20261104000000_moduli_fotovoltaici.sql
-- controllavano `current_dipendente_ruolo() = 'ADMIN'` in senso stretto,
-- escludendo SUPERADMIN (ruolo diverso da 'ADMIN', vedi
-- 20261030000003_superadmin_in_ruolo_helpers.sql: un SUPERADMIN deve
-- avere almeno gli stessi permessi di un ADMIN). Un utente SUPERADMIN
-- vedeva quindi il form del catalogo (gating app-level via isAdmin(),
-- che include SUPERADMIN) ma riceveva "new row violates row-level
-- security policy" (42501) al salvataggio.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

DROP POLICY IF EXISTS moduli_fotovoltaici_insert ON public.moduli_fotovoltaici;
CREATE POLICY moduli_fotovoltaici_insert ON public.moduli_fotovoltaici
  FOR INSERT TO authenticated
  WITH CHECK (public.current_dipendente_ruolo() IN ('ADMIN', 'SUPERADMIN'));

DROP POLICY IF EXISTS moduli_fotovoltaici_update ON public.moduli_fotovoltaici;
CREATE POLICY moduli_fotovoltaici_update ON public.moduli_fotovoltaici
  FOR UPDATE TO authenticated
  USING (public.current_dipendente_ruolo() IN ('ADMIN', 'SUPERADMIN'))
  WITH CHECK (public.current_dipendente_ruolo() IN ('ADMIN', 'SUPERADMIN'));

DROP POLICY IF EXISTS moduli_fotovoltaici_delete ON public.moduli_fotovoltaici;
CREATE POLICY moduli_fotovoltaici_delete ON public.moduli_fotovoltaici
  FOR DELETE TO authenticated USING (public.current_dipendente_ruolo() IN ('ADMIN', 'SUPERADMIN'));

-- ============================================================
-- TEST su DEV:
--   A) Utente SUPERADMIN: crea/modifica/elimina modulo → ok (prima falliva con 42501)
--   B) Utente ADMIN: invariato, continua a funzionare
--   C) Utente non admin: INSERT/UPDATE/DELETE ancora bloccato da RLS
NOTIFY pgrst, 'reload schema';
