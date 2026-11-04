export const MODULI_FOTOVOLTAICI_TESTI = {
  BACKOFFICE: "Backoffice",
  TIMBRATURE: "Timbrature",

  ANAGRAFICA_TITOLO: "Moduli fotovoltaici",
  ANAGRAFICA_CARD_DESCRIZIONE:
    "Catalogo dei moduli fotovoltaici disponibili per il dimensionamento degli impianti",

  LISTA_ANAGRAFICA: "Moduli",
  NESSUNO_ANAGRAFICA: "Nessun modulo in anagrafica",
  CARICAMENTO: "Caricamento moduli...",

  MARCA: "Marca",
  MODELLO: "Modello",
  POTENZA_WP: "Potenza (Wp)",
  LUNGHEZZA_MM: "Lunghezza (mm)",
  LARGHEZZA_MM: "Larghezza (mm)",
  SPESSORE_MM: "Spessore (mm)",
  PESO_KG: "Peso (kg)",
  ATTIVO: "Attivo",
  DISATTIVO: "Disattivo",

  MODIFICA: "Modifica",
  ELIMINA: "Elimina",
  ANNULLA: "Annulla",

  IMPORTA_DA_SCHEDA: "Importa da scheda tecnica (PDF)",
  IMPORTA_IN_CORSO: "Lettura scheda tecnica in corso...",
  IMPORTA_PREVIEW_TITOLO: "Dati estratti dalla scheda tecnica",
  IMPORTA_PREVIEW_DESCRIZIONE:
    "Verifica e correggi i dati prima di salvare il modulo: l'estrazione automatica può contenere errori.",

  ERRORI: {
    MARCA_OBBLIGATORIA: "La marca è obbligatoria",
    MODELLO_OBBLIGATORIO: "Il modello è obbligatorio",
    POTENZA_NON_VALIDA: "Indica una potenza in Wp valida (maggiore di zero)",
    DIMENSIONI_NON_VALIDE: "Indica lunghezza e larghezza in mm valide (maggiori di zero)",
    GENERICO: "Si è verificato un errore, riprova",
    TOKEN_MANCANTE: "Token mancante",
    TOKEN_NON_VALIDO: "Token non valido",
    ACCESSO_NEGATO: "Accesso riservato agli amministratori",
    FILE_PDF_OBBLIGATORIO: "Carica il PDF della scheda tecnica",
    FILE_NON_SUPPORTATO: "Formato file non supportato: carica un PDF",
    FILE_TROPPO_GRANDE: "Il file è troppo grande",
    AI_NON_CONFIGURATA: "Import automatico non configurato",
    AI_ESTRAZIONE_FALLITA: "Non è stato possibile leggere la scheda tecnica",
    AI_RISPOSTA_NON_VALIDA: "Risposta non valida dal servizio di estrazione",
  },

  MESSAGGI: {
    MODULO_CREATO: "Modulo creato",
    MODULO_AGGIORNATO: "Modulo aggiornato",
    MODULO_ELIMINATO: "Modulo eliminato",
    DATI_IMPORTATI: "Dati importati dalla scheda tecnica: verifica e salva",
  },
} as const;

export const MODULI_FOTOVOLTAICI_LIMITI = {
  IMPORT_MAX_FILE_BYTES: 15 * 1024 * 1024,
} as const;
