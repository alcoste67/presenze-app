-- TASK 5 — Invio rapporto: PDF archiviato + email_log (2026-06-12)
-- ============================================================
-- 1. Bucket privato rapporti-pdf: la copia legale del PDF inviato.
--    Scrittura SOLO server-side (service role: nessuna policy INSERT
--    per authenticated). Lettura per admin/responsabile della propria
--    azienda. Mai sovrascritto (idempotenza nell'API route).
-- 2. Tabella email_log: prova d'invio (destinatari, esito, message_id
--    Resend) — utile in caso di contestazioni.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- 1. Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('rapporti-pdf', 'rapporti-pdf', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY rapporti_pdf_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rapporti-pdf'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
    AND public.current_is_admin_or_responsabile()
  );

-- 2. Log invii
CREATE TABLE public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL,
  rapporto_intervento_id UUID REFERENCES public.rapporti_intervento(id),
  destinatari TEXT[] NOT NULL,
  cc TEXT[] NOT NULL DEFAULT '{}',
  oggetto TEXT NOT NULL DEFAULT '',
  esito TEXT NOT NULL CHECK (esito IN ('INVIATA', 'ERRORE')),
  message_id TEXT,
  errore TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_log_tenant_isolation ON public.email_log
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

-- Sola lettura per gli admin; la scrittura avviene server-side
CREATE POLICY email_log_select_admin ON public.email_log
  FOR SELECT TO authenticated USING (public.current_is_admin());

-- ============================================================
-- TEST su DEV:
--   A) Invio rapporto firmato → PDF in rapporti-pdf/{azienda_id}/...,
--      riga INVIATA in email_log, stato rapporto INVIATO
--   B) Secondo invio dello stesso rapporto → bloccato (stato INVIATO)
--   C) Utente azienda 2: non legge né i PDF né l'email_log dell'azienda 1
NOTIFY pgrst, 'reload schema';
