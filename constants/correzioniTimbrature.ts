export const CORREZIONI_TIMBRATURE = {
  SOGLIA_ORA_ENTRATA: 8,
  SOGLIA_ORA_USCITA: 17,
  // In minuti dalla mezzanotte (ora Italia): 12:45 e 13:45
  SOGLIA_MINUTI_PAUSA: 12 * 60 + 45,
  SOGLIA_MINUTI_RIENTRO: 13 * 60 + 45,
} as const;

export const CORREZIONI_TIMBRATURE_TESTI = {
  PUSH: {
    ENTRATA_TITOLO: "Ti sei ricordato di timbrare?",
    ENTRATA_CORPO: "Non risulta ancora un'entrata registrata oggi.",
    USCITA_TITOLO: "Ti sei ricordato di timbrare l'uscita?",
    USCITA_CORPO: "Non risulta ancora un'uscita registrata oggi.",
    PAUSA_TITOLO: "Ti sei ricordato di timbrare la pausa?",
    PAUSA_CORPO: "Non risulta ancora una pausa pranzo registrata oggi.",
    RIENTRO_TITOLO: "Ti sei ricordato di timbrare il rientro?",
    RIENTRO_CORPO: "Non risulta ancora un rientro dalla pausa registrato oggi.",
  },
  BANNER: {
    ENTRATA_TITOLO: "Non risulta ancora un'entrata oggi",
    ENTRATA_DESCRIZIONE: "Se te la sei dimenticata, indica l'orario reale.",
    USCITA_TITOLO: "Non risulta ancora un'uscita oggi",
    USCITA_DESCRIZIONE: "Se te la sei dimenticata, indica l'orario reale.",
    ETICHETTA_ORARIO: "Orario effettivo",
    CONFERMA: "Registra",
  },
  ERRORI: {
    GENERICO: "Correzione non riuscita",
    FUORI_FINESTRA: "Correzione non disponibile in questo momento",
    ORARIO_OBBLIGATORIO: "Inserisci l'orario",
    ORARIO_FUTURO: "L'orario indicato non può essere nel futuro",
    ORARIO_PRECEDENTE:
      "L'orario indicato deve essere successivo all'ultima timbratura di oggi",
    IN_FERIE_O_PERMESSO:
      "Oggi risulti in ferie/permesso: la timbratura non è disponibile",
  },
  MESSAGGI: {
    REGISTRATA: "Timbratura registrata",
  },
} as const;
