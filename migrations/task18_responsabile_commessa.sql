-- TASK 18 — Responsabile commessa per cantiere (2026-06-17)
-- ============================================================
-- Un dipendente qualsiasi (anche operatore) può essere nominato dall'ADMIN
-- responsabile di uno o più cantieri. Il responsabile commessa può inserire
-- costi materiali e caricare DDT SOLO per i suoi cantieri, dalla Home (niente
-- accesso al Back-office). L'autorizzazione è verificata a livello di API
-- server (admin OPPURE responsabile di quel cantiere).
--
-- Campo singolo sul cantiere = un responsabile commessa per cantiere.
-- Valore = auth_user_id del dipendente (per il match con l'utente loggato).
--
-- Eseguire su DEV (mkfedjazibcmstkjxkfm) e su PROD (skdtczhvxvawwjanciss).

ALTER TABLE public.cantieri
  ADD COLUMN IF NOT EXISTS responsabile_commessa_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_cantieri_responsabile_commessa_user_id
  ON public.cantieri (responsabile_commessa_user_id);

-- ============================================================
-- NOTA: il campo è gestito dall'ADMIN in Back-office → Cantieri. La lettura
-- lato Home e le scritture dei costi passano da API server (service role)
-- che verificano: admin OPPURE cantieri.responsabile_commessa_user_id = utente.
-- Le tabelle costi (costi_materiali_cantiere) restano protette da RLS
-- tenant + accesso via service role.
NOTIFY pgrst, 'reload schema';
