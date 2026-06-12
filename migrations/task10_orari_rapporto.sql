-- TASK 10 — Ora di arrivo e partenza sul rapporto (2026-06-12)
-- ============================================================
-- Il compilatore indica l'ora di arrivo in cantiere; la partenza viene
-- proposta con l'ora di compilazione. Le ore degli operatori si
-- calcolano dalla differenza, arrotondata alla mezz'ora successiva.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

ALTER TABLE public.rapporti_intervento
  ADD COLUMN IF NOT EXISTS ora_arrivo TIME,
  ADD COLUMN IF NOT EXISTS ora_partenza TIME;

NOTIFY pgrst, 'reload schema';
