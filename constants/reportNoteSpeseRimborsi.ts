export const REPORT_NOTE_SPESE_RIMBORSI_PDF = {
  CONTENT_TYPE: "application/pdf",
  FILE_PREFIX: "note-spese-rimborsi",
  LOCALE: "it-IT",
  TESTI: {
    TITOLO: "Note spese e rimborsi chilometrici",
    SOTTOTITOLO_PREFIX: "Mese",
    SEZIONE_NOTE_SPESE: "Note spese approvate",
    SEZIONE_RIMBORSO_KM: "Rimborso chilometrico",
    COLONNA_DATA: "Data",
    COLONNA_TIPO: "Tipo",
    COLONNA_IMPORTO: "Importo",
    COLONNA_DESCRIZIONE: "Descrizione",
    NESSUNA_NOTA_SPESA: "Nessuna nota spesa approvata nel mese",
    TOTALE_NOTE_SPESE: "Totale note spese",
    VEICOLO: "Veicolo",
    KM_TOTALI: "Km totali",
    TARIFFA: "Tariffa",
    RIMBORSO: "Rimborso km",
    TARIFFA_NON_IMPOSTATA: "Tariffa non impostata",
    TOTALE_DIPENDENTE: "Totale dovuto",
    NESSUN_DIPENDENTE: "Nessuna nota spesa o rimborso km nel mese selezionato",
    PAGINA: "Pagina",
    DI: "di",
  },
  ERRORI: {
    PDF_GENERICO: "Errore generazione PDF note spese e rimborsi",
  },
} as const;

export const REPORT_NOTE_SPESE_RIMBORSI_TESTI = {
  ERRORI: {
    SESSIONE_MANCANTE: "Sessione utente non valida",
    TOKEN_MANCANTE: "Token autenticazione mancante",
    TOKEN_NON_VALIDO: "Token autenticazione non valido",
    ACCESSO_NEGATO: "Accesso non autorizzato",
    MESE_OBBLIGATORIO: "Seleziona un mese",
    GENERICO: "Errore generazione report",
  },
} as const;
