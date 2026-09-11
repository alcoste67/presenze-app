export const CHECKLIST_WALLBOX_STATI = {
  BOZZA: "BOZZA",
  FIRMATO: "FIRMATO",
  INVIATO: "INVIATO",
} as const;

export const LABEL_STATI_CHECKLIST_WALLBOX: Record<
  (typeof CHECKLIST_WALLBOX_STATI)[keyof typeof CHECKLIST_WALLBOX_STATI],
  string
> = {
  [CHECKLIST_WALLBOX_STATI.BOZZA]: "Bozza",
  [CHECKLIST_WALLBOX_STATI.FIRMATO]: "Firmato",
  [CHECKLIST_WALLBOX_STATI.INVIATO]: "Inviato",
};

export const CHECKLIST_WALLBOX_LIMITI = {
  FIRMA_MAX_DATA_URL_CARATTERI: 120000,
} as const;

export const CHECKLIST_WALLBOX_PDF = {
  FILE_PREFIX: "Checklist_WallBox",
  LOCALE: "it-IT",
} as const;

// Catalogo materiali del modulo cartaceo (pagina 2): stessa struttura,
// stessi gruppi. La quantità resta testo libero (a volte l'originale è
// compilato a mano con note oltre al numero).
export const CHECKLIST_WALLBOX_CATALOGO_MATERIALI: readonly {
  gruppo: string;
  descrizione: string;
}[] = [
  { gruppo: "CAVI", descrizione: "F.p.o Cavo FG16OR16 3 G6 (MONOFASE)" },
  { gruppo: "CAVI", descrizione: "F.p.o Cavo FG16OR16 5 G6 (TRIFASE)" },
  { gruppo: "CAVI", descrizione: "F.p.o Cavo FG16OR16 5 G10 (TRIFASE)" },
  { gruppo: "CAVI", descrizione: "F.p.o Cavo FG16OR16 5 G16 (TRIFASE)" },
  { gruppo: "CAVI", descrizione: "F.p.o Cavo dati RS-485" },
  { gruppo: "TUBO", descrizione: "F.p.o Tubo RK15 (25mm/32mm)" },
  {
    gruppo: "INTERRUTTORI",
    descrizione: "F.p.o Interruttore Magn differenziale 2x32A 30mA",
  },
  {
    gruppo: "INTERRUTTORI",
    descrizione:
      "F.p.o Interruttore Magn differenziale 2x32A 30mA + Calotta",
  },
  {
    gruppo: "INTERRUTTORI",
    descrizione:
      "F.p.o Interruttore Magn differenziale classe B 2x20A 30mA",
  },
  {
    gruppo: "INTERRUTTORI",
    descrizione:
      "F.p.o Interruttore Magn differenziale 4x32A 30mA (Trifase)",
  },
  {
    gruppo: "INTERRUTTORI",
    descrizione: "F.p.o Interruttore differenziale 4x40A 30mA (Trifase)",
  },
  {
    gruppo: "INTERRUTTORI",
    descrizione: "F.p.o Magnetotermico 4x32 + Calotta (Trifase)",
  },
  { gruppo: "QUADRI", descrizione: "Quadro 8 Moduli" },
  { gruppo: "QUADRI", descrizione: "Quadro 12 Moduli" },
  {
    gruppo: "VARI",
    descrizione:
      "F.p.o Scaricatori SPD a protezione wallbox e circuito ricarica (monofase)",
  },
  {
    gruppo: "VARI",
    descrizione:
      "F.p.o Scaricatori SPD a protezione wallbox e circuito ricarica (Trifase)",
  },
  { gruppo: "ALTRO", descrizione: "Bobina di Sgancio" },
  { gruppo: "ACCESSORI (Fornitura Edison)", descrizione: "PALO" },
  {
    gruppo: "ACCESSORI (Fornitura Edison)",
    descrizione: "TETTOIA (solo SCAME)",
  },
] as const;

export const CHECKLIST_WALLBOX_TESTI = {
  TITOLO: "Checklist Wall Box",
  CARD_DESCRIZIONE:
    "Sopralluogo installazione wallbox, firmato da tecnico e cliente",
  BACKOFFICE: "Back-office",
  LISTA: "Elenco checklist",
  NUOVO: "Nuova checklist",
  FIRMA_PAGINA_TITOLO: "Firma checklist",
  DATI_CLIENTE: "Dati cliente",
  RAGIONE_SOCIALE: "Ragione sociale",
  PIVA: "P.IVA",
  NOME: "Nome",
  COGNOME: "Cognome",
  VIA: "Via",
  COMUNE: "Comune",
  CAP: "CAP",
  PROVINCIA: "Prov.",
  TELEFONO: "Telefono",
  EMAIL_CLIENTE: "Email cliente",
  EMAIL_CLIENTE_HELPER:
    "Non presente sul modulo cartaceo: serve per inviare qui il PDF firmato",
  POSIZIONAMENTO: "Posizionamento wallbox",
  POSIZIONAMENTO_PLACEHOLDER:
    "Box singolo, condominio, parcheggio aperto",
  MODALITA_POSA: "Modalità di posa",
  MODALITA_POSA_PARETE: "A parete",
  MODALITA_POSA_TERRA: "A terra",
  POTENZA_CONTATORE: "Potenza contatore contrattuale (kW)",
  DOMANDE_TITOLO: "Verifiche impianto",
  QUADRO_CONFORME:
    "Il quadro elettrico è conforme alla normativa vigente in funzione dei carichi presenti sull'impianto?",
  IMPIANTO_A_NORMA:
    "L'impianto elettrico dell'immobile ed eventuali pertinenze è a norma vigente",
  DICHIARAZIONE_CONFORMITA:
    "Il cliente ha la dichiarazione di conformità dell'impianto elettrico e la può fornire?",
  AUTORIZZAZIONI_NECESSARIE:
    "Sono necessarie delle autorizzazioni per eseguire le opere (specificare nelle note)?",
  MESSA_A_TERRA: "Esiste impianto di messa a terra",
  INSTALLAZIONE_POSSIBILE: "L'installazione è possibile?",
  OPERE_ADEGUAMENTO_NECESSARIE:
    "Sono necessarie opere di adeguamento impianto?",
  SI: "Sì",
  NO: "No",
  NOTE: "Eventuali note",
  MATERIALI_TITOLO: "Materiali necessari (in caso di opere di adeguamento)",
  QUANTITA: "Quantità",
  LUOGO: "Luogo",
  DATA_SOPRALLUOGO: "Data",
  FIRMA_TECNICO: "Firma tecnico",
  FIRMA_CLIENTE: "Firma cliente",
  NOME_FIRMA_TECNICO: "Nome tecnico",
  NOME_FIRMA_CLIENTE: "Nome cliente",
  CANCELLA_FIRMA: "Cancella",
  FIRMA_AVVISO:
    "Stai per firmare questa checklist: dopo la conferma non potrà più essere modificata.",
  CONFERMA_FIRMA: "Conferma firma",
  FIRMA_IN_CORSO: "Firma in corso...",
  FIRMA_CONFERMATA: "Checklist firmata",
  VAI_ALLA_FIRMA: "Firma",
  CHECKLIST_NON_FIRMABILE:
    "La checklist non è in bozza e non può essere firmata",
  SALVA: "Salva bozza",
  SALVATAGGIO: "Salvataggio...",
  ANNULLA: "Annulla",
  CARICAMENTO: "Caricamento...",
  CREATO_IL: "Creato il",
  STATO: "Stato",
  NESSUNA_CHECKLIST: "Nessuna checklist creata",
  DOWNLOAD_PDF: "Scarica PDF",
  CONDIVIDI_WHATSAPP: "Condividi su WhatsApp",
  CONDIVIDI_NON_DISPONIBILE:
    "Condivisione non disponibile su questo dispositivo: scarica il PDF e allegalo manualmente",
  INVIA: "Invia via email",
  INVIA_ORA: "Invia ora",
  INVIA_IN_CORSO: "Invio...",
  PROPOSTA_INVIO_POST_FIRMA:
    "La checklist è firmata e non è più modificabile. Vuoi inviarla subito via email al cliente?",
  INVIO_CONFERMA: "Il PDF firmato verrà inviato via email a",
  SUGGERIMENTO_NOME_FILE:
    "Suggerimento per il salvataggio su Files: crea (o scegli) una cartella",
  ERRORI: {
    GENERICO: "Errore gestione checklist wallbox",
    RAGIONE_SOCIALE_O_NOME_OBBLIGATORIO:
      "Inserisci ragione sociale oppure nome e cognome del cliente",
    COMUNE_OBBLIGATORIO: "Inserisci il comune",
    EMAIL_CLIENTE_OBBLIGATORIA:
      "Inserisci l'email del cliente: serve per inviare il PDF firmato",
    EMAIL_NON_VALIDA: "Inserisci un indirizzo email valido",
    FIRME_OBBLIGATORIE:
      "Inserisci entrambe le firme prima di confermare",
    FIRMA_TECNICO_NOME_OBBLIGATORIO:
      "Inserisci nome e cognome di chi firma come tecnico",
    FIRMA_CLIENTE_NOME_OBBLIGATORIO:
      "Inserisci nome e cognome di chi firma per il cliente",
    FIRMA_TROPPO_GRANDE: "Firma troppo grande",
    CHECKLIST_NON_TROVATA: "Checklist non trovata",
    CHECKLIST_FIRMATA: "Checklist firmata non modificabile",
    INVIO_SOLO_FIRMATA: "Si possono inviare solo checklist firmate",
    PDF_TROPPO_GRANDE:
      "PDF troppo pesante per l'invio email (oltre 5 MB)",
    INVIO_NON_CONFIGURATO:
      "Invio email non configurato (RESEND_API_KEY mancante)",
    INVIO_FALLITO:
      "Invio non riuscito: la checklist resta firmata, riprova",
    SESSIONE_MANCANTE: "Sessione utente non valida",
    TOKEN_MANCANTE: "Token autenticazione mancante",
    TOKEN_NON_VALIDO: "Token autenticazione non valido",
    ACCESSO_NEGATO: "Accesso non autorizzato",
    PDF_GENERICO: "Errore generazione PDF checklist wallbox",
  },
  MESSAGGI: {
    CREATA: "Checklist creata",
    FIRMATA: "Checklist firmata",
    INVIATA: "Checklist inviata a",
  },
  PDF: {
    TITOLO: "CHECK LIST INSTALLAZIONE WALL BOX",
    PAGINA: "Pagina",
    DI: "di",
    DATA_FIRMA: "Data firma",
  },
} as const;
