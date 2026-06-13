-- TASK 6d (Fase C) — Push lavorazioni committente → subappaltatore (2026-06-13)
-- ============================================================
-- Il committente "invia" le voci di lavorazione del proprio cantiere al
-- cantiere del subappaltatore: nomi allineati (niente merge), prezzi NON
-- condivisi. Il subappaltatore aggiorna solo le %.
--
-- La copia nel cantiere subappaltatore tiene un riferimento alla voce
-- originale del committente (origine_lavorazione_id) per ricollegare in
-- seguito % ↔ prezzo lato committente (Fase D).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

ALTER TABLE public.lavorazioni_cantiere
  ADD COLUMN IF NOT EXISTS origine_lavorazione_id UUID;

-- RPC: copia/aggiorna le voci del cantiere committente nel cantiere
-- collaboratore. SECURITY DEFINER (scrittura cross-tenant controllata):
-- valida che il chiamante sia admin committente di una collaborazione
-- accettata. Non copia prezzi né quantità.
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

  FOR v_lav IN
    SELECT id, nome, ordine
    FROM public.lavorazioni_cantiere
    WHERE cantiere_id = riga.cantiere_committente_id
      AND attiva = true
      AND stato = 'approvata'
  LOOP
    -- Già inviata? aggiorna solo il nome (non tocca la % del subappaltatore)
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

  RETURN n_inviate;
END;
$$;

-- ============================================================
-- TEST su DEV:
--   A) Committente: definisce lavorazioni (con prezzi) sul proprio
--      cantiere → "Invia al subappaltatore"
--   B) Subappaltatore: ritrova le stesse voci nel suo cantiere, avanza %
--   C) Le voci copiate NON hanno prezzo/quantità del committente
NOTIFY pgrst, 'reload schema';
