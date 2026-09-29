-- Toggle moduli backoffice per piano/azienda (2026-09-29)
-- ============================================================
-- Sistema per nascondere selettivamente i moduli del backoffice: un
-- default per piano di abbonamento (piano_moduli) + eccezioni puntuali
-- per singola azienda (azienda_moduli_override). Nessuna riga per un
-- modulo = abilitato (fail-open, non disturba i clienti esistenti).
--
-- Scope: solo visibilità UI (nasconde le card in /backoffice), non è
-- un confine di sicurezza — le route dei singoli moduli restano
-- raggiungibili via URL diretto, protette solo dai controlli di
-- ruolo/tenant già esistenti (RLS su ogni tabella).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

-- 1. Default per piano di abbonamento
CREATE TABLE public.piano_moduli (
  piano TEXT NOT NULL CHECK (piano IN ('base', 'pro', 'enterprise')),
  modulo TEXT NOT NULL,
  abilitato BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (piano, modulo)
);

ALTER TABLE public.piano_moduli ENABLE ROW LEVEL SECURITY;

-- Lettura per qualunque dipendente autenticato (serve per calcolare
-- cosa vede in /backoffice); scritture solo da service role (superadmin
-- API), nessuna policy INSERT/UPDATE/DELETE per authenticated.
CREATE POLICY piano_moduli_select ON public.piano_moduli
  FOR SELECT TO authenticated USING (true);

-- 2. Eccezioni per singola azienda
CREATE TABLE public.azienda_moduli_override (
  azienda_id UUID NOT NULL REFERENCES public.aziende(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  abilitato BOOLEAN NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (azienda_id, modulo)
);

CREATE INDEX azienda_moduli_override_azienda_idx
  ON public.azienda_moduli_override (azienda_id);

ALTER TABLE public.azienda_moduli_override ENABLE ROW LEVEL SECURITY;

-- RESTRICTIVE come tutte le altre tabelle multi-tenant: anche se in
-- pratica solo il service role scrive qui, la riga resta protetta se
-- mai esposta a un client con RLS.
CREATE POLICY azienda_moduli_override_tenant_isolation
  ON public.azienda_moduli_override
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

CREATE POLICY azienda_moduli_override_select
  ON public.azienda_moduli_override
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- TEST su DEV:
--   A) Nessuna riga in nessuna tabella: /backoffice mostra tutte le card
--      (fail-open) per qualunque azienda
--   B) INSERT piano_moduli ('base','commessa',false): un'azienda con
--      piano='base' non vede più la card Commessa, un'azienda 'pro' sì
--   C) INSERT azienda_moduli_override (azienda_x, 'commessa', true):
--      quell'azienda specifica torna a vedere Commessa anche se il suo
--      piano la disabilita di default
--   D) Utente azienda 1 (RLS): SELECT azienda_moduli_override vede solo
--      le proprie righe
NOTIFY pgrst, 'reload schema';
