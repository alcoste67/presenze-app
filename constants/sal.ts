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
  ORE_UOMO_TOTALI: "Ore uomo totali",
  LAVORAZIONI_ATTIVE:
    "Lavorazioni attive",
  ESPORTA_PDF: "Esporta PDF SAL",
  PERCENTUALE: "Percentuale",
  ORE_UOMO: "Ore uomo",
  UNITA_ORA: "h",
  UNITA_MINUTO: "m",
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

export const SAL_PDF = {
  CONTENT_TYPE: "application/pdf",
  FILE_PREFIX: "SAL",
  LOGO_PATH: "public/a2c-logo.png",
  LOCALE: "it-IT",
  TESTI: {
    TITOLO: "Stato avanzamento lavori",
    SOTTOTITOLO:
      "Report SAL cantiere",
    DATA_GENERAZIONE:
      "Data generazione",
    CANTIERE: "Cantiere",
    AVANZAMENTO_TOTALE:
      "Avanzamento totale",
    ORE_UOMO_TOTALI: "Ore uomo totali",
    LAVORAZIONI: "Lavorazioni",
    LAVORAZIONE: "Lavorazione",
    PERCENTUALE:
      "Percentuale completamento",
    STATO: "Stato",
    ORE_UOMO: "Ore uomo",
    PAGINA: "Pagina",
    DI: "di",
  },
  ERRORI: {
    CANTIERE_OBBLIGATORIO:
      "Cantiere obbligatorio",
    CANTIERE_NON_TROVATO:
      "Cantiere non trovato",
    GENERICO:
      "Errore generazione PDF SAL",
  },
} as const;
