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
  AZIONI: {
    SALVATAGGIO: "Salvataggio...",
    ENTRATA: "TIMBRA ENTRATA",
    PAUSA: "INIZIA PAUSA",
    RIENTRO: "FINE PAUSA",
    USCITA: "TIMBRA USCITA",
    CAMBIO_CANTIERE: "Cambia cantiere",
  },
  MESSAGGI: {
    REGISTRATA_PREFIX: "Timbratura",
    REGISTRATA_SUFFIX: "registrata",
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
