-- FOTOVOLTAICO — Fase 4, aggiunta planimetria (2026-11-04)
-- ============================================================
-- Spazio per uno schizzo sintetico della falda/impianto, stesso
-- meccanismo di checklist_wallbox.planimetria_data_url (canvas firmato
-- a mano salvato come data URL PNG). Campo libero, non obbligatorio.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD.

ALTER TABLE public.checklist_fotovoltaico
  ADD COLUMN IF NOT EXISTS planimetria_data_url TEXT;

NOTIFY pgrst, 'reload schema';
