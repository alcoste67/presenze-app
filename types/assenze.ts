export type TipoAssenza = "FERIE" | "PERMESSO";
export type StatoRichiestaAssenza =
  | "IN_ATTESA"
  | "APPROVATA"
  | "RIFIUTATA"
  | "ANNULLATA";

export type RichiestaAssenza = {
  id: string;
  dipendenteId: string;
  dipendenteNome: string;
  tipo: TipoAssenza;
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
