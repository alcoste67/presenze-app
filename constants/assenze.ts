import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";

export const RUOLI_APPROVA_ASSENZE = [
  RUOLI_DIPENDENTE.ADMIN,
  RUOLI_DIPENDENTE.SUPERADMIN,
] as const;

export const TIPO_ASSENZA = {
  FERIE: "FERIE",
  PERMESSO: "PERMESSO",
} as const;

export const LABEL_TIPO_ASSENZA: Record<string, string> = {
  [TIPO_ASSENZA.FERIE]: "Ferie",
  [TIPO_ASSENZA.PERMESSO]: "Permesso",
};

export const STATO_RICHIESTA_ASSENZA = {
  IN_ATTESA: "IN_ATTESA",
  APPROVATA: "APPROVATA",
  RIFIUTATA: "RIFIUTATA",
} as const;

export const LABEL_STATO_RICHIESTA_ASSENZA: Record<string, string> = {
  [STATO_RICHIESTA_ASSENZA.IN_ATTESA]: "In attesa",
  [STATO_RICHIESTA_ASSENZA.APPROVATA]: "Approvata",
  [STATO_RICHIESTA_ASSENZA.RIFIUTATA]: "Rifiutata",
};

export const ASSENZE_TESTI = {
  FERIE: "Ferie",
  PERMESSO: "Permesso",
  RICHIEDI_FERIE: "Richiedi ferie",
  RICHIEDI_PERMESSO: "Richiedi permesso",
  DATA_INIZIO: "Dal",
  DATA_FINE: "Al",
  GIORNATA_INTERA: "Giornata intera",
  PARZIALE: "Parziale (ore)",
  ORE: "Ore",
  NOTA: "Nota (facoltativa)",
  NOTA_PLACEHOLDER: "Motivo o dettagli per l'admin...",
  INVIA_RICHIESTA: "Invia richiesta",
  ANNULLA: "Annulla",
  RICHIESTE_IN_ATTESA: "Richieste in attesa",
  NESSUNA_RICHIESTA_IN_ATTESA: "Nessuna richiesta in attesa",
  APPROVA: "Approva",
  RIFIUTA: "Rifiuta",
  ERRORI: {
    SESSIONE_MANCANTE: "Sessione utente non valida",
    RISPOSTA_NON_VALIDA: "Risposta richieste assenza non valida",
    GENERICO: "Errore caricamento richieste",
    SALVATAGGIO: "Errore invio richiesta",
    AGGIORNAMENTO: "Errore aggiornamento richiesta",
    DATE_OBBLIGATORIE: "Data inizio e data fine sono obbligatorie",
    INTERVALLO_NON_VALIDO: "Data fine precedente alla data inizio",
    ORE_OBBLIGATORIE: "Indica il numero di ore",
    PARZIALE_UN_GIORNO: "Il permesso parziale può riguardare solo un giorno",
    TOKEN_MANCANTE: "Token autenticazione mancante",
    TOKEN_NON_VALIDO: "Token autenticazione non valido",
    ACCESSO_NEGATO: "Accesso non autorizzato",
    NON_TROVATA: "Richiesta non trovata",
  },
  MESSAGGI: {
    INVIATA: "Richiesta inviata, in attesa di approvazione",
    APPROVATA: "Richiesta approvata",
    RIFIUTATA: "Richiesta rifiutata",
  },
} as const;
