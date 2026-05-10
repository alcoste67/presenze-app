export type Cantiere = {
  id: string;
  nome: string;
};

export type CantiereBackoffice = Cantiere & {
  indirizzo: string;
  lavorazioni: string;
  attivo: boolean;
};

export type CantiereInput = {
  nome: string;
  indirizzo: string;
  lavorazioni: string;
  attivo: boolean;
};
