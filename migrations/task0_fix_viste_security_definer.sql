-- TASK 0 — Fix Security Advisor: viste SECURITY DEFINER
-- ============================================================
-- Problema: macchinari_pubblici e costi_macchinari_pubblici scavalcano
-- le RLS delle tabelle base senza alcun filtro tenant → leak cross-tenant.
--
-- Fix scelto: le viste RESTANO SECURITY DEFINER (deroga documentata alla
-- regola di progetto) perché devono nascondere le colonne prezzo/costo a
-- operai e responsabili, cosa che la RLS non può fare (filtra righe, non
-- colonne). Il leak cross-tenant si elimina col filtro esplicito
-- azienda_id = current_azienda_id() DENTRO la definizione della vista.
-- Il Security Advisor continuerà a segnalarle: warning accettato.
--
-- Esecuzione: prima su DEV (mkfedjazibcmstkjxkfm), test con utenti di
-- 2 aziende diverse, poi su PROD (skdtczhvxvawwjanciss).

-- 1. macchinari_pubblici: solo colonne safe (niente costo_orario,
--    niente azienda_id), filtro tenant esplicito
CREATE OR REPLACE VIEW public.macchinari_pubblici AS
 SELECT id,
    nome,
    tipo,
    descrizione,
    attivo
   FROM public.macchinari
  WHERE azienda_id = public.current_azienda_id();

-- 2. costi_macchinari_pubblici: senza tariffa_oraria e costo_totale,
--    filtro tenant esplicito
CREATE OR REPLACE VIEW public.costi_macchinari_pubblici AS
 SELECT id,
    cantiere_id,
    rapporto_intervento_id,
    macchinario_id,
    tipo_macchinario,
    descrizione,
    data_utilizzo,
    ore_utilizzo,
    note,
    created_by,
    created_at,
    updated_at
   FROM public.costi_macchinari_commessa
  WHERE azienda_id = public.current_azienda_id();

-- 3. Le viste erano GRANTate anche ad anon: nessun utente non autenticato
--    deve leggerle (current_azienda_id() sarebbe NULL, ma meglio chiudere)
REVOKE ALL ON public.macchinari_pubblici FROM anon;
REVOKE ALL ON public.costi_macchinari_pubblici FROM anon;

-- ============================================================
-- TEST su DEV (eseguire come utenti reali via app o con JWT impersonato):
--   A) Utente azienda 1 (responsabile): SELECT * FROM macchinari_pubblici;
--      → vede SOLO i macchinari della propria azienda, senza costo_orario
--   B) Utente azienda 2: stesso test → vede solo i propri
--   C) Responsabile: SELECT * FROM costi_macchinari_pubblici;
--      → solo righe della propria azienda, niente tariffa/costo_totale
--   D) Client anon (senza login): SELECT sulla vista → permission denied
