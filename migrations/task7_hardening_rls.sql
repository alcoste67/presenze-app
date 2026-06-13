-- TASK 7 — Hardening RLS + fix lint Supabase (2026-06-13)
-- ============================================================
-- 1. FIX CRITICO: rimuove le policy permissive "always true" su
--    dipendenti e cantieri (INSERT/UPDATE), che — sommandosi in OR alle
--    policy admin — permettevano a QUALSIASI authenticated (anche un
--    operaio) di creare/modificare dipendenti e cantieri della propria
--    azienda. Su dipendenti era possibile l'auto-promozione ad ADMIN.
--    Restano le policy admin (e responsabile per i cantieri); la
--    creazione dipendenti server-side usa il service role (bypassa RLS).
-- 2. Igiene: search_path fisso sulle funzioni trigger/slug.
-- 3. Igiene: restringe insert/update/delete di lavorazioni_cantiere e
--    rapporti_intervento_extra ad admin/responsabile (prima erano `true`;
--    l'isolamento tenant c'era già, ma il ruolo no).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test approfondito, poi PROD.

-- ── 1. Buco critico: policy "true" su dipendenti e cantieri ──
DROP POLICY IF EXISTS dipendenti_insert_authenticated ON public.dipendenti;
DROP POLICY IF EXISTS dipendenti_update_authenticated ON public.dipendenti;
DROP POLICY IF EXISTS cantieri_insert_authenticated ON public.cantieri;
DROP POLICY IF EXISTS cantieri_update_authenticated ON public.cantieri;

-- ── 2. search_path fisso (security: function_search_path_mutable) ──
ALTER FUNCTION public.genera_slug(text) SET search_path = 'public';
ALTER FUNCTION public.blocca_rapporto_firmato() SET search_path = 'public';
ALTER FUNCTION public.blocca_delete_rapporto_firmato() SET search_path = 'public';
ALTER FUNCTION public.blocca_figli_rapporto_firmato() SET search_path = 'public';
ALTER FUNCTION public.blocca_stato_lavorazione_non_admin() SET search_path = 'public';

-- ── 3. Restringe le policy "true" a admin/responsabile ──
-- lavorazioni_cantiere: insert già coperto da lavorazioni_cantiere_insert_proposta
-- (Task 4a); qui ristringo le generiche insert/update/delete.
ALTER POLICY lavorazioni_insert ON public.lavorazioni_cantiere
  WITH CHECK (public.current_is_admin_or_responsabile());
ALTER POLICY lavorazioni_update ON public.lavorazioni_cantiere
  USING (public.current_is_admin_or_responsabile())
  WITH CHECK (public.current_is_admin_or_responsabile());
ALTER POLICY lavorazioni_delete ON public.lavorazioni_cantiere
  USING (public.current_is_admin_or_responsabile());

ALTER POLICY rapporti_extra_insert ON public.rapporti_intervento_extra
  WITH CHECK (public.current_is_admin_or_responsabile());
ALTER POLICY rapporti_extra_update ON public.rapporti_intervento_extra
  USING (public.current_is_admin_or_responsabile())
  WITH CHECK (public.current_is_admin_or_responsabile());
ALTER POLICY rapporti_extra_delete ON public.rapporti_intervento_extra
  USING (public.current_is_admin_or_responsabile());

-- ============================================================
-- TEST su DEV (verificare che NON si rompa nulla):
--   A) Admin: crea/modifica dipendenti, cantieri, lavorazioni, lavori extra → ok
--   B) Responsabile: proponi lavorazione, lavori extra nel rapporto → ok;
--      crea/modifica cantiere (responsabile può), NON dipendenti
--   C) Operaio: NON può creare/modificare dipendenti o cantieri
--   D) Avanzamento %: pagina lavorazioni (admin/resp) ok; wizard uscita ok
--      (usa timbrature_lavorazioni, non lavorazioni_cantiere)
--   E) Collaborazioni: push/accetta funzionano (RPC SECURITY DEFINER, bypassano RLS)
NOTIFY pgrst, 'reload schema';
