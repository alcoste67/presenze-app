-- La policy SELECT su checklist_wallbox era "qual = true": nessuna
-- restrizione per riga, solo per azienda (tramite la policy RESTRICTIVE
-- checklist_wallbox_tenant_isolation). Qualunque dipendente poteva quindi
-- leggere TUTTE le checklist dell'azienda via query diretta al DB, anche
-- se la UI ne mostra solo una parte (filtro solo client-side) — dati
-- cliente (nome, telefono, P.IVA, firme) visibili tra colleghi.
--
-- Fix: stessa condizione già in uso per UPDATE/DELETE su questa tabella
-- (ADMIN/RESPONSABILE vedono tutto, gli altri solo le proprie).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

DROP POLICY IF EXISTS checklist_wallbox_select ON public.checklist_wallbox;

CREATE POLICY checklist_wallbox_select ON public.checklist_wallbox
  FOR SELECT TO authenticated
  USING (
    current_is_admin_or_responsabile()
    OR created_by = auth.uid()
  );
