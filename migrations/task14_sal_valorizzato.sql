-- TASK 14 — Fase D: SAL valorizzato + ciclo bozza/definitivo (2026-06-13)
-- ============================================================
-- Due cose:
--  1. VALORIZZAZIONE: nel freeze (SAL periodo) si congela, per ogni voce
--     PROPRIA del committente, lo snapshot di unità/quantità/prezzo e gli
--     importi calcolati (totale, maturato a questo SAL, del periodo).
--     I prezzi restano SOLO sulle voci proprie (sal_freeze_lavorazioni):
--     la tabella sal_freeze_collaborazioni (subappaltatore) NON ha prezzi,
--     resta nome+% → i costi non vengono MAI condivisi col subappaltatore.
--  2. CICLO bozza → definitivo: un SAL periodo nasce 'bozza' (modificabile
--     e rigenerabile), poi "Conferma" lo porta a 'definitivo' (immutabile,
--     enforced a livello DB come i rapporti firmati).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- ─────────────────────────────────────────────────────────────
-- 1. Colonne di valorizzazione su sal_freeze_lavorazioni
--    (nullable: le voci senza quantità/prezzo restano senza importo)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.sal_freeze_lavorazioni
  ADD COLUMN IF NOT EXISTS unita_misura_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS quantita_snapshot NUMERIC,
  ADD COLUMN IF NOT EXISTS prezzo_unitario_snapshot NUMERIC,
  ADD COLUMN IF NOT EXISTS importo_totale NUMERIC,    -- quantità × prezzo (valore pieno della voce)
  ADD COLUMN IF NOT EXISTS importo_maturato NUMERIC,  -- importo_totale × percentuale_attuale/100
  ADD COLUMN IF NOT EXISTS importo_periodo NUMERIC;   -- importo_totale × delta_percentuale/100

COMMENT ON COLUMN public.sal_freeze_lavorazioni.importo_maturato IS
  'Importo maturato cumulato a questo SAL = importo_totale * percentuale_attuale/100';
COMMENT ON COLUMN public.sal_freeze_lavorazioni.importo_periodo IS
  'Importo competenza del periodo = importo_totale * delta_percentuale/100';

-- ─────────────────────────────────────────────────────────────
-- 2. Ciclo stato sul SAL periodo
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.sal_freeze_mensili
  ADD COLUMN IF NOT EXISTS stato TEXT NOT NULL DEFAULT 'bozza',
  ADD COLUMN IF NOT EXISTS confermato_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confermato_by UUID;

ALTER TABLE public.sal_freeze_mensili
  DROP CONSTRAINT IF EXISTS sal_freeze_mensili_stato_check;
ALTER TABLE public.sal_freeze_mensili
  ADD CONSTRAINT sal_freeze_mensili_stato_check
  CHECK (stato = ANY (ARRAY['bozza'::text, 'definitivo'::text]));

-- I freeze già esistenti su DEV/PROD sono di fatto "definitivi" nella
-- vecchia logica (non c'era modifica). Li lasciamo 'bozza' di default così
-- restano rigenerabili/annullabili; sarà l'utente a confermarli. Se invece
-- vuoi bloccarli da subito, decommenta:
-- UPDATE public.sal_freeze_mensili SET stato = 'definitivo',
--   confermato_at = freeze_at WHERE stato = 'bozza' AND annullato_at IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. Lock DB: un SAL periodo 'definitivo' è immutabile
--    (eccezione: l'annullamento controllato, che setta annullato_at/by)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.blocca_sal_freeze_definitivo()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stato = 'definitivo' THEN
    -- consenti SOLO l'annullamento: cambiano unicamente annullato_at/by
    IF NEW.annullato_at IS DISTINCT FROM OLD.annullato_at
       AND NEW.stato IS NOT DISTINCT FROM OLD.stato
       AND NEW.period_start IS NOT DISTINCT FROM OLD.period_start
       AND NEW.period_end IS NOT DISTINCT FROM OLD.period_end
       AND NEW.cantiere_id IS NOT DISTINCT FROM OLD.cantiere_id
       AND NEW.note IS NOT DISTINCT FROM OLD.note THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'SAL periodo % non modificabile: stato definitivo', OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';

DROP TRIGGER IF EXISTS trg_lock_sal_freeze ON public.sal_freeze_mensili;
CREATE TRIGGER trg_lock_sal_freeze
  BEFORE UPDATE ON public.sal_freeze_mensili
  FOR EACH ROW EXECUTE FUNCTION public.blocca_sal_freeze_definitivo();

-- DELETE bloccato se definitivo
CREATE OR REPLACE FUNCTION public.blocca_delete_sal_freeze_definitivo()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stato = 'definitivo' THEN
    RAISE EXCEPTION 'SAL periodo % non eliminabile: stato definitivo', OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';

DROP TRIGGER IF EXISTS trg_lock_delete_sal_freeze ON public.sal_freeze_mensili;
CREATE TRIGGER trg_lock_delete_sal_freeze
  BEFORE DELETE ON public.sal_freeze_mensili
  FOR EACH ROW EXECUTE FUNCTION public.blocca_delete_sal_freeze_definitivo();

-- 4. Lock figlie: niente INSERT/UPDATE/DELETE se il freeze padre è definitivo
CREATE OR REPLACE FUNCTION public.blocca_figli_sal_freeze_definitivo()
RETURNS TRIGGER AS $$
DECLARE
  v_freeze_id UUID;
  v_stato TEXT;
BEGIN
  v_freeze_id := COALESCE(NEW.freeze_id, OLD.freeze_id);

  SELECT stato INTO v_stato
  FROM public.sal_freeze_mensili
  WHERE id = v_freeze_id;

  IF v_stato = 'definitivo' THEN
    RAISE EXCEPTION 'SAL periodo % non modificabile: stato definitivo', v_freeze_id
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = 'public';

DROP TRIGGER IF EXISTS trg_lock_figli_sal_freeze_lav ON public.sal_freeze_lavorazioni;
CREATE TRIGGER trg_lock_figli_sal_freeze_lav
  BEFORE INSERT OR UPDATE OR DELETE ON public.sal_freeze_lavorazioni
  FOR EACH ROW EXECUTE FUNCTION public.blocca_figli_sal_freeze_definitivo();

DROP TRIGGER IF EXISTS trg_lock_figli_sal_freeze_foto ON public.sal_freeze_foto;
CREATE TRIGGER trg_lock_figli_sal_freeze_foto
  BEFORE INSERT OR UPDATE OR DELETE ON public.sal_freeze_foto
  FOR EACH ROW EXECUTE FUNCTION public.blocca_figli_sal_freeze_definitivo();

DROP TRIGGER IF EXISTS trg_lock_figli_sal_freeze_macch ON public.sal_freeze_macchinari;
CREATE TRIGGER trg_lock_figli_sal_freeze_macch
  BEFORE INSERT OR UPDATE OR DELETE ON public.sal_freeze_macchinari
  FOR EACH ROW EXECUTE FUNCTION public.blocca_figli_sal_freeze_definitivo();

DROP TRIGGER IF EXISTS trg_lock_figli_sal_freeze_collab ON public.sal_freeze_collaborazioni;
CREATE TRIGGER trg_lock_figli_sal_freeze_collab
  BEFORE INSERT OR UPDATE OR DELETE ON public.sal_freeze_collaborazioni
  FOR EACH ROW EXECUTE FUNCTION public.blocca_figli_sal_freeze_definitivo();

-- Le trigger function non vanno chiamate via API: revoca EXECUTE
REVOKE EXECUTE ON FUNCTION public.blocca_sal_freeze_definitivo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.blocca_delete_sal_freeze_definitivo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.blocca_figli_sal_freeze_definitivo() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- TEST su DEV:
--   A) Crea SAL periodo su cantiere con voci valorizzate → verifica
--      importo_totale/maturato/periodo coerenti (quantità×prezzo×%).
--   B) Voci del subappaltatore: nessun prezzo nello snapshot collab.
--   C) Freeze 'bozza': rigenerabile e annullabile come prima.
--   D) Conferma → 'definitivo': UPDATE/DELETE su header e figlie → errore DB;
--      annullamento (solo annullato_at) → consentito.
NOTIFY pgrst, 'reload schema';
