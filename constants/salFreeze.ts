export const SAL_FREEZE_STORAGE_BUCKET =
  "sal-freeze";

export const SAL_FREEZE_EXPORT_FILE_PREFIX =
  "freeze-sal";

export const SAL_FREEZE_EXPORT = {
  PDF: {
    FILE_PREFIX: SAL_FREEZE_EXPORT_FILE_PREFIX,
    MIME_TYPE: "application/pdf",
    DEFAULT_FILENAME: `${SAL_FREEZE_EXPORT_FILE_PREFIX}.pdf`,
    MAX_FOTO: 6,
  },
  EXCEL: {
    FILE_PREFIX: SAL_FREEZE_EXPORT_FILE_PREFIX,
    MIME_TYPE:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    DEFAULT_FILENAME: `${SAL_FREEZE_EXPORT_FILE_PREFIX}.xlsx`,
    MAX_FOTO: 6,
  },
  QUERY: {
    FREEZE_ID: "freezeId",
    CANTIERE_NOME: "cantiereNome",
  },
} as const;

export const SAL_FREEZE_TESTI = {
  TITOLO: "SAL periodo",
  CARD_DESCRIZIONE:
    "Storico SAL periodo e export committente",
  BACKOFFICE: "Back-office",
  CANTIERE: "Cantiere",
  PERIODO_MESE: "Periodo mese",
  DATA_INIZIO: "Data inizio",
  DATA_FINE: "Data fine",
  FOTO_RECENTI: "Foto SAL recenti",
  FOTO_SELEZIONATE: "Foto selezionate",
  ANTEPRIMA_FOTO_SELEZIONATE:
    "Anteprima foto selezionate",
  NOTE: "Note",
  CREA_FREEZE: "Crea SAL periodo",
  ANNULLA_FREEZE: "Annulla SAL periodo",
  ESPORTA_PDF: "Esporta PDF",
  ESPORTA_EXCEL: "Esporta Excel",
  ESPORTA: "Esporta",
  CREA_FREEZE_CTA: "Crea SAL periodo mensile",
  LISTA_FREEZE: "Storico SAL periodo",
  DETTAGLIO_FREEZE: "Dettaglio SAL periodo",
  LAVORAZIONI: "Lavorazioni",
  PERCENTUALE_PRECEDENTE: "Percentuale precedente",
  PERCENTUALE_ATTUALE: "Percentuale attuale",
  DELTA_PERCENTUALE: "Delta percentuale",
  ORE_UOMO: "Ore uomo",
  FOTO_SELEZIONATE_TITOLO:
    "Foto selezionate nel SAL periodo",
  MACCHINARI: "Macchinari",
  NESSUN_CANTIERE:
    "Nessun cantiere disponibile",
  NESSUNA_FOTO:
    "Nessuna foto disponibile",
  NESSUN_FREEZE:
    "Nessun SAL periodo disponibile",
  NESSUN_DETTAGLIO:
    "Seleziona un SAL periodo per vedere il dettaglio",
  NESSUN_DATO:
    "Nessun dato disponibile",
  SOLO_ADMIN_CREA:
    "Solo ADMIN puo creare SAL periodo",
  SOLO_ADMIN_CREA_BUTTON:
    "Crea SAL periodo",
  MESSAGGI: {
    FREEZE_CREATO: "SAL periodo creato",
    FREEZE_ANNULLATO: "SAL periodo annullato",
    DATI_AGGIORNATI: "Dati SAL periodo aggiornati",
  },
  PDF: {
    TITOLO: "SAL periodo",
    SOTTOTITOLO: "Export committente",
    CANTIERE: "Cantiere",
    PERIODO: "Periodo",
    DATA_FREEZE: "Data freeze",
    LAVORAZIONI: "Lavorazioni",
    FOTO_SELEZIONATE: "Foto selezionate",
    LAVORAZIONE: "Lavorazione",
    PERCENTUALE_PRECEDENTE: "Percentuale precedente",
    PERCENTUALE_ATTUALE: "Percentuale attuale",
    DELTA_PERIODO: "Delta periodo",
    MASSIMO_FOTO: `Nel PDF vengono incluse al massimo ${SAL_FREEZE_EXPORT.PDF.MAX_FOTO} foto selezionate`,
    PAGINA: "Pagina",
    DI: "di",
    PREVIEW_NON_DISPONIBILE:
      "Preview non disponibile",
  },
  EXCEL: {
    FOGLIO_SAL: "SAL",
    FOGLIO_FOTO: "Foto selezionate",
    MASSIMO_FOTO: `Nel foglio foto sono incluse al massimo ${SAL_FREEZE_EXPORT.EXCEL.MAX_FOTO} foto selezionate`,
  },
  ERRORI: {
    GENERICO: "Errore caricamento SAL periodo",
    INPUT_NON_VALIDO: "Input non valido",
    ACCESSO_NEGATO: "Accesso non autorizzato",
    FREEZE_NON_TROVATO: "SAL periodo non trovato",
    FREEZE_ESISTENTE:
      "SAL periodo gia esistente per il periodo selezionato",
    NESSUNA_LAVORAZIONE:
      "Nessuna lavorazione SAL trovata per il cantiere selezionato",
    FOTO_NON_VALIDA:
      "Una o piu foto selezionate non sono valide",
  },
} as const;
