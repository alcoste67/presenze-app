export const CHECKLIST_FOTOVOLTAICO_STATI = {
  BOZZA: "BOZZA",
  FIRMATO: "FIRMATO",
  INVIATO: "INVIATO",
} as const;

export const LABEL_STATI_CHECKLIST_FOTOVOLTAICO: Record<
  (typeof CHECKLIST_FOTOVOLTAICO_STATI)[keyof typeof CHECKLIST_FOTOVOLTAICO_STATI],
  string
> = {
  [CHECKLIST_FOTOVOLTAICO_STATI.BOZZA]: "Bozza",
  [CHECKLIST_FOTOVOLTAICO_STATI.FIRMATO]: "Firmato",
  [CHECKLIST_FOTOVOLTAICO_STATI.INVIATO]: "Inviato",
};

export const CHECKLIST_FOTOVOLTAICO_LIMITI = {
  FIRMA_MAX_DATA_URL_CARATTERI: 120000,
} as const;

export const CHECKLIST_FOTOVOLTAICO_PDF = {
  FILE_PREFIX: "Checklist_Fotovoltaico",
  LOCALE: "it-IT",
} as const;

// Default di dimensionamento confermati con Alex: precompilati ma sempre
// modificabili in UI (mai hardcoded nei calcoli).
export const CHECKLIST_FOTOVOLTAICO_DEFAULT_DIMENSIONAMENTO = {
  POMPA_CALORE_KWH_ANNO: 3000,
  AUTO_ELETTRICA_KWH_ANNO: 2500,
  INDUZIONE_KWH_ANNO: 400,
  RESA_KWH_PER_KWP: 1200,
  FATTORE_OCCUPAZIONE_FALDA: 0.7,
  MARGINE_BATTERIA: 1.15,
} as const;

export const CHECKLIST_FOTOVOLTAICO_TESTI = {
  TITOLO: "Checklist Fotovoltaico",
  CARD_DESCRIZIONE:
    "Sopralluogo e dimensionamento impianto fotovoltaico, firmato da tecnico e cliente",
  BACKOFFICE: "Back-office",
  TIMBRATURE: "Timbrature",
  LISTA: "Elenco checklist",
  NUOVO: "Nuova checklist",
  FIRMA_PAGINA_TITOLO: "Firma checklist",

  SEZIONE_DATI_CLIENTE: "Dati cliente e immobile",
  RAGIONE_SOCIALE: "Ragione sociale (se azienda)",
  PIVA: "P.IVA",
  NOME: "Nome",
  COGNOME: "Cognome",
  VIA: "Via",
  COMUNE: "Comune",
  CAP: "CAP",
  PROVINCIA: "Prov.",
  TELEFONO: "Telefono",
  EMAIL_CLIENTE: "Email cliente",
  EMAIL_CLIENTE_HELPER: "Serve per inviare qui il PDF firmato",

  SEZIONE_FALDA: "Falda e copertura",
  TIPO_COPERTURA: "Tipo di copertura (tegole, lamiera, piano...)",
  ORIENTAMENTO_FALDA: "Orientamento falda",
  INCLINAZIONE_FALDA: "Inclinazione falda (gradi)",
  SUPERFICIE_FALDA: "Superficie falda disponibile (mq)",
  OMBREGGIAMENTI_PRESENTI: "Sono presenti ombreggiamenti?",
  NOTE_OMBREGGIAMENTI: "Note ombreggiamenti",

  SEZIONE_VERIFICHE: "Verifiche tecniche",
  POTENZA_CONTATORE: "Potenza contatore contrattuale (kW)",
  QUADRO_CONFORME: "Il quadro elettrico è conforme?",
  IMPIANTO_A_NORMA: "L'impianto elettrico è a norma?",
  DICHIARAZIONE_CONFORMITA: "È disponibile la dichiarazione di conformità?",
  AUTORIZZAZIONI_NECESSARIE: "Sono necessarie autorizzazioni (comune, soprintendenza...)?",
  MESSA_A_TERRA: "Esiste impianto di messa a terra?",
  STRUTTURA_IDONEA: "La struttura del tetto è idonea a sostenere il carico?",
  OPERE_ADEGUAMENTO_NECESSARIE: "Sono necessarie opere di adeguamento?",
  SI: "Sì",
  NO: "No",

  SEZIONE_DIMENSIONAMENTO: "Dimensionamento",
  CONSUMO_F1: "Consumo annuo F1 (kWh)",
  CONSUMO_F2: "Consumo annuo F2 (kWh)",
  CONSUMO_F3: "Consumo annuo F3 (kWh)",
  CONSUMO_F3_HELPER: "Il consumo F3 (notturno) determina il dimensionamento della batteria",
  SVILUPPI_FUTURI_TITOLO: "Sviluppi futuri",
  POMPA_CALORE: "Pompa di calore",
  POMPA_CALORE_KWH: "Consumo stimato pompa di calore (kWh/anno)",
  AUTO_ELETTRICA: "Ricarica auto elettrica",
  AUTO_ELETTRICA_KWH: "Consumo stimato auto elettrica (kWh/anno)",
  INDUZIONE: "Piano a induzione",
  INDUZIONE_KWH: "Consumo stimato induzione (kWh/anno)",
  ALTRO: "Altro",
  ALTRO_DESCRIZIONE: "Descrizione altro consumo",
  ALTRO_KWH: "Consumo stimato altro (kWh/anno)",
  PARAMETRI_CALCOLO_TITOLO: "Parametri di calcolo",
  RESA_KWH_PER_KWP: "Resa (kWh/kWp/anno)",
  FATTORE_OCCUPAZIONE_FALDA: "Fattore di occupazione falda",
  MARGINE_BATTERIA: "Margine batteria",
  MODULO_FOTOVOLTAICO: "Modulo fotovoltaico",
  MODULO_FOTOVOLTAICO_NESSUNO: "Nessun modulo selezionato",
  RISULTATI_TITOLO: "Risultati del dimensionamento",
  RISULTATI_NON_DISPONIBILI:
    "I risultati del dimensionamento saranno disponibili a breve (calcolo automatico in arrivo)",
  FABBISOGNO_TOTALE: "Fabbisogno totale annuo",
  POTENZA_CONSIGLIATA: "Potenza consigliata",
  POTENZA_MASSIMA: "Potenza massima installabile",
  NUMERO_MODULI_MAX: "Numero massimo moduli",
  BATTERIA_CONSIGLIATA: "Batteria consigliata",

  MATERIALI_TITOLO: "Materiali e componenti previsti",
  DESCRIZIONE_PLACEHOLDER: "Descrizione",
  QUANTITA: "Quantità",
  AGGIUNGI_MATERIALE: "Aggiungi riga",
  RIMUOVI_MATERIALE: "Rimuovi",

  NOTE: "Note",
  LUOGO: "Luogo",
  DATA_SOPRALLUOGO: "Data sopralluogo",

  FIRMA_TECNICO: "Nome e firma tecnico",
  FIRMA_CLIENTE: "Firma cliente",
  NOME_FIRMA_TECNICO: "Nome tecnico",
  NOME_FIRMA_CLIENTE: "Nome cliente",
  CANCELLA_FIRMA: "Cancella",
  FIRMA_AVVISO:
    "Stai per firmare questa checklist: dopo la conferma non potrà più essere modificata.",
  CONFERMA_FIRMA: "Conferma firma",
  FIRMA_IN_CORSO: "Firma in corso...",
  FIRMA_CONFERMATA: "Checklist firmata",
  VAI_ALLA_FIRMA: "Firma",
  CHECKLIST_NON_FIRMABILE: "La checklist non è in bozza e non può essere firmata",

  SALVA: "Salva bozza",
  SALVA_MODIFICHE: "Salva modifiche",
  MODIFICA: "Modifica",
  MODIFICA_TITOLO: "Modifica checklist",
  SALVATAGGIO: "Salvataggio...",
  ANNULLA: "Annulla",
  CARICAMENTO: "Caricamento...",
  CREATO_IL: "Creato il",
  STATO: "Stato",
  NESSUNA_CHECKLIST: "Nessuna checklist creata",
  DOWNLOAD_PDF: "Scarica PDF",
  INVIA: "Invia via email",
  INVIA_ORA: "Invia ora",
  INVIA_IN_CORSO: "Invio...",
  PROPOSTA_INVIO_POST_FIRMA:
    "La checklist è firmata e non è più modificabile. Vuoi inviarla subito via email al cliente?",
  INVIO_CONFERMA: "Il PDF firmato verrà inviato via email a",

  ERRORI: {
    GENERICO: "Errore gestione checklist fotovoltaico",
    NOME_O_RAGIONE_SOCIALE_OBBLIGATORIO: "Inserisci nome e cognome o ragione sociale del cliente",
    COMUNE_OBBLIGATORIO: "Inserisci il comune",
    EMAIL_CLIENTE_OBBLIGATORIA:
      "Inserisci l'email del cliente: serve per inviare il PDF firmato",
    EMAIL_NON_VALIDA: "Inserisci un indirizzo email valido",
    FIRME_OBBLIGATORIE: "Inserisci entrambe le firme prima di confermare",
    FIRMA_TECNICO_NOME_OBBLIGATORIO: "Inserisci nome e cognome di chi firma come tecnico",
    FIRMA_CLIENTE_NOME_OBBLIGATORIO: "Inserisci nome e cognome di chi firma per il cliente",
    FIRMA_TROPPO_GRANDE: "Firma troppo grande",
    CHECKLIST_NON_TROVATA: "Checklist non trovata",
    CHECKLIST_FIRMATA: "Checklist firmata non modificabile",
    INVIO_SOLO_FIRMATA: "Si possono inviare solo checklist firmate",
    PDF_TROPPO_GRANDE: "PDF troppo pesante per l'invio email (oltre 5 MB)",
    INVIO_NON_CONFIGURATO: "Invio email non configurato (RESEND_API_KEY mancante)",
    INVIO_FALLITO: "Invio non riuscito: la checklist resta firmata, riprova",
    SESSIONE_MANCANTE: "Sessione utente non valida",
    TOKEN_MANCANTE: "Token autenticazione mancante",
    TOKEN_NON_VALIDO: "Token autenticazione non valido",
    ACCESSO_NEGATO: "Accesso non autorizzato",
    PDF_GENERICO: "Errore generazione PDF checklist fotovoltaico",
  },

  MESSAGGI: {
    CREATA: "Checklist creata",
    MODIFICATA: "Checklist modificata",
    FIRMATA: "Checklist firmata",
    INVIATA: "Checklist inviata a",
  },

  PDF: {
    TITOLO: "CHECKLIST SOPRALLUOGO IMPIANTO FOTOVOLTAICO",
    PAGINA: "Pagina",
    DI: "di",
    DATA_FIRMA: "Data firma",
  },
} as const;
