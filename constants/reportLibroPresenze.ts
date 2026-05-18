export const REPORT_LIBRO_PRESENZE_LIMITI = {
  MAX_GIORNI: 31,
  MAX_RIGHE: 1000,
  MAX_TIMBRATURE: 10000,
} as const;

export const REPORT_LIBRO_PRESENZE_TIME_ZONE =
  "Europe/Rome";

export const REPORT_LIBRO_PRESENZE_CSV = {
  SEPARATORE: ";",
  BOM: "\uFEFF",
  INJECTION_PREFIX: "'",
  NOME_FILE_PREFIX: "libro-presenze",
  MIME_TYPE: "text/csv;charset=utf-8",
} as const;

export const REPORT_LIBRO_PRESENZE_COLONNE = [
  "Giorno",
  "Dipendente",
  "Email",
  "Entrata",
  "Uscita",
  "Totale ore reali",
  "Ore paghe",
  "Cantiere/Attività",
  "Note",
] as const;

export const REPORT_LIBRO_PRESENZE_TESTI = {
  TITOLO: "Libro presenze",
  CARD_DESCRIZIONE:
    "Report giornaliero aggregato per paghe",
  SOTTOTITOLO:
    "Una riga per dipendente per giorno",
  BACKOFFICE: "Back-office",
  TIMBRATURE: "Timbrature",
  FILTRI: "Filtri",
  DATA_INIZIO: "Data inizio",
  DATA_FINE: "Data fine",
  DIPENDENTE: "Dipendente",
  CANTIERE: "Cantiere",
  TUTTI_DIPENDENTI: "Tutti i dipendenti",
  TUTTI_CANTIERI: "Tutti i cantieri",
  CERCA: "Cerca",
  CARICAMENTO: "Caricamento...",
  ESPORTA_CSV: "Esporta CSV",
  STAMPA_PDF: "Stampa / Salva PDF",
  ANTEPRIMA: "Anteprima",
  RIGHE: "righe",
  LIMITE_EXPORT_PREFIX: "Massimo",
  LIMITE_EXPORT_GIORNI_E: "giorni e",
  LIMITE_EXPORT_RIGHE_SUFFIX:
    "righe aggregate per export.",
  NESSUN_RISULTATO:
    "Nessuna presenza trovata",
  NESSUNA_RICERCA:
    "Imposta i filtri e genera l'anteprima",
  LIMITE_RAGGIUNTO:
    "Anteprima limitata alle prime righe disponibili",
  DIPENDENTE_NON_DISPONIBILE:
    "Dipendente non disponibile",
  DESTINAZIONE_NON_DISPONIBILE:
    "Destinazione non disponibile",
  CANTIERE_NON_DISPONIBILE: "",
  ATTIVITA_NON_DISPONIBILE: "",
  EMAIL_NON_DISPONIBILE: "",
  ENTRATA_NON_DISPONIBILE: "",
  USCITA_NON_DISPONIBILE: "",
  NOTE_SEQUENZA_INCOMPLETA:
    "Sequenza timbrature incompleta",
  NOTE_GIORNATA_APERTA: "Giornata aperta",
  ERRORI: {
    SESSIONE_MANCANTE:
      "Sessione utente non valida",
    RISPOSTA_NON_VALIDA:
      "Risposta libro presenze non valida",
    GENERICO:
      "Errore caricamento libro presenze",
    FILTRI_NON_VALIDI:
      "Filtri libro presenze non validi",
    DATE_OBBLIGATORIE:
      "Data inizio e data fine sono obbligatorie",
    INTERVALLO_NON_VALIDO:
      "Intervallo date non valido",
    INTERVALLO_MASSIMO_PREFIX:
      "Intervallo massimo",
    INTERVALLO_MASSIMO_SUFFIX: "giorni",
    TOKEN_MANCANTE:
      "Token autenticazione mancante",
    TOKEN_NON_VALIDO:
      "Token autenticazione non valido",
    ACCESSO_NEGATO: "Accesso non autorizzato",
  },
} as const;
