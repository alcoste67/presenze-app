-- TASK 4a — Lavorazioni proposte + lavori extra (2026-06-11)
-- ============================================================
-- 1. Le lavorazioni possono nascere come "proposta" dal campo (wizard
--    timbratura uscita) e vengono approvate/unite dall'admin.
-- 2. I rapporti possono contenere "lavori extra" liberi, non legati al
--    catalogo lavorazioni, immutabili a rapporto firmato.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- 1. Stato proposte su lavorazioni_cantiere
ALTER TABLE public.lavorazioni_cantiere
  ADD COLUMN IF NOT EXISTS stato TEXT NOT NULL DEFAULT 'approvata'
    CHECK (stato IN ('approvata', 'proposta', 'rifiutata')),
  ADD COLUMN IF NOT EXISTS proposta_da UUID,
  ADD COLUMN IF NOT EXISTS nota_proposta TEXT DEFAULT '' NOT NULL,
  ADD COLUMN IF NOT EXISTS approvata_da UUID,
  ADD COLUMN IF NOT EXISTS approvata_il TIMESTAMPTZ;

-- Le proposte possono essere create anche dai responsabili (la INSERT
-- su lavorazioni_cantiere oggi è solo admin)
DROP POLICY IF EXISTS lavorazioni_cantiere_insert_proposta ON public.lavorazioni_cantiere;
CREATE POLICY lavorazioni_cantiere_insert_proposta ON public.lavorazioni_cantiere
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_is_admin_or_responsabile()
    AND (stato = 'proposta' OR public.current_is_admin())
  );

-- Solo l'admin cambia lo stato delle proposte (approva/rifiuta/unisce):
-- trigger perché la RLS non distingue le colonne modificate
CREATE OR REPLACE FUNCTION public.blocca_stato_lavorazione_non_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stato IS DISTINCT FROM OLD.stato
     AND NOT public.current_is_admin() THEN
    RAISE EXCEPTION 'Solo l''amministratore può approvare o rifiutare le proposte'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stato_lavorazione_admin ON public.lavorazioni_cantiere;
CREATE TRIGGER trg_stato_lavorazione_admin
  BEFORE UPDATE ON public.lavorazioni_cantiere
  FOR EACH ROW EXECUTE FUNCTION public.blocca_stato_lavorazione_non_admin();

-- 2. Lavori extra sul rapporto
CREATE TABLE public.rapporti_intervento_extra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rapporto_intervento_id UUID NOT NULL REFERENCES public.rapporti_intervento(id),
  azienda_id UUID NOT NULL,
  descrizione TEXT NOT NULL,
  ore_minuti INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '' NOT NULL,
  ordine INTEGER NOT NULL DEFAULT 0,
  inserito_da UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rapporti_intervento_extra ENABLE ROW LEVEL SECURITY;

CREATE POLICY rapporti_extra_tenant_isolation ON public.rapporti_intervento_extra
  AS RESTRICTIVE TO authenticated
  USING (azienda_id = public.current_azienda_id())
  WITH CHECK (azienda_id = public.current_azienda_id());

-- Stessi permessi delle altre tabelle figlie del rapporto
CREATE POLICY rapporti_extra_select ON public.rapporti_intervento_extra
  FOR SELECT TO authenticated USING (true);
CREATE POLICY rapporti_extra_insert ON public.rapporti_intervento_extra
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY rapporti_extra_update ON public.rapporti_intervento_extra
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY rapporti_extra_delete ON public.rapporti_intervento_extra
  FOR DELETE TO authenticated USING (true);

-- Lock: nessuna modifica se il rapporto padre è FIRMATO/INVIATO
-- (riusa la funzione del Task 1)
CREATE TRIGGER trg_lock_figli_extra
  BEFORE INSERT OR UPDATE OR DELETE ON public.rapporti_intervento_extra
  FOR EACH ROW EXECUTE FUNCTION public.blocca_figli_rapporto_firmato();

-- ============================================================
-- TEST su DEV:
--   A) Responsabile: INSERT lavorazione con stato='proposta' → ok;
--      con stato='approvata' → negato
--   B) Responsabile: UPDATE stato proposta→approvata → negato (trigger);
--      Admin → ok
--   C) Lavori extra: insert/update ok su rapporto BOZZA, negato su FIRMATO
--   D) Dopo l'esecuzione: NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload schema';
