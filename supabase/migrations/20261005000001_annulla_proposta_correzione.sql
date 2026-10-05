-- Annullamento proposta correzione turno aperto (2026-10-05)
-- ============================================================
-- Oggi, se il dipendente non risponde a una proposta di correzione turno
-- aperto, l'admin resta bloccato: non può né chiuderla né inviarne una
-- nuova (c'è un indice univoco su una sola proposta IN_ATTESA per
-- turno). Il promemoria giornaliero (già in produzione) aiuta ma non
-- basta se il dipendente ignora anche quello. Aggiunge 'ANNULLATA' come
-- stato valido, così l'admin può annullare la proposta bloccata e
-- inviarne una corretta.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

ALTER TABLE public.timbrature_proposte_correzione
  DROP CONSTRAINT timbrature_proposte_correzione_stato_check;

ALTER TABLE public.timbrature_proposte_correzione
  ADD CONSTRAINT timbrature_proposte_correzione_stato_check
    CHECK (stato IN ('IN_ATTESA', 'CONFERMATA', 'RIFIUTATA', 'ANNULLATA'));

-- ============================================================
-- TEST su DEV:
--   A) Proposta IN_ATTESA esistente → admin la annulla → stato ANNULLATA
--   B) Dopo l'annullamento, l'admin può inviare una nuova proposta per
--      lo stesso turno aperto (l'indice univoco esclude solo IN_ATTESA)
--   C) Il dipendente che apre il vecchio link di conferma vede "proposta
--      già gestita" invece di poter ancora confermarla
NOTIFY pgrst, 'reload schema';
