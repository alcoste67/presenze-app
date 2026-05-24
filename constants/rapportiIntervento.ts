export const RAPPORTI_INTERVENTO_STATI = {
  BOZZA: "BOZZA",
  FIRMATO: "FIRMATO",
  ANNULLATO: "ANNULLATO",
} as const;

export const RAPPORTI_INTERVENTO_REGOLE = {
  MEZZA_GIORNATA: "MEZZA_GIORNATA",
  GIORNATA: "GIORNATA",
  ORE_REALI: "ORE_REALI",
} as const;

export const RAPPORTI_INTERVENTO_LIMITI = {
  MEZZA_GIORNATA_MINUTI: 4 * 60,
  GIORNATA_MINUTI: 8 * 60,
  FIRMA_MAX_DATA_URL_CARATTERI: 120000,
} as const;

export const RAPPORTI_INTERVENTO_TIME_ZONE =
  "Europe/Rome";

export const RAPPORTI_INTERVENTO_PDF = {
  CONTENT_TYPE: "application/pdf",
  FILE_PREFIX: "Rapporto_Intervento",
  LOGO_PATH: "public/a2c-logo.png",
  LOCALE: "it-IT",
} as const;

export const LABEL_STATI_RAPPORTO_INTERVENTO: Record<
  (typeof RAPPORTI_INTERVENTO_STATI)[keyof typeof RAPPORTI_INTERVENTO_STATI],
  string
> = {
  [RAPPORTI_INTERVENTO_STATI.BOZZA]: "Bozza",
  [RAPPORTI_INTERVENTO_STATI.FIRMATO]:
    "Firmato",
  [RAPPORTI_INTERVENTO_STATI.ANNULLATO]:
    "Annullato",
};

export const LABEL_REGOLE_FATTURAZIONE_INTERVENTO: Record<
  (typeof RAPPORTI_INTERVENTO_REGOLE)[keyof typeof RAPPORTI_INTERVENTO_REGOLE],
  string
> = {
  [RAPPORTI_INTERVENTO_REGOLE.MEZZA_GIORNATA]:
    "Mezza giornata",
  [RAPPORTI_INTERVENTO_REGOLE.GIORNATA]:
    "Giornata",
  [RAPPORTI_INTERVENTO_REGOLE.ORE_REALI]:
    "Ore reali",
};

export const RAPPORTI_INTERVENTO_TESTI = {
  TITOLO: "Rapporti intervento",
  CARD_DESCRIZIONE:
    "Rapporti operativi firmati da responsabile e cliente",
  BACKOFFICE: "Back-office",
  TIMBRATURE: "Timbrature",
  LISTA: "Lista rapporti",
  NUOVO: "Nuovo rapporto",
  MODIFICA: "Modifica rapporto",
  FIRMA: "Firma rapporto",
  VISUALIZZA: "Visualizza",
  CANTIERE: "Cantiere",
  SELEZIONA_CANTIERE:
    "Seleziona un cantiere",
  NESSUN_CANTIERE:
    "Nessun cantiere disponibile",
  DATA_INTERVENTO: "Data intervento",
  CLIENTE_COMMITTENTE:
    "Cliente / committente",
  RESPONSABILE_NOME:
    "Responsabile lavori",
  VIAGGIO_MINUTI:
    "Viaggio minuti uomo",
  DIRITTO_USCITA: "Diritto uscita",
  NOTE: "Note",
  LAVORAZIONI: "Lavorazioni svolte",
  DESCRIZIONE: "Descrizione",
  ORE_UOMO_MINUTI:
    "Ore uomo minuti",
  ORE_UOMO_REALI:
    "Ore uomo reali",
  ORE_FATTURABILI:
    "Ore fatturabili",
  UNITA_ORA: "h",
  UNITA_MINUTO: "m",
  REGOLA_FATTURAZIONE:
    "Regola fatturazione",
  STATO: "Stato",
  FIRMA_RESPONSABILE:
    "Firma responsabile",
  FIRMA_CLIENTE: "Firma cliente",
  NOME_FIRMA_RESPONSABILE:
    "Nome firma responsabile",
  NOME_FIRMA_CLIENTE:
    "Nome firma cliente",
  CANCELLA_FIRMA: "Cancella firma",
  AGGIUNGI_LAVORAZIONE:
    "Aggiungi lavorazione",
  RIMUOVI: "Rimuovi",
  SALVA: "Salva",
  SALVATAGGIO: "Salvataggio...",
  ANNULLA: "Annulla",
  CARICAMENTO: "Caricamento...",
  CARICA_SNAPSHOT:
    "Carica lavorazioni",
  GENERA_PDF: "Genera PDF",
  CREATO_IL: "Creato il",
  SI: "Si",
  NO: "No",
  NESSUN_RAPPORTO:
    "Nessun rapporto intervento",
  NESSUNA_LAVORAZIONE:
    "Nessuna lavorazione per questo rapporto",
  PDF_NOME_DEFAULT:
    "rapporto-intervento.pdf",
  ERRORI: {
    GENERICO:
      "Errore gestione rapporti intervento",
    CANTIERE_OBBLIGATORIO:
      "Seleziona un cantiere",
    DATA_OBBLIGATORIA:
      "Inserisci la data intervento",
    CLIENTE_OBBLIGATORIO:
      "Inserisci cliente o committente",
    RESPONSABILE_OBBLIGATORIO:
      "Inserisci il responsabile lavori",
    VIAGGIO_NON_VALIDO:
      "Viaggio minuti uomo non valido",
    ORE_NON_VALIDE:
      "Ore uomo minuti non valide",
    LAVORAZIONE_OBBLIGATORIA:
      "Inserisci almeno una lavorazione",
    DESCRIZIONE_OBBLIGATORIA:
      "Inserisci la descrizione lavorazione",
    FIRMA_TROPPO_GRANDE:
      "Firma troppo grande",
    RAPPORTO_NON_TROVATO:
      "Rapporto intervento non trovato",
    RAPPORTO_FIRMATO:
      "Rapporto firmato non modificabile",
    SESSIONE_MANCANTE:
      "Sessione utente non valida",
    TOKEN_MANCANTE:
      "Token autenticazione mancante",
    TOKEN_NON_VALIDO:
      "Token autenticazione non valido",
    ACCESSO_NEGATO:
      "Accesso non autorizzato",
    RISPOSTA_NON_VALIDA:
      "Risposta rapporti intervento non valida",
    CANTIERE_NON_TROVATO:
      "Cantiere non trovato",
    PDF_GENERICO:
      "Errore generazione PDF rapporto intervento",
  },
  MESSAGGI: {
    CREATO: "Rapporto creato",
    AGGIORNATO: "Rapporto aggiornato",
    SNAPSHOT_CARICATO:
      "Lavorazioni caricate",
  },
  PDF: {
    TITOLO: "Rapporto intervento",
    SOTTOTITOLO:
      "Rapporto operativo firmato",
    CANTIERE: "Cantiere",
    INDIRIZZO: "Indirizzo",
    DATA_INTERVENTO: "Data intervento",
    CLIENTE_COMMITTENTE:
      "Cliente / committente",
    RESPONSABILE: "Responsabile lavori",
    LAVORAZIONI: "Lavorazioni svolte",
    LAVORAZIONE: "Lavorazione",
    ORE_UOMO: "Ore uomo",
    VIAGGIO: "Viaggio",
    DIRITTO_USCITA: "Diritto uscita",
    ORE_FATTURABILI:
      "Totale ore fatturabili",
    NOTE: "Note",
    FIRMA_RESPONSABILE:
      "Firma responsabile",
    FIRMA_CLIENTE: "Firma cliente",
    DATA_FIRMA: "Data firma",
    PAGINA: "Pagina",
    DI: "di",
  },
} as const;
