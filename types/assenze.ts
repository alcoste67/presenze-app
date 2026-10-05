export type TipoAssenza = "FERIE" | "PERMESSO";
// "ALTRO" esiste solo per le giornate compilate dall'admin (vedi
// services/assenze/compilaGiornataVuota.ts): il dipendente non può mai
// richiederlo da sé, per questo RichiestaAssenzaInput resta su TipoAssenza.
export type TipoAssenzaEsteso = TipoAssenza | "ALTRO";
export type StatoRichiestaAssenza =
  | "IN_ATTESA"
  | "APPROVATA"
  | "RIFIUTATA"
  | "ANNULLATA";

export type RichiestaAssenza = {
  id: string;
  dipendenteId: string;
  dipendenteNome: string;
  tipo: TipoAssenzaEsteso;
  dataInizio: string;
  dataFine: string;
  giornataIntera: boolean;
  ore: number | null;
  stato: StatoRichiestaAssenza;
  nota: string;
  approvataDaId: string | null;
  approvataIl: string | null;
  annullataDaId: string | null;
  annullataIl: string | null;
  createdAt: string;
};

export type RichiestaAssenzaInput = {
  tipo: TipoAssenza;
  dataInizio: string;
  dataFine: string;
  giornataIntera: boolean;
  ore: number | null;
  nota: string;
};
