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
} as const;

export const TIMBRATURE_TESTI = {
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
  },
} as const;
