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
  TITOLO: "Freeze SAL mensili",
  CARD_DESCRIZIONE:
    "Storico chiusure mensili SAL",
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
  CREA_FREEZE: "Crea freeze",
  ANNULLA_FREEZE: "Annulla freeze",
  ESPORTA_PDF: "Esporta PDF",
  ESPORTA_EXCEL: "Esporta Excel",
  ESPORTA: "Esporta",
  CREA_FREEZE_CTA: "Crea freeze mensile",
  LISTA_FREEZE: "Freeze esistenti",
  DETTAGLIO_FREEZE: "Dettaglio freeze",
  LAVORAZIONI: "Lavorazioni",
  PERCENTUALE_PRECEDENTE: "Percentuale precedente",
  PERCENTUALE_ATTUALE: "Percentuale attuale",
  DELTA_PERCENTUALE: "Delta percentuale",
  ORE_UOMO: "Ore uomo",
  FOTO_SELEZIONATE_TITOLO:
    "Foto selezionate nel freeze",
  MACCHINARI: "Macchinari",
  NESSUN_CANTIERE:
    "Nessun cantiere disponibile",
  NESSUNA_FOTO:
    "Nessuna foto disponibile",
  NESSUN_FREEZE:
    "Nessun freeze disponibile",
  NESSUN_DETTAGLIO:
    "Seleziona un freeze per vedere il dettaglio",
  NESSUN_DATO:
    "Nessun dato disponibile",
  SOLO_ADMIN_CREA:
    "Solo ADMIN puo creare freeze mensili",
  SOLO_ADMIN_CREA_BUTTON:
    "Crea freeze",
  MESSAGGI: {
    FREEZE_CREATO: "Freeze mensile creato",
    FREEZE_ANNULLATO: "Freeze annullato",
    DATI_AGGIORNATI: "Dati freeze aggiornati",
  },
  PDF: {
    TITOLO: "Freeze SAL",
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
    GENERICO: "Errore caricamento freeze SAL",
    INPUT_NON_VALIDO: "Input non valido",
    ACCESSO_NEGATO: "Accesso non autorizzato",
    FREEZE_NON_TROVATO: "Freeze SAL non trovato",
    FREEZE_ESISTENTE:
      "Freeze SAL gia esistente per il periodo selezionato",
    NESSUNA_LAVORAZIONE:
      "Nessuna lavorazione SAL trovata per il cantiere selezionato",
    FOTO_NON_VALIDA:
      "Una o piu foto selezionate non sono valide",
  },
} as const;
