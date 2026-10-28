-- Aziende con accesso ristretto alla sola checklist Wallbox A2C (2026-10-28)
-- ============================================================
-- Per alcuni clienti (es. "FUNI") l'intero accesso a Cantivo deve ridursi
-- alla compilazione della checklist Wallbox in formato A2C: niente
-- Timbrature/Storico/altro backoffice, niente scelta del formato Edison.
-- Controllo di sola VISIBILITA' lato client (stesso principio di
-- lib/wallboxAccess.ts): i dati restano comunque isolati per azienda_id
-- via RLS, qui non si tocca nessuna policy.
--
-- Ricorda: l'azienda deve comunque essere abilitata alla checklist
-- wallbox tramite la variabile Vercel NEXT_PUBLIC_WALLBOX_AZIENDA_IDS,
-- altrimenti non vede nemmeno quella pagina.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

ALTER TABLE public.aziende
  ADD COLUMN IF NOT EXISTS solo_checklist_wallbox_a2c boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
