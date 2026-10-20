-- Malattia come tipo di richieste_assenza (2026-10-20)
-- ============================================================
-- La malattia è un fatto documentato dal certificato medico, non una
-- richiesta del dipendente: l'admin la registra direttamente già
-- APPROVATA, con un intervallo di date (dal...al), stesso pattern già
-- usato per 'ALTRO' (vedi 20261005000000_compila_giornata_vuota.sql).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

ALTER TABLE public.richieste_assenza
  DROP CONSTRAINT richieste_assenza_tipo_check;

ALTER TABLE public.richieste_assenza
  ADD CONSTRAINT richieste_assenza_tipo_check
    CHECK (tipo IN ('FERIE', 'PERMESSO', 'ALTRO', 'MALATTIA'));

-- ============================================================
-- TEST su DEV:
--   A) INSERT tipo='MALATTIA' con data_inizio < data_fine → ok
--   B) INSERT tipo='MALATTIA' con data_fine < data_inizio → errore
--      (richieste_assenza_date_check, già esistente)
--   C) Richieste FERIE/PERMESSO/ALTRO esistenti non sono toccate
NOTIFY pgrst, 'reload schema';
