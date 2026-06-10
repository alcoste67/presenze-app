-- Allineamento DEV → PROD (2026-06-10)
-- ============================================================
-- Analisi comparativa completa DEV vs PROD: schemi identici
-- (tabelle, policy, funzioni, trigger, indici, constraint, bucket)
-- TRANNE 9 colonne presenti solo in PROD (anagrafica fiscale aziende
-- e consensi GDPR dipendenti, deployment mai riportati su DEV).
--
-- Eseguire SOLO su DEV (mkfedjazibcmstkjxkfm).

ALTER TABLE aziende ADD COLUMN IF NOT EXISTS codice_sdi TEXT DEFAULT '0000000';
ALTER TABLE aziende ADD COLUMN IF NOT EXISTS forma_societaria TEXT;
ALTER TABLE aziende ADD COLUMN IF NOT EXISTS pec TEXT;
ALTER TABLE aziende ADD COLUMN IF NOT EXISTS sede_legale_via TEXT;
ALTER TABLE aziende ADD COLUMN IF NOT EXISTS sede_legale_citta TEXT;
ALTER TABLE aziende ADD COLUMN IF NOT EXISTS sede_legale_cap TEXT;
ALTER TABLE aziende ADD COLUMN IF NOT EXISTS sede_legale_provincia TEXT;

ALTER TABLE dipendenti ADD COLUMN IF NOT EXISTS gdpr_marketing BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE dipendenti ADD COLUMN IF NOT EXISTS gdpr_terzi BOOLEAN NOT NULL DEFAULT false;
