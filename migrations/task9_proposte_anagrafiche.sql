-- TASK 9 — Clienti e cantieri proposti dal campo (2026-06-12)
-- ============================================================
-- Dal flusso di compilazione rapporto si possono creare al volo cliente
-- e cantiere: nascono con da_verificare = true e l'admin li approva
-- dalle rispettive anagrafiche (pattern analogo alle lavorazioni
-- proposte, semplificato a flag booleano).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

ALTER TABLE public.clienti
  ADD COLUMN IF NOT EXISTS da_verificare BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.cantieri
  ADD COLUMN IF NOT EXISTS da_verificare BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- TEST su DEV:
--   A) Crea cliente e cantiere dal rapporto → compaiono "Da verificare"
--      nelle anagrafiche; l'admin li approva e il badge sparisce
--   B) Cliente/cantiere creati dalle pagine admin → da_verificare = false
NOTIFY pgrst, 'reload schema';
