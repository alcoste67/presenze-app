export const RAPPORTI_INTERVENTO_STATI = {
  BOZZA: "BOZZA",
  FIRMATO: "FIRMATO",
  INVIATO: "INVIATO",
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
  FOTO_MAX_DATA_URL_CARATTERI: 6000000,
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
  [RAPPORTI_INTERVENTO_STATI.INVIATO]:
    "Inviato",
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
  OPERATORI: "Operatori presenti",
  AGGIUNGI_OPERATORE:
    "Aggiungi operatore",
  OPERATORE: "Operatore",
  SELEZIONA_OPERATORE:
    "Cerca e seleziona operatore",
  NESSUN_OPERATORE_TROVATO:
    "Nessun operatore trovato",
  NESSUN_OPERATORE:
    "Nessun operatore inserito",
  ORE_OPERATORE: "Ore",
  LAVORAZIONI: "Lavorazioni svolte",
  DESCRIZIONE: "Descrizione",
  ORE_UOMO_MINUTI:
    "Ore uomo",
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
  FOTO: "Foto rapporto",
  AGGIUNGI_FOTO: "Aggiungi foto",
  NESSUNA_FOTO_SELEZIONATA:
    "Nessuna foto selezionata",
  DESCRIZIONE_FOTO:
    "Descrizione foto",
  SALVA_RAPPORTO: "Salva rapporto",
  ORA_ARRIVO: "Ora di arrivo",
  ORA_PARTENZA: "Ora di partenza",
  NUOVO_CANTIERE: "Nuovo cantiere",
  NOME_CANTIERE_PLACEHOLDER: "Nome cantiere",
  INDIRIZZO_CANTIERE_PLACEHOLDER:
    "Indirizzo (facoltativo)",
  CREA_CANTIERE: "Crea",
  SUFFISSO_DA_VERIFICARE: "(da verificare)",
  INVIA: "Invia",
  INVIA_AL_CLIENTE: "Invia al cliente",
  PROPOSTA_INVIO_POST_FIRMA:
    "Il rapporto è firmato e non è più modificabile. Vuoi inviarlo subito via email al cliente?",
  INVIA_ORA: "Invia ora",
  EMAIL_CLIENTE_TITOLO: "Email del cliente",
  EMAIL_CLIENTE_DESCRIZIONE:
    "Per inviare il rapporto serve l'email di",
  EMAIL_CLIENTE_CONFERMA: "Salva e prosegui",
  INVIO_CONFERMA:
    "Il PDF firmato verrà inviato via email a",
  INVIO_CONFERMA_CC:
    "In copia: amministrazione e compilatore. Dopo l'invio il rapporto non sarà più modificabile né rinviabile.",
  LAVORI_EXTRA: "Lavori extra",
  AGGIUNGI_LAVORO_EXTRA: "Lavoro extra",
  NESSUN_LAVORO_EXTRA:
    "Nessun lavoro extra registrato",
  ORE_EXTRA: "Ore",
  MATERIALI: "Materiali utilizzati",
  AGGIUNGI_MATERIALE:
    "Aggiungi materiale",
  QUANTITA: "Quantita",
  UNITA_MISURA: "Unita",
  NOME_FIRMA_RESPONSABILE:
    "Nome firma responsabile",
  NOME_FIRMA_CLIENTE:
    "Nome firma cliente",
  CANCELLA_FIRMA: "Cancella firma",
  CLIENTE_PLACEHOLDER:
    "Cerca o crea un cliente...",
  FIRMA_PAGINA_TITOLO: "Firma rapporto",
  FIRMA_RIEPILOGO: "Riepilogo rapporto",
  FIRMA_AVVISO:
    "Stai per firmare questo rapporto: dopo la conferma non potrà più essere modificato.",
  CONFERMA_FIRMA: "Conferma firma",
  FIRMA_IN_CORSO: "Firma in corso...",
  FIRMA_CONFERMATA: "Rapporto firmato",
  VAI_ALLA_FIRMA: "Firma rapporto",
  RAPPORTO_NON_FIRMABILE:
    "Il rapporto non è in bozza e non può essere firmato",
  FIRMA_DISPONIBILE_DOPO_SALVATAGGIO:
    "Salva il rapporto come bozza: la firma avviene da pagina dedicata.",
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
  NESSUNA_FOTO:
    "Nessuna foto allegata",
  NESSUN_MATERIALE:
    "Nessun materiale inserito",
  PDF_NOME_DEFAULT:
    "rapporto-intervento.pdf",
  ERRORI: {
    GENERICO:
      "Errore gestione rapporti intervento",
    CANTIERE_OBBLIGATORIO:
      "Seleziona un cantiere",
    NOME_CANTIERE_OBBLIGATORIO:
      "Inserisci il nome del cantiere",
    DATA_OBBLIGATORIA:
      "Inserisci la data intervento",
    CLIENTE_OBBLIGATORIO:
      "Inserisci cliente o committente",
    RESPONSABILE_OBBLIGATORIO:
      "Inserisci il responsabile lavori",
    VIAGGIO_NON_VALIDO:
      "Viaggio minuti uomo non valido",
    ORE_NON_VALIDE:
      "Ore uomo non valide",
    FORMATO_ORE_NON_VALIDO:
      "Formato ore non valido",
    LAVORAZIONE_OBBLIGATORIA:
      "Inserisci almeno una lavorazione",
    OPERATORE_OBBLIGATORIO:
      "Inserisci almeno un operatore presente",
    OPERATORE_NON_VALIDO:
      "Seleziona un operatore valido",
    OPERATORE_DUPLICATO:
      "Operatore gia inserito",
    ORE_OPERATORE_NON_VALIDE:
      "Ore operatore non valide",
    DESCRIZIONE_OBBLIGATORIA:
      "Inserisci la descrizione lavorazione",
    FIRMA_TROPPO_GRANDE:
      "Firma troppo grande",
    FIRME_OBBLIGATORIE:
      "Inserisci entrambe le firme prima di confermare",
    FOTO_NON_VALIDA:
      "Foto non valida",
    FOTO_TROPPO_GRANDE:
      "Foto troppo grande",
    MATERIALE_DESCRIZIONE_OBBLIGATORIA:
      "Inserisci la descrizione materiale",
    EXTRA_DESCRIZIONE_OBBLIGATORIA:
      "Inserisci la descrizione del lavoro extra",
    MATERIALE_QUANTITA_NON_VALIDA:
      "Quantita materiale non valida",
    MATERIALE_UNITA_OBBLIGATORIA:
      "Inserisci l'unita di misura",
    RAPPORTO_NON_TROVATO:
      "Rapporto intervento non trovato",
    RAPPORTO_FIRMATO:
      "Rapporto firmato non modificabile",
    INVIO_SOLO_FIRMATO:
      "Si possono inviare solo rapporti firmati",
    CLIENTE_SENZA_EMAIL:
      "Il cliente non ha un'email in anagrafica: inseriscila prima dell'invio",
    PDF_TROPPO_GRANDE:
      "PDF troppo pesante per l'invio email (oltre 5 MB)",
    INVIO_NON_CONFIGURATO:
      "Invio email non configurato (RESEND_API_KEY mancante)",
    INVIO_FALLITO:
      "Invio non riuscito: il rapporto resta firmato, riprova",
    INVIO_SENZA_CLIENTE:
      "Il rapporto non ha un cliente di anagrafica collegato: impossibile inviarlo",
    EMAIL_NON_VALIDA:
      "Inserisci un indirizzo email valido",
    EMAIL_GIA_USATA:
      "Email già usata da un altro cliente",
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
    CLIENTE_CREATO: "Cliente creato",
    CANTIERE_PROPOSTO:
      "Cantiere creato: in attesa di verifica dell'amministratore",
    INVIATO: "Rapporto inviato a",
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
    OPERATORI: "Operatori presenti",
    OPERATORE: "Nome",
    LAVORAZIONI: "Lavorazioni svolte",
    LAVORAZIONE: "Lavorazione",
    ORE_UOMO: "Ore uomo",
    TOTALE_ORE_UOMO:
      "Totale ore uomo",
    MATERIALI: "Materiali utilizzati",
    MATERIALE: "Materiale",
    LAVORI_EXTRA: "Lavori extra",
    LAVORO_EXTRA: "Lavoro extra",
    ORE_EXTRA: "Ore",
    QUANTITA: "Quantita",
    FOTO: "Foto rapporto",
    FOTO_DESCRIZIONE: "Foto",
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
