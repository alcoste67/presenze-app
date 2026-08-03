-- TASK 17 — Firma remota del cliente sui rapporti di lavoro (2026-06-16)
-- ============================================================
-- Flusso: il responsabile firma in app e "invia per firma remota". Si crea
-- un token (= id di questa tabella, UUID non indovinabile). Il cliente apre
-- il link pubblico /firma-remota/{token}, firma a schermo, e il rapporto
-- diventa FIRMATO (poi invio automatico del PDF).
--
-- L'accesso pubblico avviene SOLO via API server con service role che valida
-- il token: nessun accesso anon diretto a questa tabella (RLS solo per il
-- lato autenticato admin/responsabile).
--
-- Eseguire su DEV (mkfedjazibcmstkjxkfm) e su PROD (skdtczhvxvawwjanciss).

CREATE TABLE IF NOT EXISTS public.rapporti_firma_remota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rapporto_intervento_id UUID NOT NULL
    REFERENCES public.rapporti_intervento(id) ON DELETE CASCADE,
  azienda_id UUID NOT NULL,
  email_destinatario TEXT,
  stato TEXT NOT NULL DEFAULT 'in_attesa'
    CHECK (stato = ANY (ARRAY['in_attesa'::text, 'firmato'::text, 'annullato'::text])),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  firmato_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rapporti_firma_remota_rapporto_id
  ON public.rapporti_firma_remota (rapporto_intervento_id);
CREATE INDEX IF NOT EXISTS idx_rapporti_firma_remota_azienda_id
  ON public.rapporti_firma_remota (azienda_id);

ALTER TABLE public.rapporti_firma_remota ENABLE ROW LEVEL SECURITY;

-- Isolamento tenant (gate RESTRICTIVE come le altre tabelle)
DROP POLICY IF EXISTS rapporti_firma_remota_tenant_isolation ON public.rapporti_firma_remota;
CREATE POLICY rapporti_firma_remota_tenant_isolation
  ON public.rapporti_firma_remota
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

-- Gestione riservata ad admin/responsabile (la firma pubblica passa dal
-- service role lato server, non da queste policy)
DROP POLICY IF EXISTS rapporti_firma_remota_select ON public.rapporti_firma_remota;
CREATE POLICY rapporti_firma_remota_select
  ON public.rapporti_firma_remota
  FOR SELECT TO authenticated
  USING (public.current_is_admin_or_responsabile());

DROP POLICY IF EXISTS rapporti_firma_remota_insert ON public.rapporti_firma_remota;
CREATE POLICY rapporti_firma_remota_insert
  ON public.rapporti_firma_remota
  FOR INSERT TO authenticated
  WITH CHECK (public.current_is_admin_or_responsabile());

DROP POLICY IF EXISTS rapporti_firma_remota_update ON public.rapporti_firma_remota;
CREATE POLICY rapporti_firma_remota_update
  ON public.rapporti_firma_remota
  FOR UPDATE TO authenticated
  USING (public.current_is_admin_or_responsabile())
  WITH CHECK (public.current_is_admin_or_responsabile());

NOTIFY pgrst, 'reload schema';
