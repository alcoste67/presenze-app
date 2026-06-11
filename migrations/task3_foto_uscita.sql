-- TASK 3 — Foto e note nel flusso timbratura di uscita (2026-06-11)
-- ============================================================
-- Bucket Storage multi-tenant per le foto lavorazioni + estensione di
-- sal_lavorazioni_foto: le foto nuove vanno su Storage (storage_path),
-- le vecchie data URL restano leggibili.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- 1. Bucket privato foto-lavorazioni
INSERT INTO storage.buckets (id, name, public)
VALUES ('foto-lavorazioni', 'foto-lavorazioni', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Policy Storage multi-tenant: path {azienda_id}/{cantiere_id}/...
--    accesso solo se il primo segmento del path = azienda corrente
CREATE POLICY foto_lavorazioni_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'foto-lavorazioni'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
  );

CREATE POLICY foto_lavorazioni_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'foto-lavorazioni'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
  );

CREATE POLICY foto_lavorazioni_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'foto-lavorazioni'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
    AND public.current_is_admin_or_responsabile()
  );

-- 3. sal_lavorazioni_foto: foto su Storage + nota; data URL legacy
ALTER TABLE public.sal_lavorazioni_foto
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS nota TEXT DEFAULT '' NOT NULL;

ALTER TABLE public.sal_lavorazioni_foto
  ALTER COLUMN immagine_data_url DROP NOT NULL;

-- Ogni foto deve avere ALMENO una sorgente (storage o data URL legacy)
ALTER TABLE public.sal_lavorazioni_foto
  ADD CONSTRAINT sal_foto_sorgente_presente
  CHECK (storage_path IS NOT NULL OR immagine_data_url IS NOT NULL);

-- ============================================================
-- TEST su DEV:
--   A) Upload foto da timbratura uscita → file in Storage sotto
--      {azienda_id}/... e riga in sal_lavorazioni_foto con storage_path
--   B) Utente azienda 2: non vede né scarica i file dell'azienda 1
--      (signed URL di un path altrui → errore)
--   C) Le foto legacy (data URL) restano visibili nella pagina SAL
