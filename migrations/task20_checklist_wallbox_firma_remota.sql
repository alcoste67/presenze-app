-- TASK 20 — Firma remota del cliente sulla checklist wallbox (2026-09-11)
-- ============================================================
-- Stesso pattern di task17_firma_remota.sql (rapporti_intervento):
-- il tecnico firma in app, poi "invia per firma remota". Si crea un
-- token (= id di questa tabella, UUID non indovinabile). Il cliente apre
-- il link pubblico /checklist-wallbox/firma-remota/{token}, firma a
-- schermo, e la checklist diventa FIRMATO.
--
-- L'accesso pubblico avviene SOLO via API server con service role che
-- valida il token: nessun accesso anon diretto a questa tabella (RLS
-- solo per il lato autenticato admin/responsabile).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD.

CREATE TABLE public.checklist_wallbox_firma_remota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_wallbox_id UUID NOT NULL
    REFERENCES public.checklist_wallbox(id) ON DELETE CASCADE,
  azienda_id UUID NOT NULL,
  email_destinatario TEXT,
  stato TEXT NOT NULL DEFAULT 'in_attesa'
    CHECK (stato IN ('in_attesa', 'firmato', 'annullato')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  firmato_at TIMESTAMPTZ
);

CREATE INDEX idx_checklist_wallbox_firma_remota_checklist_id
  ON public.checklist_wallbox_firma_remota (checklist_wallbox_id);
CREATE INDEX idx_checklist_wallbox_firma_remota_azienda_id
  ON public.checklist_wallbox_firma_remota (azienda_id);

ALTER TABLE public.checklist_wallbox_firma_remota ENABLE ROW LEVEL SECURITY;

CREATE POLICY checklist_wallbox_firma_remota_tenant_isolation
  ON public.checklist_wallbox_firma_remota
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

CREATE POLICY checklist_wallbox_firma_remota_select
  ON public.checklist_wallbox_firma_remota
  FOR SELECT TO authenticated
  USING (public.current_is_admin_or_responsabile());

CREATE POLICY checklist_wallbox_firma_remota_insert
  ON public.checklist_wallbox_firma_remota
  FOR INSERT TO authenticated
  WITH CHECK (public.current_is_admin_or_responsabile());

CREATE POLICY checklist_wallbox_firma_remota_update
  ON public.checklist_wallbox_firma_remota
  FOR UPDATE TO authenticated
  USING (public.current_is_admin_or_responsabile())
  WITH CHECK (public.current_is_admin_or_responsabile());

-- ============================================================
-- TEST su DEV:
--   A) Responsabile firma come tecnico, invia per firma remota → link
--      creato, email al cliente (best-effort)
--   B) Cliente apre il link, firma → checklist passa a FIRMATO
--   C) Link già usato/scaduto/annullato → errore, nessuna modifica
--   D) Utente azienda 2 non vede i token dell'azienda 1
NOTIFY pgrst, 'reload schema';
