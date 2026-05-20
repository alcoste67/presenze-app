export const LAVORAZIONI_LIMITI = {
  ORDINE_DEFAULT: 0,
  PERCENTUALE_MIN: 0,
  PERCENTUALE_MAX: 100,
  IMPORT_MAX_LAVORAZIONI: 100,
  IMPORT_MAX_CSV_CARATTERI: 60000,
} as const;

export const LAVORAZIONI_IMPORT = {
  FILE_ACCEPT: ".csv,text/csv",
  OPENAI_MODEL_DEFAULT: "gpt-5.4-mini",
} as const;

export const LAVORAZIONI_TESTI = {
  TITOLO: "Lavorazioni",
  CARD_DESCRIZIONE:
    "Fasi e percentuali avanzamento cantiere",
  BACKOFFICE: "Back-office",
  TIMBRATURE: "Timbrature",
  CANTIERE: "Cantiere",
  SELEZIONA_CANTIERE:
    "Seleziona un cantiere",
  NESSUN_CANTIERE:
    "Nessun cantiere disponibile",
  NUOVA_LAVORAZIONE: "Nuova lavorazione",
  MODIFICA_LAVORAZIONE:
    "Modifica lavorazione",
  LISTA_LAVORAZIONI: "Lista lavorazioni",
  NOME: "Nome",
  ORDINE: "Ordine",
  PERCENTUALE: "Percentuale",
  ATTIVA: "Attiva",
  STATO: "Stato",
  AZIONI: "Azioni",
  ATTIVO: "Attiva",
  NON_ATTIVO: "Non attiva",
  SALVA: "Salva",
  SALVATAGGIO: "Salvataggio...",
  ANNULLA: "Annulla",
  MODIFICA: "Modifica",
  AGGIORNA: "Aggiorna",
  AGGIORNA_PERCENTUALE: "Aggiorna %",
  IMPORTA_COMPUTO: "Importa computo CSV",
  FILE_COMPUTO: "File computo CSV",
  ESTRAI_LAVORAZIONI:
    "Estrai lavorazioni",
  ESTRAZIONE: "Estrazione...",
  ANTEPRIMA_IMPORT:
    "Anteprima import",
  CONFERMA_IMPORT:
    "Conferma import",
  RIMUOVI: "Rimuovi",
  DISATTIVA: "Disattiva",
  RIATTIVA: "Riattiva",
  CARICAMENTO: "Caricamento...",
  NESSUNA_LAVORAZIONE:
    "Nessuna lavorazione per questo cantiere",
  ERRORI: {
    GENERICO: "Errore gestione lavorazioni",
    TOKEN_MANCANTE:
      "Token autenticazione mancante",
    TOKEN_NON_VALIDO:
      "Token autenticazione non valido",
    ACCESSO_NEGATO:
      "Accesso non autorizzato",
    CANTIERE_OBBLIGATORIO:
      "Seleziona un cantiere",
    NOME_OBBLIGATORIO:
      "Inserisci il nome della lavorazione",
    ORDINE_NON_VALIDO:
      "Ordine non valido",
    PERCENTUALE_NON_VALIDA:
      "Percentuale non valida",
    FILE_CSV_OBBLIGATORIO:
      "Carica un file CSV",
    FILE_CSV_NON_VALIDO:
      "File CSV non valido",
    FILE_CSV_TROPPO_GRANDE:
      "File CSV troppo grande",
    AI_NON_CONFIGURATA:
      "AI non configurata",
    AI_ESTRAZIONE_FALLITA:
      "Estrazione AI non riuscita",
    AI_RISPOSTA_NON_VALIDA:
      "Risposta AI non valida",
    NESSUNA_LAVORAZIONE_IMPORT:
      "Nessuna lavorazione estratta",
    IMPORT_NON_VALIDO:
      "Anteprima import non valida",
  },
  MESSAGGI: {
    CREATA: "Lavorazione creata",
    IMPORT_PRONTO:
      "Anteprima import pronta",
    IMPORT_COMPLETATO:
      "Lavorazioni importate",
    AGGIORNATA: "Lavorazione aggiornata",
    PERCENTUALE_AGGIORNATA:
      "Percentuale aggiornata",
    ATTIVATA: "Lavorazione attivata",
    DISATTIVATA: "Lavorazione disattivata",
  },
} as const;
