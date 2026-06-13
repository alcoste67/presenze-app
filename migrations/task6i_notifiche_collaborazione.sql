-- TASK 6i — Avvisi in home per le collaborazioni (2026-06-13)
-- ============================================================
-- Due "spie" sulla collaborazione:
--  - novita_per_collaboratore: accesa quando l'appaltatore fa push
--    lavorazioni → avviso in home del subappaltatore.
--  - novita_per_committente: accesa quando il subappaltatore aggiorna gli
--    avanzamenti (%) → avviso in home dell'appaltatore.
-- Si spengono quando il lato interessato apre la pagina Collaborazioni.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

ALTER TABLE public.cantieri_collaborazioni
  ADD COLUMN IF NOT EXISTS novita_per_collaboratore BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS novita_per_committente BOOLEAN NOT NULL DEFAULT false;

-- 1. Push appaltatore → accende la spia per il subappaltatore.
--    (riscrive invia_lavorazioni_subappaltatore aggiungendo l'UPDATE finale)
--    DROP necessario: il tipo di ritorno potrebbe essere ancora INTEGER
DROP FUNCTION IF EXISTS public.invia_lavorazioni_subappaltatore(UUID);

CREATE FUNCTION public.invia_lavorazioni_subappaltatore(
  collaborazione_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  azienda_corrente UUID := public.current_azienda_id();
  riga public.cantieri_collaborazioni;
  v_lav RECORD;
  n_inviate INTEGER := 0;
  n_rimosse INTEGER := 0;
  n_bloccate INTEGER := 0;
BEGIN
  IF NOT public.current_is_admin() THEN
    RAISE EXCEPTION 'Solo un amministratore può inviare le lavorazioni'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO riga FROM public.cantieri_collaborazioni
  WHERE id = collaborazione_id;

  IF riga.id IS NULL
     OR riga.stato <> 'accettata'
     OR riga.azienda_committente_id <> azienda_corrente
     OR riga.cantiere_collaboratore_id IS NULL THEN
    RAISE EXCEPTION 'Collaborazione non valida per l''invio'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_lav IN
    SELECT id, nome, ordine
    FROM public.lavorazioni_cantiere
    WHERE cantiere_id = riga.cantiere_committente_id
      AND attiva = true
      AND stato = 'approvata'
      AND subappaltata_a_collaborazione_id = collaborazione_id
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.lavorazioni_cantiere
      WHERE cantiere_id = riga.cantiere_collaboratore_id
        AND origine_lavorazione_id = v_lav.id
    ) THEN
      UPDATE public.lavorazioni_cantiere
      SET nome = v_lav.nome, ordine = v_lav.ordine
      WHERE cantiere_id = riga.cantiere_collaboratore_id
        AND origine_lavorazione_id = v_lav.id;
    ELSE
      INSERT INTO public.lavorazioni_cantiere
        (cantiere_id, nome, ordine, attiva, percentuale_completamento,
         stato, origine_lavorazione_id, azienda_id)
      VALUES
        (riga.cantiere_collaboratore_id, v_lav.nome, v_lav.ordine, true, 0,
         'approvata', v_lav.id, riga.azienda_collaboratrice_id);
    END IF;
    n_inviate := n_inviate + 1;
  END LOOP;

  SELECT count(*) INTO n_bloccate
  FROM public.lavorazioni_cantiere sub
  WHERE sub.cantiere_id = riga.cantiere_collaboratore_id
    AND sub.origine_lavorazione_id IS NOT NULL
    AND sub.percentuale_completamento > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.lavorazioni_cantiere orig
      WHERE orig.id = sub.origine_lavorazione_id
        AND orig.attiva = true AND orig.stato = 'approvata'
        AND orig.subappaltata_a_collaborazione_id = collaborazione_id
    );

  WITH eliminate AS (
    DELETE FROM public.lavorazioni_cantiere sub
    WHERE sub.cantiere_id = riga.cantiere_collaboratore_id
      AND sub.origine_lavorazione_id IS NOT NULL
      AND sub.percentuale_completamento = 0
      AND NOT EXISTS (
        SELECT 1 FROM public.lavorazioni_cantiere orig
        WHERE orig.id = sub.origine_lavorazione_id
          AND orig.attiva = true AND orig.stato = 'approvata'
          AND orig.subappaltata_a_collaborazione_id = collaborazione_id
      )
    RETURNING 1
  )
  SELECT count(*) INTO n_rimosse FROM eliminate;

  UPDATE public.cantieri_collaborazioni
  SET novita_per_collaboratore = true
  WHERE id = collaborazione_id;

  RETURN jsonb_build_object('inviate', n_inviate, 'rimosse', n_rimosse, 'bloccate', n_bloccate);
END;
$$;

-- 2. Avanzamento subappaltatore → accende la spia per l'appaltatore
CREATE OR REPLACE FUNCTION public.segnala_avanzamento_collaboratore()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.cantieri_collaborazioni
  SET novita_per_committente = true
  WHERE cantiere_collaboratore_id = NEW.cantiere_id
    AND stato = 'accettata';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS trg_avanzamento_collaboratore ON public.lavorazioni_cantiere;
CREATE TRIGGER trg_avanzamento_collaboratore
  AFTER UPDATE OF percentuale_completamento ON public.lavorazioni_cantiere
  FOR EACH ROW
  WHEN (
    NEW.origine_lavorazione_id IS NOT NULL
    AND NEW.percentuale_completamento IS DISTINCT FROM OLD.percentuale_completamento
  )
  EXECUTE FUNCTION public.segnala_avanzamento_collaboratore();

-- 3. Segna come viste le novità del proprio lato (apertura pagina)
CREATE OR REPLACE FUNCTION public.segna_collaborazioni_viste()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  azienda_corrente UUID := public.current_azienda_id();
BEGIN
  UPDATE public.cantieri_collaborazioni
  SET novita_per_committente = false
  WHERE azienda_committente_id = azienda_corrente AND novita_per_committente;

  UPDATE public.cantieri_collaborazioni
  SET novita_per_collaboratore = false
  WHERE azienda_collaboratrice_id = azienda_corrente AND novita_per_collaboratore;
END;
$$;

NOTIFY pgrst, 'reload schema';
