export const ANOMALIE_TIMBRATURE = {
  SOGLIA_ORE_TURNO_APERTO: 10,
} as const;

export const ANOMALIE_TIMBRATURE_TESTI = {
  PUSH_DIPENDENTE: {
    TITOLO: "Turno ancora aperto",
    CORPO:
      "Sono passate più di 10 ore dalla tua entrata: hai dimenticato di timbrare l'uscita?",
  },
  PAGINA_CORREZIONE: {
    TITOLO: "Correggi turno aperto",
    CARICAMENTO: "Caricamento...",
    APERTO_DALLE: "Turno aperto dalle",
    ORE_NETTE: "ore nette lavorate finora",
    ETICHETTA_DATA: "Data uscita",
    ETICHETTA_ORARIO: "Orario uscita",
    CONFERMA: "Invia proposta al dipendente",
    PROPOSTA_INVIATA:
      "Proposta inviata: il dipendente riceverà una mail per confermarla",
    GIA_IN_ATTESA_PREFIX: "C'è già una proposta in attesa di conferma, inviata il",
    NESSUN_TURNO_APERTO: "Questo dipendente non ha turni aperti da correggere",
  },
  PAGINA_CONFERMA: {
    TITOLO: "Conferma orario di uscita",
    CARICAMENTO: "Caricamento...",
    DESCRIZIONE:
      "Il tuo responsabile propone questo orario di uscita per il turno che risulta ancora aperto:",
    CONFERMA: "Confermo, è corretto",
    RIFIUTA: "Non è corretto",
    ETICHETTA_NOTA: "Spiega cosa non va (facoltativo)",
    INVIA_RIFIUTO: "Invia segnalazione",
    ANNULLA: "Annulla",
    ESITO_CONFERMATO: "Grazie, l'orario è stato registrato",
    ESITO_RIFIUTATO: "Segnalazione inviata al tuo responsabile",
    GIA_GESTITA: "Questa proposta è già stata gestita",
  },
  ERRORI: {
    GENERICO: "Errore imprevisto",
    NON_AUTORIZZATO: "Non sei autorizzato a questa operazione",
    PROPOSTA_NON_TROVATA: "Proposta non trovata",
    DIPENDENTE_NON_TROVATO: "Dipendente non trovato",
    DATA_ORARIO_OBBLIGATORI: "Data e orario sono obbligatori",
    ORARIO_FUTURO: "L'orario non può essere nel futuro",
    ORARIO_PRECEDENTE_ENTRATA: "L'orario di uscita deve essere dopo l'entrata del turno",
    PROPOSTA_GIA_IN_ATTESA: "Esiste già una proposta in attesa per questo dipendente",
    TURNO_GIA_CHIUSO: "Il turno risulta già chiuso: nessuna correzione necessaria",
    NOTA_OBBLIGATORIA_RIFIUTO: "Spiega brevemente perché l'orario non è corretto",
  },
} as const;
