-- FOTOVOLTAICO — Fase 2 (2026-11-04)
-- ============================================================
-- Checklist di sopralluogo/dimensionamento per impianti fotovoltaici,
-- sullo stesso stile della checklist_wallbox (Task 19, 2026-09-11):
-- form compilabile da qualsiasi dipendente attivo (non solo ADMIN, come
-- rapporti_intervento), doppia firma (tecnico + cliente), PDF legale
-- generato una volta e archiviato, invio email automatico. Stessa
-- macchina a stati e stesso lock di checklist_wallbox: bozza -> firmato
-- -> inviato, immutabile dopo la firma (enforced a livello DB).
--
-- I campi di dimensionamento (consumo_f1/f2/f3, pompa di calore, auto
-- elettrica, induzione, altro, resa/fattore/margine) sono gli input
-- grezzi già concordati con Alex; i campi di output (fabbisogno totale,
-- potenza consigliata/massima, numero moduli, batteria consigliata) sono
-- previsti qui come colonne ma popolati dalla Fase 3 (logica di calcolo):
-- evita una migration aggiuntiva in quella fase.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD.

-- 1. Tabella
CREATE TABLE public.checklist_fotovoltaico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL REFERENCES public.aziende(id),

  -- Dati cliente/immobile
  ragione_sociale TEXT NOT NULL DEFAULT '',
  piva TEXT NOT NULL DEFAULT '',
  nome TEXT NOT NULL DEFAULT '',
  cognome TEXT NOT NULL DEFAULT '',
  via TEXT NOT NULL DEFAULT '',
  comune TEXT NOT NULL DEFAULT '',
  cap TEXT NOT NULL DEFAULT '',
  provincia TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  email_cliente TEXT NOT NULL DEFAULT '',

  -- Falda / tetto
  tipo_copertura TEXT NOT NULL DEFAULT '',
  orientamento_falda TEXT NOT NULL DEFAULT '',
  inclinazione_falda_gradi NUMERIC CHECK (inclinazione_falda_gradi IS NULL OR inclinazione_falda_gradi >= 0),
  superficie_falda_mq NUMERIC CHECK (superficie_falda_mq IS NULL OR superficie_falda_mq >= 0),
  ombreggiamenti_presenti BOOLEAN,
  note_ombreggiamenti TEXT NOT NULL DEFAULT '',

  -- Verifiche tecniche (SI/NO/non risposto = NULL, come checklist_wallbox)
  potenza_contatore_kw TEXT NOT NULL DEFAULT '',
  quadro_conforme BOOLEAN,
  impianto_a_norma BOOLEAN,
  dichiarazione_conformita BOOLEAN,
  autorizzazioni_necessarie BOOLEAN,
  messa_a_terra BOOLEAN,
  struttura_idonea BOOLEAN,
  opere_adeguamento_necessarie BOOLEAN,

  -- Dimensionamento: input grezzi (confermati con Alex)
  consumo_f1_kwh NUMERIC CHECK (consumo_f1_kwh IS NULL OR consumo_f1_kwh >= 0),
  consumo_f2_kwh NUMERIC CHECK (consumo_f2_kwh IS NULL OR consumo_f2_kwh >= 0),
  consumo_f3_kwh NUMERIC CHECK (consumo_f3_kwh IS NULL OR consumo_f3_kwh >= 0),
  pompa_calore_attiva BOOLEAN NOT NULL DEFAULT false,
  pompa_calore_kwh_anno NUMERIC NOT NULL DEFAULT 3000,
  auto_elettrica_attiva BOOLEAN NOT NULL DEFAULT false,
  auto_elettrica_kwh_anno NUMERIC NOT NULL DEFAULT 2500,
  induzione_attiva BOOLEAN NOT NULL DEFAULT false,
  induzione_kwh_anno NUMERIC NOT NULL DEFAULT 400,
  altro_attivo BOOLEAN NOT NULL DEFAULT false,
  altro_descrizione TEXT NOT NULL DEFAULT '',
  altro_kwh_anno NUMERIC NOT NULL DEFAULT 0,
  resa_kwh_per_kwp NUMERIC NOT NULL DEFAULT 1200,
  fattore_occupazione_falda NUMERIC NOT NULL DEFAULT 0.70,
  margine_batteria NUMERIC NOT NULL DEFAULT 1.15,
  modulo_fotovoltaico_id UUID REFERENCES public.moduli_fotovoltaici(id),

  -- Dimensionamento: output calcolati (popolati in Fase 3)
  fabbisogno_totale_kwh NUMERIC,
  potenza_consigliata_kwp NUMERIC,
  potenza_massima_kwp NUMERIC,
  numero_moduli_max INTEGER,
  batteria_consigliata_kwh NUMERIC,

  -- Materiali/componenti previsti: array libero {descrizione, quantita}
  materiali JSONB NOT NULL DEFAULT '[]'::jsonb,

  note TEXT NOT NULL DEFAULT '',
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

CREATE INDEX checklist_fotovoltaico_azienda_idx ON public.checklist_fotovoltaico (azienda_id);

-- 2. RLS: stesso pattern RESTRICTIVE + policy per ruolo di checklist_wallbox
ALTER TABLE public.checklist_fotovoltaico ENABLE ROW LEVEL SECURITY;

CREATE POLICY checklist_fotovoltaico_tenant_isolation ON public.checklist_fotovoltaico
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

CREATE POLICY checklist_fotovoltaico_select ON public.checklist_fotovoltaico
  FOR SELECT TO authenticated USING (true);

CREATE POLICY checklist_fotovoltaico_insert ON public.checklist_fotovoltaico
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_admin_or_responsabile()
    OR (created_by = (select auth.uid()))
  );

CREATE POLICY checklist_fotovoltaico_update ON public.checklist_fotovoltaico
  FOR UPDATE TO authenticated
  USING (
    public.current_is_admin_or_responsabile()
    OR (created_by = (select auth.uid()))
  )
  WITH CHECK (
    public.current_is_admin_or_responsabile()
    OR (created_by = (select auth.uid()))
  );

CREATE POLICY checklist_fotovoltaico_delete ON public.checklist_fotovoltaico
  FOR DELETE TO authenticated USING (public.current_is_admin_or_responsabile());

-- 3. Lock post-firma: stesso meccanismo di blocca_checklist_wallbox_firmata
CREATE OR REPLACE FUNCTION public.blocca_checklist_fotovoltaico_firmata()
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

CREATE TRIGGER trg_lock_checklist_fotovoltaico
  BEFORE UPDATE ON public.checklist_fotovoltaico
  FOR EACH ROW EXECUTE FUNCTION public.blocca_checklist_fotovoltaico_firmata();

CREATE OR REPLACE FUNCTION public.blocca_delete_checklist_fotovoltaico_firmata()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stato IN ('FIRMATO', 'INVIATO') THEN
    RAISE EXCEPTION 'Checklist % non eliminabile: stato %', OLD.id, OLD.stato
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

CREATE TRIGGER trg_lock_delete_checklist_fotovoltaico
  BEFORE DELETE ON public.checklist_fotovoltaico
  FOR EACH ROW EXECUTE FUNCTION public.blocca_delete_checklist_fotovoltaico_firmata();

-- 4. Bucket PDF (copia legale, generata una volta e mai rigenerata) +
--    log invii nella tabella email_log già esistente.
INSERT INTO storage.buckets (id, name, public)
VALUES ('checklist-fotovoltaico-pdf', 'checklist-fotovoltaico-pdf', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY checklist_fotovoltaico_pdf_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'checklist-fotovoltaico-pdf'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
  );

ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS checklist_fotovoltaico_id UUID
    REFERENCES public.checklist_fotovoltaico(id);

-- ============================================================
-- TEST su DEV:
--   A) Dipendente attivo azienda 1: crea checklist, firma (tecnico+cliente) → stato
--      FIRMATO, poi tenta UPDATE/DELETE diretto → errore DB
--   B) Utente azienda 2: non vede né la checklist né il PDF dell'azienda 1
--   C) Invio: PDF in checklist-fotovoltaico-pdf/{azienda_id}/..., riga
--      INVIATA in email_log con checklist_fotovoltaico_id valorizzato,
--      stato checklist INVIATO; secondo invio → bloccato
NOTIFY pgrst, 'reload schema';
