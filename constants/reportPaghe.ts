export const REPORT_PAGHE_LIMITI = {
  MAX_DIPENDENTI: 300,
  MAX_TIMBRATURE: 20000,
} as const;

export const REPORT_PAGHE_TIME_ZONE = "Europe/Rome";

export const REPORT_PAGHE_CSV = {
  SEPARATORE: ";",
  BOM: "﻿",
  INJECTION_PREFIX: "'",
  NOME_FILE_PREFIX: "report-paghe",
  MIME_TYPE: "text/csv;charset=utf-8",
} as const;

export const LABEL_TIPO_ASSENZA_PAGHE: Record<
  "FERIE" | "PERMESSO" | "MALATTIA" | "ALTRO",
  string
> = {
  FERIE: "FERIE",
  PERMESSO: "PERMESSO",
  MALATTIA: "MALATTIA",
  ALTRO: "ALTRO",
};

export const REPORT_PAGHE_TESTI = {
  TITOLO: "Report paghe",
  CARD_DESCRIZIONE: "Tabella mensile per il consulente del lavoro",
  SOTTOTITOLO: "Un dipendente per riga, un giorno del mese per colonna",
  BACKOFFICE: "Back-office",
  TIMBRATURE: "Timbrature",
  FILTRI: "Filtri",
  MESE: "Mese",
  DIPENDENTE: "Dipendente",
  TUTTI_DIPENDENTI: "Tutti i dipendenti",
  CERCA: "Genera",
  CARICAMENTO: "Caricamento...",
  ESPORTA_CSV: "Esporta CSV",
  STAMPA_PDF: "Stampa / Salva PDF",
  ANTEPRIMA: "Anteprima",
  COLONNA_DIPENDENTE: "Dipendente",
  COLONNA_TOTALE: "Totale ore lavorate",
  NESSUN_RISULTATO: "Nessun dipendente trovato per questo mese",
  NESSUNA_RICERCA: "Scegli il mese e genera il report",
  LIMITE_RAGGIUNTO: "Elenco limitato ai primi dipendenti disponibili",
  DIPENDENTI: "dipendenti",
  // Timbrature presenti quel giorno ma con sequenza rotta (turno rimasto
  // aperto, pausa mai chiusa...): va distinto da una cella vuota, che
  // significa "nessuna timbratura quel giorno".
  VALORE_ANOMALIA: "Anomalia timbrature",
  ERRORI: {
    SESSIONE_MANCANTE: "Sessione utente non valida",
    RISPOSTA_NON_VALIDA: "Risposta report paghe non valida",
    GENERICO: "Errore caricamento report paghe",
    FILTRI_NON_VALIDI: "Filtri report paghe non validi",
    MESE_OBBLIGATORIO: "Seleziona un mese",
    TOKEN_MANCANTE: "Token autenticazione mancante",
    TOKEN_NON_VALIDO: "Token autenticazione non valido",
    ACCESSO_NEGATO: "Accesso non autorizzato",
  },
} as const;
