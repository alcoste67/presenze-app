-- TASK 11 — Perf: RLS initplan (wrap auth.* in SELECT) (2026-06-13)
-- ============================================================
-- Risolve i warning "auth_rls_initplan": le policy che chiamano
-- auth.uid()/auth.jwt() direttamente li rivalutano per OGNI riga.
-- Avvolgendoli in (select ...) Postgres li valuta UNA volta sola.
-- Semantica IDENTICA: cambia solo il piano di esecuzione, non chi
-- vede/scrive cosa. Le policy che usano current_is_admin() ecc. NON
-- sono toccate (il linter non le segnala).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- ---- cantieri_collaborazioni ----
ALTER POLICY collab_select ON public.cantieri_collaborazioni
  USING (
    (azienda_committente_id = current_azienda_id())
    OR (azienda_collaboratrice_id = current_azienda_id())
    OR (lower(email_invito) = lower(((select auth.jwt()) ->> 'email'::text)))
  );

-- ---- rapporti_intervento ----
ALTER POLICY rapporti_intervento_insert_operativo ON public.rapporti_intervento
  WITH CHECK (current_is_admin_or_responsabile() OR (created_by = (select auth.uid())));

-- ---- sal_freeze_foto ----
ALTER POLICY sal_freeze_foto_delete_admin ON public.sal_freeze_foto
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));
ALTER POLICY sal_freeze_foto_insert_admin ON public.sal_freeze_foto
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));
ALTER POLICY sal_freeze_foto_select_admin_responsabile ON public.sal_freeze_foto
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text, 'RESPONSABILE'::text]));
ALTER POLICY sal_freeze_foto_update_admin ON public.sal_freeze_foto
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]))
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));

-- ---- sal_freeze_lavorazioni ----
ALTER POLICY sal_freeze_lavorazioni_delete_admin ON public.sal_freeze_lavorazioni
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));
ALTER POLICY sal_freeze_lavorazioni_insert_admin ON public.sal_freeze_lavorazioni
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));
ALTER POLICY sal_freeze_lavorazioni_select_admin_responsabile ON public.sal_freeze_lavorazioni
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text, 'RESPONSABILE'::text]));
ALTER POLICY sal_freeze_lavorazioni_update_admin ON public.sal_freeze_lavorazioni
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]))
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));

-- ---- sal_freeze_macchinari ----
ALTER POLICY sal_freeze_macchinari_delete_admin ON public.sal_freeze_macchinari
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));
ALTER POLICY sal_freeze_macchinari_insert_admin ON public.sal_freeze_macchinari
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));
ALTER POLICY sal_freeze_macchinari_select_admin ON public.sal_freeze_macchinari
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));
ALTER POLICY sal_freeze_macchinari_update_admin ON public.sal_freeze_macchinari
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]))
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));

-- ---- sal_freeze_mensili ----
ALTER POLICY sal_freeze_mensili_delete_admin ON public.sal_freeze_mensili
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));
ALTER POLICY sal_freeze_mensili_insert_admin ON public.sal_freeze_mensili
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));
ALTER POLICY sal_freeze_mensili_select_admin_responsabile ON public.sal_freeze_mensili
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text, 'RESPONSABILE'::text]));
ALTER POLICY sal_freeze_mensili_update_admin ON public.sal_freeze_mensili
  USING ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]))
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['ADMIN'::text, 'SUPERADMIN'::text]));

-- ---- sal_lavorazioni_foto ----
ALTER POLICY sal_lavorazioni_foto_delete_operativo ON public.sal_lavorazioni_foto
  USING (current_is_admin_or_responsabile() OR (created_by = (select auth.uid())));
ALTER POLICY sal_lavorazioni_foto_insert_operativo ON public.sal_lavorazioni_foto
  WITH CHECK (current_is_admin_or_responsabile() OR (current_is_operatore() AND (created_by = (select auth.uid()))));
ALTER POLICY sal_lavorazioni_foto_update_operativo ON public.sal_lavorazioni_foto
  USING (current_is_admin_or_responsabile() OR (created_by = (select auth.uid())))
  WITH CHECK (current_is_admin_or_responsabile() OR (created_by = (select auth.uid())));

-- ---- timbrature ----
ALTER POLICY timbrature_insert_operativo ON public.timbrature
  WITH CHECK (current_is_admin_or_responsabile() OR (user_id = (select auth.uid())));
ALTER POLICY timbrature_select_operativo ON public.timbrature
  USING (current_is_admin_or_responsabile() OR (user_id = (select auth.uid())));

-- ============================================================
-- NOTA: i warning "multiple_permissive_policies" NON sono toccati qui:
-- vanno valutati caso per caso (alcuni sono ridondanze, altri sono
-- combinazioni intenzionali admin/responsabile/operatore). Vedi analisi
-- separata prima di fonderli, per non allargare i permessi RLS.
NOTIFY pgrst, 'reload schema';
