// Catalogo dei moduli di /backoffice gestibili dal toggle superadmin
// (piano_moduli / azienda_moduli_override). Checklist Wall Box NON è qui:
// resta sul suo meccanismo dedicato (lib/wallboxAccess.ts), specifico per
// una singola azienda e non legato al concetto di piano.
export const MODULI_BACKOFFICE = {
  DIPENDENTI: "dipendenti",
  CANTIERI: "cantieri",
  CLIENTI: "clienti",
  COLLABORAZIONI: "collaborazioni",
  MACCHINARI: "macchinari",
  LAVORAZIONI: "lavorazioni",
  CATEGORIE: "categorie",
  RAPPORTI_INTERVENTO: "rapporti-intervento",
  COMMESSA: "commessa",
  CALENDARIO: "calendario",
  SAL: "sal",
  SAL_FREEZE: "sal-freeze",
  PRODUTTIVITA: "produttivita",
  PRESENZE: "presenze",
  LIBRO_PRESENZE: "libro-presenze",
  COSTI_MACCHINARI: "costi-macchinari",
  CONTROLLO_COSTI: "controllo-costi",
} as const;

export type ModuloBackoffice =
  (typeof MODULI_BACKOFFICE)[keyof typeof MODULI_BACKOFFICE];

export const LABEL_MODULI_BACKOFFICE: Record<ModuloBackoffice, string> = {
  [MODULI_BACKOFFICE.DIPENDENTI]: "Dipendenti",
  [MODULI_BACKOFFICE.CANTIERI]: "Cantieri",
  [MODULI_BACKOFFICE.CLIENTI]: "Clienti",
  [MODULI_BACKOFFICE.COLLABORAZIONI]: "Collaborazioni",
  [MODULI_BACKOFFICE.MACCHINARI]: "Macchinari (anagrafica)",
  [MODULI_BACKOFFICE.LAVORAZIONI]: "Lavorazioni",
  [MODULI_BACKOFFICE.CATEGORIE]: "Categorie lavorazioni",
  [MODULI_BACKOFFICE.RAPPORTI_INTERVENTO]: "Rapporti intervento",
  [MODULI_BACKOFFICE.COMMESSA]: "Commessa",
  [MODULI_BACKOFFICE.CALENDARIO]: "Calendario lavori",
  [MODULI_BACKOFFICE.SAL]: "SAL corrente",
  [MODULI_BACKOFFICE.SAL_FREEZE]: "SAL freeze",
  [MODULI_BACKOFFICE.PRODUTTIVITA]: "Produttività",
  [MODULI_BACKOFFICE.PRESENZE]: "Report presenze",
  [MODULI_BACKOFFICE.LIBRO_PRESENZE]: "Libro presenze",
  [MODULI_BACKOFFICE.COSTI_MACCHINARI]: "Costi macchinari",
  [MODULI_BACKOFFICE.CONTROLLO_COSTI]: "Controllo costi",
};

export const PIANI_ABBONAMENTO = ["base", "pro", "enterprise"] as const;
export type PianoAbbonamento = (typeof PIANI_ABBONAMENTO)[number];

export const LABEL_PIANI_ABBONAMENTO: Record<PianoAbbonamento, string> = {
  base: "Base",
  pro: "Pro",
  enterprise: "Enterprise",
};
