export const RIMBORSI_KM_CSV = {
  SEPARATORE: ";",
  BOM: "﻿",
  INJECTION_PREFIX: "'",
  NOME_FILE_PREFIX: "rimborsi-km",
  MIME_TYPE: "text/csv;charset=utf-8",
} as const;

export const RIMBORSI_KM_COLONNE = [
  "Dipendente",
  "Veicolo",
  "Km totali",
  "Tariffa (€/km)",
  "Rimborso (€)",
] as const;

export const RIMBORSI_KM_TESTI = {
  TITOLO: "Rimborsi chilometrici",
  SOTTOTITOLO: "Totale km percorsi e rimborso dovuto per dipendente, per mese",
  BACKOFFICE: "Back-office",
  MESE: "Mese",
  CERCA: "Cerca",
  ESPORTA_CSV: "Esporta CSV",
  ANTEPRIMA: "Anteprima",
  CARICAMENTO: "Caricamento...",
  NESSUN_RISULTATO: "Nessun km registrato nel mese selezionato",
  TARIFFA_NON_IMPOSTATA: "Tariffa non impostata",
  ERRORI: {
    SESSIONE_MANCANTE: "Sessione utente non valida",
    TOKEN_MANCANTE: "Token autenticazione mancante",
    TOKEN_NON_VALIDO: "Token autenticazione non valido",
    ACCESSO_NEGATO: "Accesso non autorizzato",
    GENERICO: "Errore caricamento rimborsi chilometrici",
    MESE_NON_VALIDO: "Mese non valido",
  },
} as const;
