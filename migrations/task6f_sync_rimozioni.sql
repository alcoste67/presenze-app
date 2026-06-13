-- TASK 6f — Sync lavorazioni: rimozione voci a 0% (2026-06-13)
-- ============================================================
-- Estende invia_lavorazioni_subappaltatore: quando l'appaltatore rimuove
-- o disattiva una voce, alla sincronizzazione la copia nel cantiere del
-- subappaltatore viene eliminata SOLO se è ancora a 0% (le voci già
-- avanzate restano, per non perdere dati).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

CREATE OR REPLACE FUNCTION public.invia_lavorazioni_subappaltatore(
  collaborazione_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  azienda_corrente UUID := public.current_azienda_id();
  riga public.cantieri_collaborazioni;
  v_lav RECORD;
  n_inviate INTEGER := 0;
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

  -- Upsert delle voci attive/approvate del committente
  FOR v_lav IN
    SELECT id, nome, ordine
    FROM public.lavorazioni_cantiere
    WHERE cantiere_id = riga.cantiere_committente_id
      AND attiva = true
      AND stato = 'approvata'
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

  -- Rimozione: voci copiate la cui origine non è più attiva/approvata
  -- presso il committente, SOLO se ancora a 0% (le avanzate restano)
  DELETE FROM public.lavorazioni_cantiere sub
  WHERE sub.cantiere_id = riga.cantiere_collaboratore_id
    AND sub.origine_lavorazione_id IS NOT NULL
    AND sub.percentuale_completamento = 0
    AND NOT EXISTS (
      SELECT 1 FROM public.lavorazioni_cantiere orig
      WHERE orig.id = sub.origine_lavorazione_id
        AND orig.attiva = true
        AND orig.stato = 'approvata'
    );

  RETURN n_inviate;
END;
$$;

NOTIFY pgrst, 'reload schema';
