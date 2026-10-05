-- TASK 23 — Ordini di lavoro Edison (2026-10-04)
-- ============================================================
-- Nuova funzionalità standalone: modulo "ORDINE DI LAVORO" Edison
-- Energia, compilabile a parte (con tendina opzionale per recuperare i
-- dati anagrafici da una checklist wallbox esistente) oppure del tutto
-- a mano. Non è specifico della wallbox: copre qualunque tipo di
-- intervento Edison (24/7, caldaia, scaldabagno, climatizzatore,
-- elettrodomestico, varie).
--
-- Stessa macchina a stati e stesso lock di checklist_wallbox / rapporti
-- di lavoro: bozza -> firmato -> inviato, immutabile dopo la firma
-- (enforced a livello DB, non solo UI).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD.

-- 1. Tabella
CREATE TABLE public.ordini_lavoro_edison (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  azienda_id UUID NOT NULL,

  -- Collegamento opzionale alla checklist wallbox da cui sono stati
  -- recuperati i dati anagrafici (tendina in form). Nullable: l'ordine
  -- di lavoro è utilizzabile anche da solo.
  checklist_wallbox_id UUID REFERENCES public.checklist_wallbox(id),

  intervento_numero TEXT NOT NULL DEFAULT '',
  data DATE,
  ora_dalle TEXT NOT NULL DEFAULT '',
  ora_alle TEXT NOT NULL DEFAULT '',

  tecnico_societa TEXT NOT NULL DEFAULT '',
  tecnico_nome TEXT NOT NULL DEFAULT '',

  cliente_nome_cognome TEXT NOT NULL DEFAULT '',
  cliente_indirizzo TEXT NOT NULL DEFAULT '',
  cliente_civico TEXT NOT NULL DEFAULT '',
  cliente_comune TEXT NOT NULL DEFAULT '',
  cliente_cap TEXT NOT NULL DEFAULT '',
  cliente_provincia TEXT NOT NULL DEFAULT '',
  cliente_telefono TEXT NOT NULL DEFAULT '',
  cliente_email TEXT NOT NULL DEFAULT '',

  -- Tipologia di intervento (multi-checkbox, come sul modulo cartaceo)
  tipologia_24_7 BOOLEAN NOT NULL DEFAULT false,
  tipologia_caldaia BOOLEAN NOT NULL DEFAULT false,
  tipologia_scaldabagno BOOLEAN NOT NULL DEFAULT false,
  tipologia_climatizzatore BOOLEAN NOT NULL DEFAULT false,
  tipologia_elettrodomestico BOOLEAN NOT NULL DEFAULT false,
  tipologia_varie BOOLEAN NOT NULL DEFAULT false,

  -- Dettaglio prestazione (multi-checkbox + ore extra libere)
  dettaglio_manodopera_compresa BOOLEAN NOT NULL DEFAULT false,
  dettaglio_manodopera_a_pagamento BOOLEAN NOT NULL DEFAULT false,
  dettaglio_ore_manodopera_extra TEXT NOT NULL DEFAULT '',
  dettaglio_pezzi_ricambio BOOLEAN NOT NULL DEFAULT false,
  dettaglio_preventivo BOOLEAN NOT NULL DEFAULT false,
  dettaglio_riparazione BOOLEAN NOT NULL DEFAULT false,
  dettaglio_manutenzione BOOLEAN NOT NULL DEFAULT false,

  dettaglio_impianti TEXT NOT NULL DEFAULT '',
  dettaglio_intervento_eseguito TEXT NOT NULL DEFAULT '',

  -- Elenco interventi/componenti con importo: array {descrizione, importo}
  elenco_interventi JSONB NOT NULL DEFAULT '[]'::jsonb,

  prescrizione_sicurezza BOOLEAN,
  prescrizione_motivo TEXT NOT NULL DEFAULT '',

  osservazioni TEXT NOT NULL DEFAULT '',

  modalita_pagamento TEXT CHECK (modalita_pagamento IN ('BOLLETTA', 'CARTA')),

  luogo TEXT NOT NULL DEFAULT '',

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

CREATE INDEX ordini_lavoro_edison_azienda_idx ON public.ordini_lavoro_edison (azienda_id);
CREATE INDEX ordini_lavoro_edison_checklist_wallbox_idx
  ON public.ordini_lavoro_edison (checklist_wallbox_id);

-- 2. RLS: stesso pattern RESTRICTIVE + policy per ruolo di checklist_wallbox
ALTER TABLE public.ordini_lavoro_edison ENABLE ROW LEVEL SECURITY;

CREATE POLICY ordini_lavoro_edison_tenant_isolation ON public.ordini_lavoro_edison
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

CREATE POLICY ordini_lavoro_edison_select ON public.ordini_lavoro_edison
  FOR SELECT TO authenticated USING (true);

CREATE POLICY ordini_lavoro_edison_insert ON public.ordini_lavoro_edison
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_admin_or_responsabile()
    OR (created_by = (select auth.uid()))
  );

CREATE POLICY ordini_lavoro_edison_update ON public.ordini_lavoro_edison
  FOR UPDATE TO authenticated
  USING (
    public.current_is_admin_or_responsabile()
    OR (created_by = (select auth.uid()))
  )
  WITH CHECK (
    public.current_is_admin_or_responsabile()
    OR (created_by = (select auth.uid()))
  );

CREATE POLICY ordini_lavoro_edison_delete ON public.ordini_lavoro_edison
  FOR DELETE TO authenticated USING (public.current_is_admin_or_responsabile());

-- 3. Lock post-firma: stesso meccanismo di blocca_checklist_wallbox_firmata
CREATE OR REPLACE FUNCTION public.blocca_ordine_lavoro_edison_firmato()
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
    RAISE EXCEPTION 'Ordine di lavoro % non modificabile: stato %', OLD.id, OLD.stato
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

CREATE TRIGGER trg_lock_ordine_lavoro_edison
  BEFORE UPDATE ON public.ordini_lavoro_edison
  FOR EACH ROW EXECUTE FUNCTION public.blocca_ordine_lavoro_edison_firmato();

CREATE OR REPLACE FUNCTION public.blocca_delete_ordine_lavoro_edison_firmato()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stato IN ('FIRMATO', 'INVIATO') THEN
    RAISE EXCEPTION 'Ordine di lavoro % non eliminabile: stato %', OLD.id, OLD.stato
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

CREATE TRIGGER trg_lock_delete_ordine_lavoro_edison
  BEFORE DELETE ON public.ordini_lavoro_edison
  FOR EACH ROW EXECUTE FUNCTION public.blocca_delete_ordine_lavoro_edison_firmato();

-- 4. Bucket PDF (copia legale, generata una volta e mai rigenerata) +
--    log invii nella tabella email_log già esistente.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ordini-lavoro-edison-pdf', 'ordini-lavoro-edison-pdf', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY ordini_lavoro_edison_pdf_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ordini-lavoro-edison-pdf'
    AND (storage.foldername(name))[1] = public.current_azienda_id()::text
    AND public.current_is_admin_or_responsabile()
  );

ALTER TABLE public.email_log
  ADD COLUMN IF NOT EXISTS ordine_lavoro_edison_id UUID
    REFERENCES public.ordini_lavoro_edison(id);

-- ============================================================
-- TEST su DEV:
--   A) Operaio azienda 1: crea ordine di lavoro (con/senza checklist
--      collegata), firma (tecnico+cliente) → stato FIRMATO, poi tenta
--      UPDATE/DELETE diretto → errore DB
--   B) Utente azienda 2: non vede né l'ordine né il PDF dell'azienda 1
--   C) Invio: PDF in ordini-lavoro-edison-pdf/{azienda_id}/..., riga
--      INVIATA in email_log con ordine_lavoro_edison_id valorizzato,
--      stato ordine INVIATO; secondo invio → bloccato
NOTIFY pgrst, 'reload schema';
