-- TASK 1 — Macchina a stati + lock DB sui rapporti di intervento (2026-06-10)
-- ============================================================
-- La tabella rapporti_intervento ha già stato (BOZZA/FIRMATO/ANNULLATO)
-- e doppia firma (responsabile + cliente). Questo task:
--   1. aggiunge lo stato INVIATO (per il Task 5) + inviato_il
--   2. ENFORCEMENT A LIVELLO DB: rapporti FIRMATO/INVIATO immutabili,
--      unica transizione ammessa FIRMATO → INVIATO
--   3. lock sulle tabelle figlie (foto, lavorazioni, materiali, operatori)
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- 1. Stato INVIATO + timestamp
ALTER TABLE public.rapporti_intervento
  DROP CONSTRAINT IF EXISTS rapporti_intervento_stato_check;
ALTER TABLE public.rapporti_intervento
  ADD CONSTRAINT rapporti_intervento_stato_check
  CHECK (stato = ANY (ARRAY['BOZZA'::text, 'FIRMATO'::text, 'INVIATO'::text, 'ANNULLATO'::text]));

ALTER TABLE public.rapporti_intervento
  ADD COLUMN IF NOT EXISTS inviato_il TIMESTAMPTZ;

-- 2. Lock UPDATE: nessuna modifica a FIRMATO/INVIATO,
--    eccetto la sola transizione FIRMATO -> INVIATO
CREATE OR REPLACE FUNCTION public.blocca_rapporto_firmato()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stato IN ('FIRMATO', 'INVIATO') THEN
    IF OLD.stato = 'FIRMATO' AND NEW.stato = 'INVIATO'
       AND NEW.firma_responsabile_data_url IS NOT DISTINCT FROM OLD.firma_responsabile_data_url
       AND NEW.firma_cliente_data_url IS NOT DISTINCT FROM OLD.firma_cliente_data_url
       AND NEW.firma_responsabile_at IS NOT DISTINCT FROM OLD.firma_responsabile_at
       AND NEW.firma_cliente_at IS NOT DISTINCT FROM OLD.firma_cliente_at THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Rapporto % non modificabile: stato %', OLD.id, OLD.stato
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_rapporto ON public.rapporti_intervento;
CREATE TRIGGER trg_lock_rapporto
  BEFORE UPDATE ON public.rapporti_intervento
  FOR EACH ROW EXECUTE FUNCTION public.blocca_rapporto_firmato();

-- 3. Lock DELETE (funzione separata: su DELETE non esiste NEW)
CREATE OR REPLACE FUNCTION public.blocca_delete_rapporto_firmato()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stato IN ('FIRMATO', 'INVIATO') THEN
    RAISE EXCEPTION 'Rapporto % non eliminabile: stato %', OLD.id, OLD.stato
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_delete_rapporto ON public.rapporti_intervento;
CREATE TRIGGER trg_lock_delete_rapporto
  BEFORE DELETE ON public.rapporti_intervento
  FOR EACH ROW EXECUTE FUNCTION public.blocca_delete_rapporto_firmato();

-- 4. Lock tabelle figlie: nessun INSERT/UPDATE/DELETE se il rapporto
--    padre è FIRMATO/INVIATO
CREATE OR REPLACE FUNCTION public.blocca_figli_rapporto_firmato()
RETURNS TRIGGER AS $$
DECLARE
  rapporto_id UUID;
  stato_rapporto TEXT;
BEGIN
  rapporto_id := COALESCE(NEW.rapporto_intervento_id, OLD.rapporto_intervento_id);

  SELECT stato INTO stato_rapporto
  FROM public.rapporti_intervento
  WHERE id = rapporto_id;

  IF stato_rapporto IN ('FIRMATO', 'INVIATO') THEN
    RAISE EXCEPTION 'Rapporto % non modificabile: stato %', rapporto_id, stato_rapporto
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_figli_foto ON public.rapporti_intervento_foto;
CREATE TRIGGER trg_lock_figli_foto
  BEFORE INSERT OR UPDATE OR DELETE ON public.rapporti_intervento_foto
  FOR EACH ROW EXECUTE FUNCTION public.blocca_figli_rapporto_firmato();

DROP TRIGGER IF EXISTS trg_lock_figli_lavorazioni ON public.rapporti_intervento_lavorazioni;
CREATE TRIGGER trg_lock_figli_lavorazioni
  BEFORE INSERT OR UPDATE OR DELETE ON public.rapporti_intervento_lavorazioni
  FOR EACH ROW EXECUTE FUNCTION public.blocca_figli_rapporto_firmato();

DROP TRIGGER IF EXISTS trg_lock_figli_materiali ON public.rapporti_intervento_materiali;
CREATE TRIGGER trg_lock_figli_materiali
  BEFORE INSERT OR UPDATE OR DELETE ON public.rapporti_intervento_materiali
  FOR EACH ROW EXECUTE FUNCTION public.blocca_figli_rapporto_firmato();

DROP TRIGGER IF EXISTS trg_lock_figli_operatori ON public.rapporti_intervento_operatori;
CREATE TRIGGER trg_lock_figli_operatori
  BEFORE INSERT OR UPDATE OR DELETE ON public.rapporti_intervento_operatori
  FOR EACH ROW EXECUTE FUNCTION public.blocca_figli_rapporto_firmato();

-- ============================================================
-- NOTA: un rapporto FIRMATO non può più diventare ANNULLATO — è il
-- comportamento voluto (immutabilità legale dopo la firma).
--
-- TEST su DEV:
--   A) Firmare un rapporto, poi tentare UPDATE/DELETE → errore DB
--   B) Tentare modifica di foto/lavorazioni/materiali/operatori di un
--      rapporto firmato → errore DB
--   C) Rapporto BOZZA: tutto modificabile come prima
--   D) FIRMATO → INVIATO (solo stato + inviato_il) → consentito
