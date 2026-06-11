-- TASK 2b — Email cliente univoca per azienda (2026-06-11)
-- ============================================================
-- L'email di un cliente non deve essere duplicabile all'interno della
-- stessa azienda (case-insensitive). NULL resta consentito (più clienti
-- senza email).
--
-- ⚠️ PRIMA di eseguire: eliminare/correggere i duplicati esistenti,
-- altrimenti la CREATE INDEX fallisce. Query di controllo:
--
--   SELECT azienda_id, lower(email), count(*), array_agg(ragione_sociale)
--   FROM clienti
--   WHERE email IS NOT NULL
--   GROUP BY 1, 2
--   HAVING count(*) > 1;
--
-- Su DEV sono dati di prova: sistemali dalla pagina Anagrafica clienti
-- (modifica/disattiva) o con UPDATE manuali.

CREATE UNIQUE INDEX clienti_email_unica_per_azienda
  ON public.clienti (azienda_id, lower(email))
  WHERE email IS NOT NULL;

-- TEST: creare due clienti con la stessa email (anche con maiuscole
-- diverse) → il secondo deve fallire con violazione di unicità.
