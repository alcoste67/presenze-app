-- Blocca l'assegnazione del ruolo SUPERADMIN su dipendenti (2026-09-29)
-- ============================================================
-- Contesto: il pannello piattaforma (/superadmin) non si fida più del
-- ruolo per-tenant SUPERADMIN — è gated solo da PLATFORM_ADMIN_EMAILS
-- (vedi lib/platformAdmin.ts). L'app (crea-con-auth + form dipendenti)
-- non offre più SUPERADMIN come ruolo assegnabile, ma quel controllo
-- vive solo lato applicazione: la modifica di un dipendente passa dal
-- client via RLS (aggiornaDipendente.ts), che filtra le RIGHE per
-- azienda_id ma non impedisce il VALORE scritto in `ruolo`. Un client
-- HTTP forgiato a mano potrebbe quindi ancora scrivere ruolo=SUPERADMIN
-- via Supabase REST, bypassando l'app.
--
-- Fix: un trigger blocca qualunque INSERT/UPDATE che porti ruolo a
-- SUPERADMIN, a meno che la riga non sia già SUPERADMIN (permette di
-- editare altri campi delle 2 righe esistenti, o di declassarle, ma non
-- di assegnare SUPERADMIN a una riga nuova o diversa). Si applica anche
-- alle scritture da service role: se in futuro serve concedere di nuovo
-- SUPERADMIN a qualcuno, va disabilitato temporaneamente il trigger via
-- SQL diretto — friction point voluto ("togli superadmin per chiunque
-- tranne per me").
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

CREATE OR REPLACE FUNCTION public.blocca_assegnazione_superadmin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ruolo = 'SUPERADMIN'
     AND (TG_OP = 'INSERT' OR OLD.ruolo IS DISTINCT FROM 'SUPERADMIN') THEN
    RAISE EXCEPTION
      'Assegnazione del ruolo SUPERADMIN non consentita: contattare il titolare della piattaforma'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

DROP TRIGGER IF EXISTS trg_blocca_assegnazione_superadmin ON public.dipendenti;
CREATE TRIGGER trg_blocca_assegnazione_superadmin
  BEFORE INSERT OR UPDATE ON public.dipendenti
  FOR EACH ROW EXECUTE FUNCTION public.blocca_assegnazione_superadmin();

-- ============================================================
-- TEST su DEV:
--   A) INSERT nuovo dipendente con ruolo='SUPERADMIN' → errore
--   B) UPDATE di un dipendente ADMIN esistente a ruolo='SUPERADMIN' → errore
--   C) UPDATE di uno dei 2 dipendenti già SUPERADMIN cambiando solo nome
--      (ruolo invariato) → ok
--   D) UPDATE di uno dei 2 dipendenti già SUPERADMIN a ruolo='ADMIN'
--      (declassamento) → ok
--   E) Ripetere A e B anche con un client service-role (supabaseAdmin):
--      il trigger si applica comunque, non solo a RLS
NOTIFY pgrst, 'reload schema';
