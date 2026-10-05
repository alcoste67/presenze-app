-- Compilazione admin di una giornata senza timbrature (2026-10-05)
-- ============================================================
-- Quando un admin trova una giornata lavorativa di un dipendente senza
-- nessuna timbratura, deve poterla classificare come Ferie/Permesso/Altro,
-- registrandola già APPROVATA (riusa richieste_assenza così compare
-- automaticamente su calendario ed export): non è una richiesta da
-- concordare con il dipendente, è l'admin che documenta un fatto già
-- avvenuto.
--
-- 1. Aggiunge 'ALTRO' ai tipi ammessi.
-- 2. 'ALTRO' richiede sempre una nota (non ha un significato fisso come
--    FERIE/PERMESSO).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

ALTER TABLE public.richieste_assenza
  DROP CONSTRAINT richieste_assenza_tipo_check;

ALTER TABLE public.richieste_assenza
  ADD CONSTRAINT richieste_assenza_tipo_check
    CHECK (tipo IN ('FERIE', 'PERMESSO', 'ALTRO'));

ALTER TABLE public.richieste_assenza
  ADD CONSTRAINT richieste_assenza_altro_nota_check
    CHECK (tipo <> 'ALTRO' OR length(trim(nota)) > 0);

-- ============================================================
-- TEST su DEV:
--   A) INSERT tipo='ALTRO' con nota vuota → errore
--   B) INSERT tipo='ALTRO' con nota valorizzata → ok
--   C) Richieste FERIE/PERMESSO esistenti non sono toccate (constraint
--      verificato solo sulle nuove scritture)
NOTIFY pgrst, 'reload schema';
