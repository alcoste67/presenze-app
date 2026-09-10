import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";

export const PIANIFICAZIONI_LIMITI = {
  MAX_GIORNI: 31,
} as const;

export const RUOLI_MODIFICA_PIANIFICAZIONI = [
  RUOLI_DIPENDENTE.ADMIN,
  RUOLI_DIPENDENTE.SUPERADMIN,
  RUOLI_DIPENDENTE.RESPONSABILE,
  RUOLI_DIPENDENTE.UFFICIO,
] as const;

export const PIANIFICAZIONI_TESTI = {
  TITOLO: "Calendario lavori",
  CARD_DESCRIZIONE: "Pianificazione squadre e macchinari per cantiere",
  SOTTOTITOLO_MODIFICA: "Programma chi va dove e cosa portare",
  SOTTOTITOLO_SOLA_LETTURA: "I tuoi lavori in programma",
  BACKOFFICE: "Back-office",
  TIMBRATURE: "Timbrature",
  DATA_INIZIO: "Da",
  DATA_FINE: "A",
  CERCA: "Cerca",
  NUOVA_PIANIFICAZIONE: "Nuova pianificazione",
  MODIFICA_PIANIFICAZIONE: "Modifica pianificazione",
  CANTIERE: "Cantiere",
  DATA: "Data",
  NOTE: "Note",
  NOTE_PLACEHOLDER: "Dettagli sul lavoro da fare, materiali, orari...",
  SQUADRA: "Squadra",
  MACCHINARI: "Macchinari da portare",
  NESSUN_MACCHINARIO_DISPONIBILE: "Nessun macchinario disponibile",
  SALVA: "Salva",
  ANNULLA: "Annulla",
  ELIMINA: "Elimina",
  CONFERMA_ELIMINA_TITOLO: "Elimina pianificazione",
  CONFERMA_ELIMINA_MESSAGGIO:
    "Eliminare questa pianificazione? La squadra non la vedrà più in calendario.",
  NESSUN_RISULTATO: "Nessun lavoro pianificato in questo periodo",
  CARICAMENTO: "Caricamento...",
  ERRORI: {
    SESSIONE_MANCANTE: "Sessione utente non valida",
    RISPOSTA_NON_VALIDA: "Risposta pianificazioni non valida",
    GENERICO: "Errore caricamento pianificazioni",
    SALVATAGGIO: "Errore salvataggio pianificazione",
    ELIMINAZIONE: "Errore eliminazione pianificazione",
    FILTRI_NON_VALIDI: "Filtri non validi",
    DATE_OBBLIGATORIE: "Data inizio e data fine sono obbligatorie",
    INTERVALLO_NON_VALIDO: "Intervallo date non valido",
    INTERVALLO_MASSIMO_PREFIX: "Intervallo massimo",
    INTERVALLO_MASSIMO_SUFFIX: "giorni",
    CANTIERE_OBBLIGATORIO: "Seleziona un cantiere",
    DATA_OBBLIGATORIA: "Seleziona una data",
    TOKEN_MANCANTE: "Token autenticazione mancante",
    TOKEN_NON_VALIDO: "Token autenticazione non valido",
    ACCESSO_NEGATO: "Accesso non autorizzato",
    NON_TROVATA: "Pianificazione non trovata",
  },
  MESSAGGI: {
    SALVATA: "Pianificazione salvata",
    ELIMINATA: "Pianificazione eliminata",
  },
} as const;
