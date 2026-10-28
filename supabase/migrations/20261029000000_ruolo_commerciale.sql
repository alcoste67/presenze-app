-- Ruolo "Commerciale" per i dipendenti (2026-10-29)
-- ============================================================
-- Nuovo ruolo selezionabile in scheda dipendente. Per ora non ha permessi
-- speciali (stesso livello di accesso di un operaio): in futuro avrà
-- accesso a funzionalità dedicate per la compilazione di modelli di
-- sopralluogo, non ancora implementate.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

ALTER TABLE public.dipendenti
  DROP CONSTRAINT dipendenti_ruolo_check;

ALTER TABLE public.dipendenti
  ADD CONSTRAINT dipendenti_ruolo_check
  CHECK (ruolo IN ('OPERAIO','RESPONSABILE','UFFICIO','COMMERCIALE','ADMIN','SUPERADMIN'));

NOTIFY pgrst, 'reload schema';
