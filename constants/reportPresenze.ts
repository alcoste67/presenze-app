import { ATTIVITA } from "@/constants/attivita";
import { TIMBRATURE } from "@/constants/stati";
import type { TipoAttivita } from "@/types/attivita";
import type { TipoTimbratura } from "@/types/timbrature";

export const REPORT_PRESENZE_LIMITI = {
  MAX_GIORNI: 31,
  MAX_RIGHE: 1000,
} as const;

export const REPORT_PRESENZE_TIME_ZONE =
  "Europe/Rome";

export const REPORT_PRESENZE_CSV = {
  SEPARATORE: ";",
  BOM: "\uFEFF",
  INJECTION_PREFIX: "'",
  NOME_FILE_PREFIX: "presenze",
  MIME_TYPE: "text/csv;charset=utf-8",
} as const;

export const REPORT_PRESENZE_COLONNE = [
  "Data",
  "Ora",
  "Dipendente",
  "Email",
  "Tipo",
  "Destinazione",
  "Cantiere",
  "Attivita",
] as const;

export const LABEL_TIMBRATURE_REPORT: Record<
  TipoTimbratura,
  string
> = {
  [TIMBRATURE.ENTRATA]: "Entrata",
  [TIMBRATURE.PAUSA]: "Pausa",
  [TIMBRATURE.RIENTRO]: "Rientro",
  [TIMBRATURE.USCITA]: "Uscita",
  [TIMBRATURE.CAMBIO_CANTIERE]:
    "Cambio cantiere",
};

export const LABEL_ATTIVITA_REPORT: Record<
  TipoAttivita,
  string
> = {
  [ATTIVITA.ACQUISTI]: "Acquisti",
  [ATTIVITA.TRASFERTA]: "Trasferta",
  [ATTIVITA.MAGAZZINO]: "Magazzino",
  [ATTIVITA.UFFICIO]: "Ufficio",
  [ATTIVITA.SOPRALLUOGO]: "Sopralluogo",
  [ATTIVITA.ASSISTENZA]: "Assistenza",
  [ATTIVITA.VISITA_MEDICA]: "Visita medica",
  [ATTIVITA.FORMAZIONE]: "Formazione",
  [ATTIVITA.CANTIERE_NUOVO]: "Cantiere nuovo",
  [ATTIVITA.ALTRO]: "Altro",
};

export const REPORT_PRESENZE_TESTI = {
  TITOLO: "Presenze",
  CARD_DESCRIZIONE:
    "Export presenze CSV e stampa PDF",
  SOTTOTITOLO:
    "Export presenze filtrabile per back-office",
  BACKOFFICE: "Back-office",
  TIMBRATURE: "Timbrature",
  FILTRI: "Filtri",
  DATA_INIZIO: "Data inizio",
  DATA_FINE: "Data fine",
  DIPENDENTE: "Dipendente",
  CANTIERE: "Cantiere",
  TUTTI_DIPENDENTI: "Tutti i dipendenti",
  TUTTI_CANTIERI: "Tutti i cantieri",
  CERCA: "Cerca",
  CARICAMENTO: "Caricamento...",
  ESPORTA_CSV: "Esporta CSV",
  STAMPA_PDF: "Stampa / Salva PDF",
  ANTEPRIMA: "Anteprima",
  RIGHE: "righe",
  LIMITE_EXPORT_PREFIX: "Massimo",
  LIMITE_EXPORT_GIORNI_E: "giorni e",
  LIMITE_EXPORT_RIGHE_SUFFIX:
    "righe per export.",
  NESSUN_RISULTATO:
    "Nessuna timbratura trovata",
  NESSUNA_RICERCA:
    "Imposta i filtri e genera l'anteprima",
  LIMITE_RAGGIUNTO:
    "Anteprima limitata alle prime righe disponibili",
  DESTINAZIONE_NON_DISPONIBILE:
    "Destinazione non disponibile",
  DIPENDENTE_NON_DISPONIBILE:
    "Dipendente non disponibile",
  ATTIVITA_NON_DISPONIBILE: "",
  CANTIERE_NON_DISPONIBILE: "",
  EMAIL_NON_DISPONIBILE: "",
  ERRORI: {
    SESSIONE_MANCANTE:
      "Sessione utente non valida",
    RISPOSTA_NON_VALIDA:
      "Risposta report presenze non valida",
    GENERICO: "Errore caricamento presenze",
    FILTRI_NON_VALIDI:
      "Filtri report non validi",
    DATE_OBBLIGATORIE:
      "Data inizio e data fine sono obbligatorie",
    INTERVALLO_NON_VALIDO:
      "Intervallo date non valido",
    INTERVALLO_MASSIMO_PREFIX:
      "Intervallo massimo",
    INTERVALLO_MASSIMO_SUFFIX: "giorni",
    TOKEN_MANCANTE:
      "Token autenticazione mancante",
    TOKEN_NON_VALIDO:
      "Token autenticazione non valido",
    ACCESSO_NEGATO: "Accesso non autorizzato",
  },
} as const;
