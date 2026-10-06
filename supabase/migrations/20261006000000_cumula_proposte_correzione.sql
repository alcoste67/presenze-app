-- Proposte di correzione turno aperto cumulabili (2026-10-06)
-- ============================================================
-- Finora era ammessa una sola proposta IN_ATTESA per turno aperto:
-- l'admin doveva annullarla per inviarne una corretta, perdendo lo
-- storico dei tentativi. Ora più proposte possono coesistere per lo
-- stesso turno: l'admin ne aggiunge una nuova senza perdere le vecchie,
-- il dipendente le vede tutte e ne conferma quella giusta; confermarne
-- una annulla automaticamente le altre (il turno si chiude una volta
-- sola — vedi app/api/timbrature/correzione-admin/rispondi/route.ts).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

DROP INDEX IF EXISTS public.timbrature_proposte_correzione_avviso_in_attesa_key;

-- ============================================================
-- TEST su DEV:
--   A) Admin invia una proposta per un turno aperto, poi ne invia una
--      seconda senza annullare la prima → entrambe IN_ATTESA
--   B) Il dipendente conferma la seconda → la prima passa ad ANNULLATA
--      automaticamente, la timbratura usa l'orario della seconda
NOTIFY pgrst, 'reload schema';
