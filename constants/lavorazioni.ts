export const LAVORAZIONI_LIMITI = {
  ORDINE_DEFAULT: 0,
  PERCENTUALE_MIN: 0,
  PERCENTUALE_MAX: 100,
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
  DISATTIVA: "Disattiva",
  RIATTIVA: "Riattiva",
  CARICAMENTO: "Caricamento...",
  NESSUNA_LAVORAZIONE:
    "Nessuna lavorazione per questo cantiere",
  ERRORI: {
    GENERICO: "Errore gestione lavorazioni",
    CANTIERE_OBBLIGATORIO:
      "Seleziona un cantiere",
    NOME_OBBLIGATORIO:
      "Inserisci il nome della lavorazione",
    ORDINE_NON_VALIDO:
      "Ordine non valido",
    PERCENTUALE_NON_VALIDA:
      "Percentuale non valida",
  },
  MESSAGGI: {
    CREATA: "Lavorazione creata",
    AGGIORNATA: "Lavorazione aggiornata",
    PERCENTUALE_AGGIORNATA:
      "Percentuale aggiornata",
    ATTIVATA: "Lavorazione attivata",
    DISATTIVATA: "Lavorazione disattivata",
  },
} as const;
