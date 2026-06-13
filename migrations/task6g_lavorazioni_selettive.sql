-- TASK 6g — Condivisione selettiva lavorazioni per subappaltatore (2026-06-13)
-- ============================================================
-- Ogni lavorazione del committente può essere assegnata a una specifica
-- collaborazione (= a un subappaltatore). Invio ed eredità copiano solo
-- le voci assegnate a quella collaborazione. Voci non assegnate (NULL)
-- restano interne all'appaltatore.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

ALTER TABLE public.lavorazioni_cantiere
  ADD COLUMN IF NOT EXISTS subappaltata_a_collaborazione_id UUID
    REFERENCES public.cantieri_collaborazioni(id) ON DELETE SET NULL;

-- Invio: solo le voci assegnate a QUESTA collaborazione
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

  -- Rimozione (solo a 0%): voci copiate la cui origine non è più
  -- attiva/approvata O non è più assegnata a questa collaborazione
  DELETE FROM public.lavorazioni_cantiere sub
  WHERE sub.cantiere_id = riga.cantiere_collaboratore_id
    AND sub.origine_lavorazione_id IS NOT NULL
    AND sub.percentuale_completamento = 0
    AND NOT EXISTS (
      SELECT 1 FROM public.lavorazioni_cantiere orig
      WHERE orig.id = sub.origine_lavorazione_id
        AND orig.attiva = true
        AND orig.stato = 'approvata'
        AND orig.subappaltata_a_collaborazione_id = collaborazione_id
    );

  RETURN n_inviate;
END;
$$;

-- Eredità all'accettazione: solo voci assegnate a questa collaborazione
CREATE OR REPLACE FUNCTION public.accetta_collaborazione_crea_cantiere(
  collaborazione_id UUID
)
RETURNS public.cantieri_collaborazioni
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  azienda_corrente UUID := public.current_azienda_id();
  email_corrente TEXT := lower(auth.jwt() ->> 'email');
  riga public.cantieri_collaborazioni;
  azienda_nome TEXT;
  nuovo_cliente_id UUID;
  nuovo_cantiere_id UUID;
  v_lav RECORD;
BEGIN
  IF NOT public.current_is_admin() THEN
    RAISE EXCEPTION 'Solo un amministratore può accettare la collaborazione'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO riga FROM public.cantieri_collaborazioni
  WHERE id = collaborazione_id;

  IF riga.id IS NULL
     OR riga.stato <> 'invitata'
     OR lower(riga.email_invito) <> email_corrente THEN
    RAISE EXCEPTION 'Invito non valido per questo utente' USING ERRCODE = 'P0001';
  END IF;

  IF azienda_corrente = riga.azienda_committente_id THEN
    RAISE EXCEPTION 'Committente e collaboratore non possono coincidere'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO nuovo_cliente_id FROM public.clienti
  WHERE azienda_id = azienda_corrente
    AND lower(ragione_sociale) = lower(riga.azienda_committente_nome)
  LIMIT 1;

  IF nuovo_cliente_id IS NULL THEN
    INSERT INTO public.clienti (ragione_sociale, azienda_id, creato_da, note)
    VALUES (riga.azienda_committente_nome, azienda_corrente, auth.uid(),
            'Appaltatore (creato da collaborazione cantiere)')
    RETURNING id INTO nuovo_cliente_id;
  END IF;

  INSERT INTO public.cantieri (nome, indirizzo, lavorazioni, attivo, cliente_id, azienda_id)
  VALUES (riga.cantiere_committente_nome,
          COALESCE(riga.cantiere_committente_indirizzo, ''),
          '', true, nuovo_cliente_id, azienda_corrente)
  RETURNING id INTO nuovo_cantiere_id;

  FOR v_lav IN
    SELECT id, nome, ordine
    FROM public.lavorazioni_cantiere
    WHERE cantiere_id = riga.cantiere_committente_id
      AND attiva = true
      AND stato = 'approvata'
      AND subappaltata_a_collaborazione_id = collaborazione_id
  LOOP
    INSERT INTO public.lavorazioni_cantiere
      (cantiere_id, nome, ordine, attiva, percentuale_completamento,
       stato, origine_lavorazione_id, azienda_id)
    VALUES
      (nuovo_cantiere_id, v_lav.nome, v_lav.ordine, true, 0,
       'approvata', v_lav.id, azienda_corrente);
  END LOOP;

  SELECT nome INTO azienda_nome FROM public.aziende WHERE id = azienda_corrente;

  UPDATE public.cantieri_collaborazioni
  SET azienda_collaboratrice_id = azienda_corrente,
      azienda_collaboratrice_nome = COALESCE(azienda_nome, ''),
      cantiere_collaboratore_id = nuovo_cantiere_id,
      cantiere_collaboratore_nome = riga.cantiere_committente_nome,
      stato = 'accettata',
      accettato_il = now()
  WHERE id = collaborazione_id
  RETURNING * INTO riga;

  RETURN riga;
END;
$$;

NOTIFY pgrst, 'reload schema';
