-- TASK 19 — Checklist installazione wallbox (Edison Energia) (2026-09-11)
-- ============================================================
-- Nuova funzionalità standalone (fuori sprint "Rapporto di Lavoro"):
-- form compilabile su iPhone che replica la checklist cartacea
-- "CHECK LIST INSTALLAZIONE WALL BOX", con doppia firma (tecnico +
-- cliente) e invio email automatico del PDF firmato.
--
-- Stessa macchina a stati e stesso lock di rapporti_intervento:
-- bozza -> firmato -> inviato, immutabile dopo la firma (enforced a
-- livello DB, non solo UI).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD.

-- 1. Tabella
CREATE TABLE public.checklist_wallbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL,

  -- Dati cliente/immobile (ricalcano 1:1 il modulo cartaceo)
  ragione_sociale TEXT NOT NULL DEFAULT '',
  piva TEXT NOT NULL DEFAULT '',
  nome TEXT NOT NULL DEFAULT '',
  cognome TEXT NOT NULL DEFAULT '',
  via TEXT NOT NULL DEFAULT '',
  comune TEXT NOT NULL DEFAULT '',
  cap TEXT NOT NULL DEFAULT '',
  provincia TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  email_cliente TEXT NOT NULL DEFAULT '', -- non presente sul cartaceo: serve per l'invio

  posizionamento TEXT NOT NULL DEFAULT '',
  modalita_posa TEXT CHECK (modalita_posa IN ('PARETE', 'TERRA')),
  potenza_contatore_kw TEXT NOT NULL DEFAULT '',

  -- Le 7 domande SI/NO del modulo (NULL = non ancora risposto)
  quadro_conforme BOOLEAN,
  impianto_a_norma BOOLEAN,
  dichiarazione_conformita BOOLEAN,
  autorizzazioni_necessarie BOOLEAN,
  messa_a_terra BOOLEAN,
  installazione_possibile BOOLEAN,
  opere_adeguamento_necessarie BOOLEAN,

  note TEXT NOT NULL DEFAULT '',

  -- Tabella materiali (pagina 2 del modulo): array {descrizione, quantita}
  materiali JSONB NOT NULL DEFAULT '[]'::jsonb,

  luogo TEXT NOT NULL DEFAULT '',
  data_sopralluogo DATE,

  firma_tecnico_data_url TEXT,
  firma_tecnico_nome TEXT,
  firma_tecnico_at TIMESTAMPTZ,
  firma_cliente_data_url TEXT,
  firma_cliente_nome TEXT,
  firma_cliente_at TIMESTAMPTZ,

  stato TEXT NOT NULL DEFAULT 'BOZZA'
    CHECK (stato IN ('BOZZA', 'FIRMATO', 'INVIATO')),

  created_by UUID,
  inviato_il TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX checklist_wallbox_azienda_idx ON public.checklist_wallbox (azienda_id);

-- 2. RLS: stesso pattern RESTRICTIVE + policy per ruolo delle altre tabelle
ALTER TABLE public.checklist_wallbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY checklist_wallbox_tenant_isolation ON public.checklist_wallbox
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

CREATE POLICY checklist_wallbox_select ON public.checklist_wallbox
  FOR SELECT TO authenticated USING (true);

CREATE POLICY checklist_wallbox_insert ON public.checklist_wallbox
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_admin_or_responsabile()
    OR (created_by = (select auth.uid()))
  );

CREATE POLICY checklist_wallbox_update ON public.checklist_wallbox
  FOR UPDATE TO authenticated
  USING (
    public.current_is_admin_or_responsabile()
    OR (created_by = (select auth.uid()))
  )
  WITH CHECK (
    public.current_is_admin_or_responsabile()
    OR (created_by = (select auth.uid()))
  );

CREATE POLICY checklist_wallbox_delete ON public.checklist_wallbox
  FOR DELETE TO authenticated USING (public.current_is_admin_or_responsabile());

-- 3. Lock post-firma: stesso meccanismo di blocca_rapporto_firmato
--    (Task 1), unica transizione ammessa FIRMATO -> INVIATO.
CREATE OR REPLACE FUNCTION public.blocca_checklist_wallbox_firmata()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stato IN ('FIRMATO', 'INVIATO') THEN
    IF OLD.stato = 'FIRMATO' AND NEW.stato = 'INVIATO'
       AND NEW.firma_tecnico_data_url IS NOT DISTINCT FROM OLD.firma_tecnico_data_url
       AND NEW.firma_cliente_data_url IS NOT DISTINCT FROM OLD.firma_cliente_data_url
       AND NEW.firma_tecnico_at IS NOT DISTINCT FROM OLD.firma_tecnico_at
       AND NEW.firma_cliente_at IS NOT DISTINCT FROM OLD.firma_cliente_at THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Checklist % non modificabile: stato %', OLD.id, OLD.stato
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

CREATE TRIGGER trg_lock_checklist_wallbox
  BEFORE UPDATE ON public.checklist_wallbox
  FOR EACH ROW EXECUTE FUNCTION public.blocca_checklist_wallbox_firmata();

CREATE OR REPLACE FUNCTION public.blocca_delete_checklist_wallbox_firmata()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stato IN ('FIRMATO', 'INVIATO') THEN
    RAISE EXCEPTION 'Checklist % non eliminabile: stato %', OLD.id, OLD.stato
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

CREATE TRIGGER trg_lock_delete_checklist_wallbox
  BEFORE DELETE ON public.checklist_wallbox
  FOR EACH ROW EXECUTE FUNCTION public.blocca_delete_checklist_wallbox_firmata();

-- 4. Bucket PDF (copia legale, generata una volta e mai rigenerata) +
--    log invii nella tabella email_log già esistente (Task 5).
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-wallbox-pdf', 'checklist-wallbox-pdf', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY checklist_wallbox_pdf_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'checklist-wallbox-pdf'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
    AND public.current_is_admin_or_responsabile()
  );

ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS checklist_wallbox_id UUID
    REFERENCES public.checklist_wallbox(id);

-- ============================================================
-- TEST su DEV:
--   A) Operaio azienda 1: crea checklist, firma (tecnico+cliente) → stato
--      FIRMATO, poi tenta UPDATE/DELETE diretto → errore DB
--   B) Utente azienda 2: non vede né la checklist né il PDF dell'azienda 1
--   C) Invio: PDF in checklist-wallbox-pdf/{azienda_id}/..., riga
--      INVIATA in email_log con checklist_wallbox_id valorizzato,
--      stato checklist INVIATO; secondo invio → bloccato
NOTIFY pgrst, 'reload schema';
