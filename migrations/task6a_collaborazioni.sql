-- TASK 6a — Collaborazioni tra aziende su cantiere condiviso (2026-06-13)
-- ============================================================
-- Prima deroga CONTROLLATA al confine multi-tenant. Due aziende
-- (committente + collaboratrice/subappaltatrice) si collegano SU UN
-- SINGOLO CANTIERE, su invito + accettazione. Ognuna tiene il proprio
-- cantiere e ci lavora nel proprio spazio; il committente otterrà (Fase B)
-- una vista in SOLA LETTURA di nome lavorazione + % del subappaltatore,
-- per il SAL unico. Nessun dato economico attraversa mai il confine.
--
-- NOTA SICUREZZA: NON si toccano le policy RESTRICTIVE di tenant
-- isolation esistenti. La tabella ponte è cross per natura e ha policy
-- proprie; l'esposizione dei dati avverrà solo via RPC SECURITY DEFINER
-- circoscritte (Fase B).
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

CREATE TABLE public.cantieri_collaborazioni (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- lato committente (chi invita)
  cantiere_committente_id UUID NOT NULL REFERENCES public.cantieri(id),
  azienda_committente_id UUID NOT NULL,
  -- snapshot nomi: l'azienda invitata non può leggere i cantieri/aziende
  -- dell'altro tenant (RLS), quindi servono denormalizzati
  cantiere_committente_nome TEXT NOT NULL DEFAULT '',
  azienda_committente_nome TEXT NOT NULL DEFAULT '',
  email_invito TEXT NOT NULL,
  -- lato collaboratore (valorizzati all'accettazione)
  azienda_collaboratrice_id UUID,
  azienda_collaboratrice_nome TEXT NOT NULL DEFAULT '',
  cantiere_collaboratore_id UUID REFERENCES public.cantieri(id),
  cantiere_collaboratore_nome TEXT NOT NULL DEFAULT '',
  stato TEXT NOT NULL DEFAULT 'invitata'
    CHECK (stato IN ('invitata', 'accettata', 'revocata')),
  creato_da UUID,
  creato_il TIMESTAMPTZ NOT NULL DEFAULT now(),
  accettato_il TIMESTAMPTZ
);

CREATE INDEX cantieri_collab_committente_idx
  ON public.cantieri_collaborazioni (azienda_committente_id);
CREATE INDEX cantieri_collab_collaboratrice_idx
  ON public.cantieri_collaborazioni (azienda_collaboratrice_id);
CREATE INDEX cantieri_collab_email_idx
  ON public.cantieri_collaborazioni (lower(email_invito));

ALTER TABLE public.cantieri_collaborazioni ENABLE ROW LEVEL SECURITY;

-- Vedo la riga se sono il committente, la collaboratrice, o se l'invito
-- è indirizzato alla mia email (per gli inviti ancora da accettare)
CREATE POLICY collab_select ON public.cantieri_collaborazioni
  FOR SELECT TO authenticated
  USING (
    azienda_committente_id = public.current_azienda_id()
    OR azienda_collaboratrice_id = public.current_azienda_id()
    OR lower(email_invito) = lower(auth.jwt() ->> 'email')
  );

-- Invita: solo admin, solo per un proprio cantiere
CREATE POLICY collab_insert_committente ON public.cantieri_collaborazioni
  FOR INSERT TO authenticated
  WITH CHECK (
    azienda_committente_id = public.current_azienda_id()
    AND public.current_is_admin()
  );

-- Revoca (committente) — l'accettazione passa invece da RPC dedicata
CREATE POLICY collab_update_committente ON public.cantieri_collaborazioni
  FOR UPDATE TO authenticated
  USING (
    azienda_committente_id = public.current_azienda_id()
    AND public.current_is_admin()
  )
  WITH CHECK (
    azienda_committente_id = public.current_azienda_id()
    AND public.current_is_admin()
  );

-- ── RPC accettazione: l'azienda invitata aggancia un proprio cantiere ──
-- SECURITY DEFINER per scrivere i campi lato collaboratore in modo
-- controllato: verifica che il chiamante sia admin, che l'invito sia per
-- la sua email, e che il cantiere scelto sia della sua azienda.
CREATE OR REPLACE FUNCTION public.accetta_collaborazione(
  collaborazione_id UUID,
  cantiere_collaboratore UUID
)
RETURNS public.cantieri_collaborazioni
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  azienda_corrente UUID := public.current_azienda_id();
  email_corrente TEXT := lower(auth.jwt() ->> 'email');
  riga public.cantieri_collaborazioni;
  cantiere_azienda UUID;
  cantiere_nome TEXT;
  azienda_nome TEXT;
BEGIN
  IF NOT public.current_is_admin() THEN
    RAISE EXCEPTION 'Solo un amministratore può accettare la collaborazione'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO riga FROM public.cantieri_collaborazioni
  WHERE id = collaborazione_id;

  IF riga.id IS NULL THEN
    RAISE EXCEPTION 'Collaborazione non trovata' USING ERRCODE = 'P0001';
  END IF;

  IF riga.stato <> 'invitata' OR lower(riga.email_invito) <> email_corrente THEN
    RAISE EXCEPTION 'Invito non valido per questo utente' USING ERRCODE = 'P0001';
  END IF;

  -- Il cantiere agganciato deve appartenere all'azienda di chi accetta
  SELECT azienda_id, nome INTO cantiere_azienda, cantiere_nome
  FROM public.cantieri WHERE id = cantiere_collaboratore;

  IF cantiere_azienda IS NULL OR cantiere_azienda <> azienda_corrente THEN
    RAISE EXCEPTION 'Il cantiere scelto non appartiene alla tua azienda'
      USING ERRCODE = 'P0001';
  END IF;

  IF azienda_corrente = riga.azienda_committente_id THEN
    RAISE EXCEPTION 'Committente e collaboratore non possono coincidere'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT nome INTO azienda_nome FROM public.aziende WHERE id = azienda_corrente;

  UPDATE public.cantieri_collaborazioni
  SET azienda_collaboratrice_id = azienda_corrente,
      azienda_collaboratrice_nome = COALESCE(azienda_nome, ''),
      cantiere_collaboratore_id = cantiere_collaboratore,
      cantiere_collaboratore_nome = COALESCE(cantiere_nome, ''),
      stato = 'accettata',
      accettato_il = now()
  WHERE id = collaborazione_id
  RETURNING * INTO riga;

  RETURN riga;
END;
$$;

-- ============================================================
-- TEST su DEV (A2C committente ↔ alphacos 1 collaboratrice):
--   A) Admin A2C: invita alphacos su un cantiere A2C (email admin alphacos)
--   B) Admin alphacos: vede l'invito, accetta scegliendo un suo cantiere
--   C) Admin alphacos NON vede gli altri dati di A2C; A2C non vede dati
--      alphacos diversi da quel cantiere (verifica in Fase B)
--   D) Una terza azienda non vede la collaborazione
NOTIFY pgrst, 'reload schema';
