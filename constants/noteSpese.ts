import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";

export const RUOLI_APPROVA_NOTE_SPESE = [
  RUOLI_DIPENDENTE.ADMIN,
  RUOLI_DIPENDENTE.SUPERADMIN,
] as const;

export const TIPO_SPESA = {
  PASTO: "PASTO",
  MATERIALE: "MATERIALE",
  FATTURA: "FATTURA",
  ALTRO: "ALTRO",
} as const;

export const LABEL_TIPO_SPESA: Record<string, string> = {
  [TIPO_SPESA.PASTO]: "Pasto",
  [TIPO_SPESA.MATERIALE]: "Acquisto materiale",
  [TIPO_SPESA.FATTURA]: "Fattura",
  [TIPO_SPESA.ALTRO]: "Altro",
};

export const STATO_NOTA_SPESA = {
  IN_ATTESA: "IN_ATTESA",
  APPROVATA: "APPROVATA",
  RIFIUTATA: "RIFIUTATA",
} as const;

export const LABEL_STATO_NOTA_SPESA: Record<string, string> = {
  [STATO_NOTA_SPESA.IN_ATTESA]: "In attesa",
  [STATO_NOTA_SPESA.APPROVATA]: "Approvata",
  [STATO_NOTA_SPESA.RIFIUTATA]: "Rifiutata",
};

export const NOTE_SPESE_LIMITI = {
  IMPORTO_MASSIMO: 10_000,
  KM_MASSIMI_GIORNO: 1_000,
} as const;

export const NOTE_SPESE_CRON = {
  // Orario (minuti dalla mezzanotte, ora Italia) del riepilogo
  // giornaliero cumulativo per admin: a fine giornata lavorativa, dopo
  // che la maggior parte dei dipendenti ha già finito il turno.
  SOGLIA_MINUTI_RIEPILOGO: 19 * 60,
} as const;

export const NOTE_SPESE_TESTI = {
  TITOLO: "Note spese e rimborsi chilometrici",
  SOTTOTITOLO: "Registra le spese sostenute e i km percorsi oggi",
  SEZIONE_SPESA: {
    TITOLO: "Nuova spesa",
    ETICHETTA_DATA: "Data",
    ETICHETTA_TIPO: "Tipo spesa",
    ETICHETTA_IMPORTO: "Importo (€)",
    ETICHETTA_DESCRIZIONE: "Descrizione",
    ETICHETTA_FOTO: "Foto scontrino",
    CONFERMA: "Invia spesa",
    INVIATA: "Spesa inviata, in attesa di approvazione",
  },
  SEZIONE_KM: {
    TITOLO: "Chilometri percorsi oggi",
    ETICHETTA_KM: "Km",
    CONFERMA: "Salva chilometri",
    SALVATI: "Chilometri salvati",
  },
  POPUP_KM_USCITA: {
    DESCRIZIONE: "Hai timbrato l'uscita: quanti km hai percorso oggi con la tua auto?",
    PIU_TARDI: "Più tardi",
  },
  SEZIONE_RIMBORSO_PROPRIO: {
    TITOLO: "I miei rimborsi chilometrici",
    MESE: "Mese",
    CERCA: "Cerca",
    CARICAMENTO: "Caricamento...",
    NESSUN_RISULTATO: "Nessun km registrato nel mese selezionato",
    KM_TOTALI: "Km totali",
    RIMBORSO: "Rimborso",
    TARIFFA_NON_IMPOSTATA: "Tariffa non impostata",
  },
  ELENCO: {
    TITOLO: "Le mie spese recenti",
    NESSUNA: "Nessuna spesa registrata",
  },
  ERRORI: {
    GENERICO: "Errore imprevisto",
    NON_AUTORIZZATO: "Non sei autorizzato a questa operazione",
    SESSIONE_MANCANTE: "Sessione utente non valida",
    TOKEN_MANCANTE: "Token autenticazione mancante",
    TOKEN_NON_VALIDO: "Token autenticazione non valido",
    DATA_OBBLIGATORIA: "Indica la data",
    TIPO_OBBLIGATORIO: "Indica il tipo di spesa",
    IMPORTO_NON_VALIDO: "Indica un importo valido",
    FOTO_OBBLIGATORIA: "Allega la foto dello scontrino",
    FOTO_TROPPO_GRANDE: "Foto troppo grande",
    KM_NON_VALIDI: "Indica i km percorsi",
    AUTO_PROPRIA_NON_ABILITATA: "Non sei abilitato a registrare i km",
    SALVATAGGIO: "Errore salvataggio",
    CARICAMENTO: "Errore caricamento",
    NON_TROVATA: "Nota spesa non trovata",
    GIA_GESTITA: "Nota spesa già approvata o rifiutata",
    NOTA_RIFIUTO_OBBLIGATORIA: "Indica il motivo del rifiuto",
  },
} as const;
