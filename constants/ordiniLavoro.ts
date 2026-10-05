export const ORDINI_LAVORO_STATI = {
  BOZZA: "BOZZA",
  FIRMATO: "FIRMATO",
  INVIATO: "INVIATO",
} as const;

export const LABEL_STATI_ORDINI_LAVORO: Record<
  (typeof ORDINI_LAVORO_STATI)[keyof typeof ORDINI_LAVORO_STATI],
  string
> = {
  [ORDINI_LAVORO_STATI.BOZZA]: "Bozza",
  [ORDINI_LAVORO_STATI.FIRMATO]: "Firmato",
  [ORDINI_LAVORO_STATI.INVIATO]: "Inviato",
};

export const ORDINI_LAVORO_LIMITI = {
  FIRMA_MAX_DATA_URL_CARATTERI: 120000,
  ELENCO_INTERVENTI_MAX_RIGHE: 4,
} as const;

export const ORDINI_LAVORO_TESTI = {
  TITOLO: "Ordine di Lavoro",
  CARD_DESCRIZIONE: "Ordine di lavoro Edison, firmato da tecnico e cliente",
  BACKOFFICE: "Back-office",
  LISTA: "Elenco ordini di lavoro",
  NUOVO: "Nuovo ordine di lavoro",
  FIRMA_PAGINA_TITOLO: "Firma ordine di lavoro",

  RECUPERA_DA_CHECKLIST: "Recupera dati da una checklist wallbox",
  RECUPERA_DA_CHECKLIST_PLACEHOLDER: "Nessuna (compila a mano)",
  RECUPERA_DA_CHECKLIST_HELPER:
    "Se selezioni una checklist, i dati di tecnico e cliente vengono precompilati",

  INTERVENTO_NUMERO: "N. intervento",
  DATA: "Data",
  ORA_DALLE: "Dalle ore",
  ORA_ALLE: "Alle ore",

  TECNICO_SPECIALIZZATO: "Tecnico specializzato",
  TECNICO_SOCIETA: "Denominazione della società",
  TECNICO_NOME: "Nome e cognome del tecnico",

  DATI_CLIENTE: "Dati del cliente",
  CLIENTE_NOME_COGNOME: "Nome e cognome",
  CLIENTE_INDIRIZZO: "Indirizzo",
  CLIENTE_CIVICO: "N. civico",
  CLIENTE_COMUNE: "Comune",
  CLIENTE_CAP: "CAP",
  CLIENTE_PROVINCIA: "Prov.",
  CLIENTE_TELEFONO: "Tel. / Cell.",
  CLIENTE_EMAIL: "Mail",

  TIPOLOGIA_INTERVENTO: "Tipologia di intervento",
  TIPOLOGIA_24_7: "Intervento Tecnico 24/7",
  TIPOLOGIA_CALDAIA: "Caldaia",
  TIPOLOGIA_SCALDABAGNO: "Scaldabagno",
  TIPOLOGIA_CLIMATIZZATORE: "Climatizzatore",
  TIPOLOGIA_ELETTRODOMESTICO: "Elettrodomestico",
  TIPOLOGIA_VARIE: "Varie",

  DETTAGLIO_PRESTAZIONE: "Dettaglio prestazione",
  DETTAGLIO_MANODOPERA_COMPRESA: "Uscita e ore manodopera comprese nel servizio",
  DETTAGLIO_MANODOPERA_A_PAGAMENTO:
    "Uscita e ore manodopera a pagamento non comprese nel servizio",
  DETTAGLIO_ORE_MANODOPERA_EXTRA: "N. ore manodopera extra",
  DETTAGLIO_PEZZI_RICAMBIO: "Pezzi di ricambio/materiali/accessori",
  DETTAGLIO_PREVENTIVO: "Preventivo",
  DETTAGLIO_RIPARAZIONE: "Riparazione",
  DETTAGLIO_MANUTENZIONE: "Manutenzione",

  DETTAGLIO_IMPIANTI: "Dettaglio impianti",
  DETTAGLIO_INTERVENTO_ESEGUITO: "Dettaglio intervento eseguito",

  ELENCO_INTERVENTI_TITOLO:
    "Elenco interventi eseguiti/componenti acquistati (costi a carico del cliente)",
  ELENCO_DESCRIZIONE_PLACEHOLDER: "Descrizione",
  ELENCO_IMPORTO_PLACEHOLDER: "Importo (€)",
  ELENCO_IMPORTO_TOTALE: "Importo totale IVA inclusa (€)",

  PRESCRIZIONI_TITOLO:
    "Per quanto potuto constatare dal tecnico, l'apparecchio e/o l'impianto può funzionare in sicurezza",
  PRESCRIZIONE_MOTIVO_PLACEHOLDER: "Motivo della prescrizione",

  OSSERVAZIONI: "Osservazioni ed annotazioni",

  MODALITA_PAGAMENTO: "Modalità di pagamento",
  MODALITA_PAGAMENTO_BOLLETTA: "Pagamento in bolletta",
  MODALITA_PAGAMENTO_CARTA: "Carta di credito",

  SI: "Sì",
  NO: "No",

  LUOGO: "Luogo",
  FIRMA_TECNICO: "Firma tecnico",
  FIRMA_CLIENTE: "Firma cliente",
  NOME_FIRMA_TECNICO: "Nome tecnico",
  NOME_FIRMA_CLIENTE: "Nome cliente",
  CANCELLA_FIRMA: "Cancella",
  FIRMA_AVVISO:
    "Stai per firmare questo ordine di lavoro: dopo la conferma non potrà più essere modificato.",
  CONFERMA_FIRMA: "Conferma firma",
  FIRMA_IN_CORSO: "Firma in corso...",
  FIRMA_CONFERMATA: "Ordine di lavoro firmato",
  VAI_ALLA_FIRMA: "Firma",
  SALVA: "Salva bozza",
  SALVA_MODIFICHE: "Salva modifiche",
  MODIFICA: "Modifica",
  MODIFICA_TITOLO: "Modifica ordine di lavoro",
  SALVATAGGIO: "Salvataggio...",
  ANNULLA: "Annulla",
  CARICAMENTO: "Caricamento...",
  CREATO_IL: "Creato il",
  NESSUN_ORDINE: "Nessun ordine di lavoro creato",
  DOWNLOAD_PDF: "Scarica PDF",
  CONDIVIDI_WHATSAPP: "Condividi su WhatsApp",
  CONDIVIDI_NON_DISPONIBILE:
    "Condivisione non disponibile su questo dispositivo: scarica il PDF e allegalo manualmente",
  INVIA_ORA: "Invia ora",
  PROPOSTA_INVIO_POST_FIRMA:
    "L'ordine di lavoro è firmato e non è più modificabile. Vuoi inviarlo subito via email al cliente?",

  ERRORI: {
    GENERICO: "Errore gestione ordine di lavoro",
    NOME_CLIENTE_OBBLIGATORIO: "Inserisci nome e cognome del cliente",
    FIRME_OBBLIGATORIE: "Inserisci entrambe le firme prima di confermare",
    FIRMA_TECNICO_NOME_OBBLIGATORIO:
      "Inserisci nome e cognome di chi firma come tecnico",
    FIRMA_CLIENTE_NOME_OBBLIGATORIO:
      "Inserisci nome e cognome di chi firma per il cliente",
    FIRMA_TROPPO_GRANDE: "Firma troppo grande",
    ORDINE_NON_TROVATO: "Ordine di lavoro non trovato",
    ORDINE_FIRMATO: "Ordine di lavoro firmato non modificabile",
    INVIO_SOLO_FIRMATO: "Si possono inviare solo ordini di lavoro firmati",
    PDF_TROPPO_GRANDE: "PDF troppo pesante per l'invio email (oltre 5 MB)",
    INVIO_NON_CONFIGURATO: "Invio email non configurato (RESEND_API_KEY mancante)",
    INVIO_FALLITO: "Invio non riuscito: l'ordine resta firmato, riprova",
    SESSIONE_MANCANTE: "Sessione utente non valida",
    ACCESSO_NEGATO: "Accesso non autorizzato",
    PDF_GENERICO: "Errore generazione PDF ordine di lavoro",
  },
  MESSAGGI: {
    CREATO: "Ordine di lavoro creato",
    MODIFICATO: "Ordine di lavoro modificato",
    FIRMATO: "Ordine di lavoro firmato",
    INVIATO: "Ordine di lavoro inviato a",
  },
} as const;
