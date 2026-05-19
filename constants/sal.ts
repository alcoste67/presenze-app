export const SAL_STATI = {
  NON_INIZIATA: "NON_INIZIATA",
  IN_CORSO: "IN_CORSO",
  COMPLETATA: "COMPLETATA",
} as const;

export const SAL_TESTI = {
  TITOLO: "SAL",
  CARD_DESCRIZIONE:
    "Avanzamento lavorazioni per cantiere",
  BACKOFFICE: "Back-office",
  TIMBRATURE: "Timbrature",
  CANTIERE: "Cantiere",
  SELEZIONA_CANTIERE:
    "Seleziona un cantiere",
  NESSUN_CANTIERE:
    "Nessun cantiere disponibile",
  CARICAMENTO: "Caricamento...",
  AVANZAMENTO_TOTALE:
    "Avanzamento totale cantiere",
  LAVORAZIONI_ATTIVE:
    "Lavorazioni attive",
  PERCENTUALE: "Percentuale",
  STATO: "Stato",
  NESSUNA_LAVORAZIONE:
    "Nessuna lavorazione attiva per questo cantiere",
  STATI: {
    NON_INIZIATA: "Non iniziata",
    IN_CORSO: "In corso",
    COMPLETATA: "Completata",
  },
  ERRORI: {
    GENERICO: "Errore caricamento SAL",
  },
} as const;
