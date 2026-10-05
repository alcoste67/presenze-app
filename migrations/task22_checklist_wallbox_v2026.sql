-- TASK 22 — Checklist wallbox: nuovo modulo Edison V1_2026.03.12 (2026-10-04)
-- ============================================================
-- Il modulo cartaceo Edison e' stato aggiornato: cambiano le domande,
-- la tabella materiali e si aggiunge una planimetria sintetica da
-- disegnare. Aggiungo solo colonne nuove, NON tocco/droppo quelle
-- vecchie ora inutilizzate (quadro_conforme, impianto_a_norma,
-- dichiarazione_conformita, opere_adeguamento_necessarie,
-- installazione_possibile resta) per non perdere lo storico delle
-- checklist gia' compilate con il modulo precedente.
--
-- Eseguire prima su DEV (mkfedjazibcmstkjxkfm), verificare, poi PROD.

ALTER TABLE public.checklist_wallbox
  -- Le due nuove domande SI/NO che sostituiscono le 3 rimosse
  ADD COLUMN IF NOT EXISTS stabile_cpi BOOLEAN,
  ADD COLUMN IF NOT EXISTS obbligo_progetto_elettrico BOOLEAN,

  -- Nuova riga di intestazione "Ragione Sociale Ditta / Codice Ditta":
  -- riferita alla ditta installatrice (riusiamo ragione_sociale per
  -- "Ditta"), codice_ditta e' il nuovo campo per il codice assegnato
  -- da Edison.
  ADD COLUMN IF NOT EXISTS codice_ditta TEXT NOT NULL DEFAULT '',

  -- Misura impianto di terra in Ohm (testo libero, es. "12")
  ADD COLUMN IF NOT EXISTS misura_terra_ohm TEXT,

  -- Descrizione percorso cavi e posizionamento quadro elettrico
  ADD COLUMN IF NOT EXISTS descrizione_percorso_cavi TEXT NOT NULL DEFAULT '',

  -- Planimetria sintetica: disegno a mano salvato come immagine, stesso
  -- meccanismo delle firme (data URL)
  ADD COLUMN IF NOT EXISTS planimetria_data_url TEXT,

  -- Posizionamento wallbox ora a scelta multipla; la vecchia colonna
  -- "posizionamento" resta come dettaglio libero (usato solo se tipo = ALTRO)
  ADD COLUMN IF NOT EXISTS posizionamento_tipo TEXT
    CHECK (posizionamento_tipo IN ('BOX_SINGOLO', 'CONDOMINIO', 'PARCHEGGIO_APERTO', 'ALTRO')),

  -- Righe "(Altro)" a testo libero per cavi e interruttori
  ADD COLUMN IF NOT EXISTS cavo_altro_descrizione TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cavo_altro_quantita TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interruttore_altro_descrizione TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interruttore_altro_quantita TEXT NOT NULL DEFAULT '',

  -- Le 3 righe libere della categoria ALTRO della tabella materiali
  ADD COLUMN IF NOT EXISTS materiali_altro JSONB NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
