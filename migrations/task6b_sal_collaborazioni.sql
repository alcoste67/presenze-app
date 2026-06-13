-- TASK 6b — SAL unico: lettura avanzamenti subappaltatore (2026-06-13)
-- ============================================================
-- Espone al committente, in SOLA LETTURA e solo via questa funzione,
-- le lavorazioni (nome + %) del cantiere del subappaltatore, per i
-- cantieri con collaborazione ACCETTATA. Nessun dato economico, nessun
-- accesso diretto cross-tenant: l'isolamento RESTRICTIVE resta intatto.
--
-- SECURITY DEFINER con filtro esplicito (deroga documentata, come le
-- viste macchinari): la funzione verifica che il chiamante sia il
-- committente di una collaborazione accettata sul cantiere richiesto.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), test, poi PROD.

CREATE OR REPLACE FUNCTION public.sal_collaborazioni_cantiere(
  cantiere_committente UUID
)
RETURNS TABLE (
  azienda_collaboratrice_nome TEXT,
  cantiere_collaboratore_nome TEXT,
  lavorazione_nome TEXT,
  percentuale_completamento INTEGER
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  azienda_corrente UUID := public.current_azienda_id();
BEGIN
  RETURN QUERY
  SELECT
    cc.azienda_collaboratrice_nome,
    cc.cantiere_collaboratore_nome,
    l.nome,
    l.percentuale_completamento
  FROM public.cantieri_collaborazioni cc
  JOIN public.lavorazioni_cantiere l
    ON l.cantiere_id = cc.cantiere_collaboratore_id
  WHERE cc.cantiere_committente_id = cantiere_committente
    AND cc.azienda_committente_id = azienda_corrente
    AND cc.stato = 'accettata'
    AND l.attiva = true
    AND l.stato <> 'rifiutata'
  ORDER BY cc.azienda_collaboratrice_nome, l.ordine, l.nome;
END;
$$;

-- ============================================================
-- TEST su DEV:
--   A) Come committente A2C su un cantiere con collaborazione accettata:
--      SELECT * FROM sal_collaborazioni_cantiere('<cantiere A2C>')
--      → ritorna le lavorazioni+% del cantiere alphacos collegato
--   B) Stessa SELECT da un'azienda terza (o senza collaborazione) → 0 righe
--   C) Nessuna colonna costo/tariffa esposta
NOTIFY pgrst, 'reload schema';
