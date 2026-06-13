-- TASK 6e — Accettazione collaborazione con creazione cantiere (2026-06-13)
-- ============================================================
-- All'accettazione, il subappaltatore NON sceglie più un cantiere
-- esistente: il cantiere viene CREATO automaticamente ereditando
-- nome + indirizzo + lavorazioni dal cantiere del committente.
-- Il cliente del nuovo cantiere = nome dell'appaltatore (committente),
-- perché per il subappaltatore è il suo cliente.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

-- Snapshot indirizzo del cantiere committente (nome già presente)
ALTER TABLE public.cantieri_collaborazioni
  ADD COLUMN IF NOT EXISTS cantiere_committente_indirizzo TEXT NOT NULL DEFAULT '';

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

  -- Cliente = nome appaltatore (riuso se già esiste, evita doppioni)
  SELECT id INTO nuovo_cliente_id FROM public.clienti
  WHERE azienda_id = azienda_corrente
    AND lower(ragione_sociale) = lower(riga.azienda_committente_nome)
  LIMIT 1;

  IF nuovo_cliente_id IS NULL THEN
    INSERT INTO public.clienti (ragione_sociale, azienda_id, creato_da, note)
    VALUES (
      riga.azienda_committente_nome,
      azienda_corrente,
      auth.uid(),
      'Appaltatore (creato da collaborazione cantiere)'
    )
    RETURNING id INTO nuovo_cliente_id;
  END IF;

  -- Cantiere ereditato (nome + indirizzo committente, cliente = appaltatore)
  INSERT INTO public.cantieri (nome, indirizzo, lavorazioni, attivo, cliente_id, azienda_id)
  VALUES (
    riga.cantiere_committente_nome,
    COALESCE(riga.cantiere_committente_indirizzo, ''),
    '',
    true,
    nuovo_cliente_id,
    azienda_corrente
  )
  RETURNING id INTO nuovo_cantiere_id;

  -- Eredita le lavorazioni del committente (nome + ordine, NO prezzi)
  FOR v_lav IN
    SELECT id, nome, ordine
    FROM public.lavorazioni_cantiere
    WHERE cantiere_id = riga.cantiere_committente_id
      AND attiva = true
      AND stato = 'approvata'
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

-- ============================================================
-- TEST su DEV:
--   A) Committente invita su un cantiere con nome/indirizzo/lavorazioni
--   B) Subappaltatore: "Accetta" → nasce un cantiere identico (nome,
--      indirizzo, lavorazioni a 0%), con cliente = nome appaltatore
--   C) Le lavorazioni ereditate non hanno prezzo del committente
NOTIFY pgrst, 'reload schema';
