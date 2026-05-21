export const STATI = {
  FUORI: "FUORI",
  DENTRO: "DENTRO",
  IN_PAUSA: "IN_PAUSA",
} as const;

export const TIMBRATURE = {
  ENTRATA: "ENTRATA",
  PAUSA: "PAUSA",
  RIENTRO: "RIENTRO",
  USCITA: "USCITA",
  CAMBIO_CANTIERE: "CAMBIO_CANTIERE",
} as const;

export const TIMBRATURE_TESTI = {
  UI: {
    LOGO_ALT: "A2C Sistemi",
    APP_TITOLO: "Presenze",
    APP_SOTTOTITOLO:
      "Timbrature operative",
    DESTINAZIONE_TITOLO:
      "Destinazione lavoro",
    DESTINAZIONE_DESCRIZIONE:
      "Seleziona un cantiere oppure un'attività.",
    STORICO: "Storico",
    BACKOFFICE: "Back-office",
    LOGOUT: "Logout",
    UTENTE_PREFIX: "Utente",
    CARICAMENTO: "Caricamento...",
  },
  AZIONI: {
    SALVATAGGIO: "Salvataggio...",
    ENTRATA: "TIMBRA ENTRATA",
    PAUSA: "INIZIA PAUSA",
    RIENTRO: "FINE PAUSA",
    USCITA: "TIMBRA USCITA",
    CAMBIO_CANTIERE: "Cambia cantiere",
  },
  AZIONI_DESCRIZIONI: {
    ENTRATA:
      "Avvia il turno sul cantiere selezionato",
    PAUSA:
      "Sospendi temporaneamente il lavoro",
    RIENTRO:
      "Riprendi il turno dopo la pausa",
    USCITA:
      "Chiudi il turno e registra le lavorazioni",
    CAMBIO_CANTIERE:
      "Chiudi il cantiere corrente e aprine uno nuovo",
  },
  MESSAGGI: {
    REGISTRATA_PREFIX: "Timbratura",
    REGISTRATA_SUFFIX: "registrata",
  },
  STATO: {
    TITOLO: "Stato attuale",
    LIVE: "Live",
    ULTIMA_TIMBRATURA:
      "Ultima timbratura",
    ULTIMA_TIMBRATURA_ORA: "alle",
    NESSUNA_TIMBRATURA:
      "Nessuna timbratura",
    FUORI_DESCRIZIONE:
      "Fuori dal lavoro",
    DENTRO_DESCRIZIONE: "Turno attivo",
    IN_PAUSA_DESCRIZIONE:
      "Pausa in corso",
    CAMBIO_CANTIERE_LABEL:
      "Cambio cantiere",
  },
  ERRORI: {
    GENERICO: "Errore timbratura",
    DESTINAZIONE_OBBLIGATORIA:
      "Seleziona un cantiere oppure un'attività",
    DESTINAZIONE_ESCLUSIVA:
      "Seleziona solo un cantiere oppure solo un'attività",
    CAMBIO_CANTIERE_OBBLIGATORIO:
      "Seleziona il nuovo cantiere",
    CAMBIO_CANTIERE_STESSO:
      "Seleziona un cantiere diverso da quello corrente",
    CAMBIO_CANTIERE_ATTIVITA_NON_CONSENTITA:
      "Cambio cantiere non consentito su attività generica",
  },
} as const;
