export const BLOCCO_GIORNO_PRECEDENTE_TESTI = {
  TURNO_APERTO: {
    TITOLO: "Devi chiudere il turno di ieri",
    DESCRIZIONE_PREFIX: "Risulta ancora aperto dalle",
    DESCRIZIONE_SUFFIX:
      "indica l'orario reale in cui hai finito per poter timbrare di nuovo.",
    ETICHETTA_ORARIO: "Orario di uscita",
    CONFERMA: "Chiudi il turno",
    CHIUSO: "Turno chiuso, puoi timbrare",
  },
  GIORNATA_VUOTA: {
    TITOLO: "Giustifica la giornata di ieri",
    DESCRIZIONE_PREFIX: "Non risultano timbrature per il",
    DESCRIZIONE_SUFFIX:
      "indica il motivo per poter timbrare di nuovo.",
    ETICHETTA_NOTA: "Nota (facoltativa)",
    CONFERMA: "Invia giustificazione",
    INVIATA: "Giustificazione inviata, puoi timbrare",
  },
  ERRORI: {
    GENERICO: "Errore imprevisto",
    NON_AUTORIZZATO: "Non sei autorizzato a questa operazione",
    ORARIO_OBBLIGATORIO: "Indica l'orario di uscita",
    ORARIO_FUTURO: "L'orario non può essere nel futuro",
    ORARIO_PRECEDENTE_ENTRATA:
      "L'orario di uscita deve essere dopo l'entrata del turno",
    TURNO_GIA_CHIUSO: "Il turno risulta già chiuso",
    TURNO_DI_OGGI: "Questo turno è di oggi, usa i pulsanti normali",
  },
} as const;
