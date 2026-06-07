-- Nuove colonne aziende per registrazione estesa
ALTER TABLE public.aziende
  ADD COLUMN IF NOT EXISTS forma_societaria TEXT,
  ADD COLUMN IF NOT EXISTS sede_legale_via TEXT,
  ADD COLUMN IF NOT EXISTS sede_legale_cap TEXT,
  ADD COLUMN IF NOT EXISTS sede_legale_citta TEXT,
  ADD COLUMN IF NOT EXISTS sede_legale_provincia TEXT,
  ADD COLUMN IF NOT EXISTS pec TEXT,
  ADD COLUMN IF NOT EXISTS codice_sdi TEXT DEFAULT '0000000';

-- Consensi GDPR al momento della registrazione (sull'admin che si iscrive)
ALTER TABLE public.dipendenti
  ADD COLUMN IF NOT EXISTS gdpr_marketing BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gdpr_terzi BOOLEAN NOT NULL DEFAULT FALSE;
