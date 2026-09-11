-- TASK 21 — Formato di stampa scelto alla creazione della checklist wallbox (2026-09-11)
-- ============================================================
-- Il formato Edison/A2C si sceglie all'apertura di "Nuova checklist",
-- non più con un selettore separato dopo la firma: resta memorizzato
-- sul record e guida scarica/invio/WhatsApp senza dover rispecificarlo.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD.

ALTER TABLE public.checklist_wallbox
  ADD COLUMN IF NOT EXISTS formato_stampa TEXT NOT NULL DEFAULT 'EDISON'
    CHECK (formato_stampa IN ('EDISON', 'A2C'));

NOTIFY pgrst, 'reload schema';
