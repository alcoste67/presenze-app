-- FIX — SUPERADMIN bloccato dalle policy RLS (2026-06-10)
-- ============================================================
-- Problema: lato app isAdmin() considera admin sia ADMIN che SUPERADMIN,
-- ma 26 policy RLS confrontano il ruolo con 'ADMIN' esatto. Risultato:
-- un SUPERADMIN passa i controlli UI ma il DB rifiuta (42501), es.
-- creazione macchinario.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- 1. Helper: admin "vero" = ADMIN o SUPERADMIN
CREATE OR REPLACE FUNCTION public.current_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select coalesce(
    public.current_dipendente_ruolo() in ('ADMIN', 'SUPERADMIN'),
    false
  )
$$;

-- 2. Allinea anche il helper esistente
CREATE OR REPLACE FUNCTION public.current_is_admin_or_responsabile()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select coalesce(
    public.current_dipendente_ruolo() in ('ADMIN', 'SUPERADMIN', 'RESPONSABILE'),
    false
  )
$$;

-- 3. Policy con current_dipendente_ruolo() = 'ADMIN' → current_is_admin()
ALTER POLICY cantieri_delete_admin ON public.cantieri USING (public.current_is_admin());
ALTER POLICY cantieri_insert_admin ON public.cantieri WITH CHECK (public.current_is_admin());
ALTER POLICY cantieri_update_admin ON public.cantieri USING (public.current_is_admin()) WITH CHECK (public.current_is_admin());
ALTER POLICY costi_macchinari_commessa_select_backoffice ON public.costi_macchinari_commessa USING (public.current_is_admin());
ALTER POLICY dipendenti_delete_admin ON public.dipendenti USING (public.current_is_admin());
ALTER POLICY dipendenti_insert_admin ON public.dipendenti WITH CHECK (public.current_is_admin());
ALTER POLICY dipendenti_update_admin ON public.dipendenti USING (public.current_is_admin()) WITH CHECK (public.current_is_admin());
ALTER POLICY lavorazioni_cantiere_delete_admin ON public.lavorazioni_cantiere USING (public.current_is_admin());
ALTER POLICY lavorazioni_cantiere_insert_admin ON public.lavorazioni_cantiere WITH CHECK (public.current_is_admin());
ALTER POLICY macchinari_delete_admin ON public.macchinari USING (public.current_is_admin());
ALTER POLICY macchinari_insert_admin ON public.macchinari WITH CHECK (public.current_is_admin());
ALTER POLICY macchinari_select_admin ON public.macchinari USING (public.current_is_admin());
ALTER POLICY macchinari_update_admin ON public.macchinari USING (public.current_is_admin()) WITH CHECK (public.current_is_admin());

-- 4. Policy sal_freeze_* che leggono il ruolo dal JWT (app_metadata.role):
--    ammetti anche SUPERADMIN
ALTER POLICY sal_freeze_foto_delete_admin ON public.sal_freeze_foto USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_foto_insert_admin ON public.sal_freeze_foto WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_foto_update_admin ON public.sal_freeze_foto USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN')) WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_foto_select_admin_responsabile ON public.sal_freeze_foto USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN', 'RESPONSABILE'));
ALTER POLICY sal_freeze_lavorazioni_delete_admin ON public.sal_freeze_lavorazioni USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_lavorazioni_insert_admin ON public.sal_freeze_lavorazioni WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_lavorazioni_update_admin ON public.sal_freeze_lavorazioni USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN')) WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_lavorazioni_select_admin_responsabile ON public.sal_freeze_lavorazioni USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN', 'RESPONSABILE'));
ALTER POLICY sal_freeze_macchinari_delete_admin ON public.sal_freeze_macchinari USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_macchinari_insert_admin ON public.sal_freeze_macchinari WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_macchinari_update_admin ON public.sal_freeze_macchinari USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN')) WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_macchinari_select_admin ON public.sal_freeze_macchinari USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_mensili_delete_admin ON public.sal_freeze_mensili USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_mensili_insert_admin ON public.sal_freeze_mensili WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_mensili_update_admin ON public.sal_freeze_mensili USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN')) WITH CHECK (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN'));
ALTER POLICY sal_freeze_mensili_select_admin_responsabile ON public.sal_freeze_mensili USING (((auth.jwt() -> 'app_metadata') ->> 'role') IN ('ADMIN', 'SUPERADMIN', 'RESPONSABILE'));

-- ============================================================
-- TEST:
--   A) Come SUPERADMIN: crea/modifica/elimina un macchinario → ok
--   B) Come ADMIN normale: tutto invariato
--   C) Come RESPONSABILE: continua a NON poter creare macchinari,
--      cantieri, dipendenti (solo uso macchinari e rapporti)
