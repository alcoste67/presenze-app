-- La policy SELECT di note-spese-scontrini controllava solo il primo
-- segmento del path (azienda_id): qualunque dipendente della stessa
-- azienda poteva leggere/firmare l'URL della foto scontrino di un collega,
-- conoscendone o indovinando il path ({azienda_id}/{dipendente_id}/...).
-- Aggiunge il controllo sul secondo segmento (deve corrispondere a chi
-- chiama), con bypass per ADMIN/SUPERADMIN (necessario per l'approvazione
-- note spese). Stessa restrizione sull'INSERT, per evitare che un
-- dipendente possa scrivere file nella cartella di un collega.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

DROP POLICY IF EXISTS note_spese_scontrini_select ON storage.objects;

CREATE POLICY note_spese_scontrini_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'note-spese-scontrini'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.dipendenti d
        WHERE d.auth_user_id = auth.uid()
          AND d.azienda_id = public.current_azienda_id()
          AND d.attivo = true
          AND d.ruolo IN ('ADMIN', 'SUPERADMIN')
      )
    )
  );

DROP POLICY IF EXISTS note_spese_scontrini_insert ON storage.objects;

CREATE POLICY note_spese_scontrini_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'note-spese-scontrini'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
