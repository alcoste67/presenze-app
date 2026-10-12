-- Note spese e rimborsi chilometrici (2026-10-12)
-- ============================================================
-- Il dipendente registra a fine giornata le spese sostenute (con foto
-- scontrino) e, se usa l'auto propria per lavoro, i km percorsi. L'admin
-- approva/rifiuta le spese; il rimborso chilometrico si calcola a fine
-- mese come km totali × tariffa assegnata al dipendente (tariffa che
-- l'admin guarda a mano sulle tabelle ACI per l'auto specifica: non
-- esiste qui un database delle tabelle ACI, sono dati a pagamento e
-- aggiornati ogni anno, non riproducibili in modo affidabile).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD
-- (skdtczhvxvawwjanciss).

-- ============================================================
-- 1. Dipendenti: auto propria + tariffa di rimborso
ALTER TABLE public.dipendenti
  ADD COLUMN IF NOT EXISTS usa_auto_propria boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tariffa_km_rimborso numeric,
  ADD COLUMN IF NOT EXISTS veicolo_descrizione text NOT NULL DEFAULT '';

-- ============================================================
-- 2. Note spese
CREATE TABLE IF NOT EXISTS public.note_spese (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id uuid NOT NULL REFERENCES public.aziende(id),
  dipendente_id uuid NOT NULL REFERENCES public.dipendenti(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('PASTO', 'MATERIALE', 'FATTURA', 'ALTRO')),
  importo numeric(10, 2) NOT NULL CHECK (importo > 0),
  descrizione text NOT NULL DEFAULT '',
  foto_scontrino_path text NOT NULL,
  stato text NOT NULL DEFAULT 'IN_ATTESA' CHECK (stato IN ('IN_ATTESA', 'APPROVATA', 'RIFIUTATA')),
  nota_rifiuto text NOT NULL DEFAULT '',
  approvata_da uuid REFERENCES public.dipendenti(id),
  approvata_il timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS note_spese_dipendente_data_idx
  ON public.note_spese (dipendente_id, data);

CREATE INDEX IF NOT EXISTS note_spese_azienda_stato_idx
  ON public.note_spese (azienda_id, stato);

ALTER TABLE public.note_spese ENABLE ROW LEVEL SECURITY;

CREATE POLICY note_spese_tenant_isolation ON public.note_spese
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

-- ============================================================
-- 3. Note chilometri (un rigo per dipendente/giorno)
CREATE TABLE IF NOT EXISTS public.note_chilometri (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id uuid NOT NULL REFERENCES public.aziende(id),
  dipendente_id uuid NOT NULL REFERENCES public.dipendenti(id) ON DELETE CASCADE,
  data date NOT NULL,
  km numeric(6, 1) NOT NULL CHECK (km >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT note_chilometri_dipendente_data_unico UNIQUE (dipendente_id, data)
);

CREATE INDEX IF NOT EXISTS note_chilometri_azienda_data_idx
  ON public.note_chilometri (azienda_id, data);

ALTER TABLE public.note_chilometri ENABLE ROW LEVEL SECURITY;

CREATE POLICY note_chilometri_tenant_isolation ON public.note_chilometri
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

-- ============================================================
-- 4. Bucket Storage privato per le foto degli scontrini
INSERT INTO storage.buckets (id, name, public)
VALUES ('note-spese-scontrini', 'note-spese-scontrini', false)
ON CONFLICT (id) DO NOTHING;

-- Path {azienda_id}/{dipendente_id}/... — stessa convenzione di
-- foto-lavorazioni (vedi migrations/task3_foto_uscita.sql)
CREATE POLICY note_spese_scontrini_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'note-spese-scontrini'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
  );

CREATE POLICY note_spese_scontrini_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'note-spese-scontrini'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
  );

CREATE POLICY note_spese_scontrini_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'note-spese-scontrini'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
    AND public.current_is_admin()
  );

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- TEST su DEV:
--   A) Dipendente carica una spesa con foto + (se usa_auto_propria) i km
--      di oggi → righe in note_spese/note_chilometri con azienda_id
--      corretto, foto visibile solo alla propria azienda
--   B) Utente azienda 2 non vede né le righe né la foto dell'azienda 1
--   C) Reinviando i km lo stesso giorno, la riga si aggiorna (non duplica)
