export type Cantiere = {
  id: string;
  nome: string;
};

export type CantiereBackoffice = Cantiere & {
  indirizzo: string;
  lavorazioni: string;
  attivo: boolean;
  cliente_id?: string | null;
};

export type CantiereInput = {
  nome: string;
  indirizzo: string;
  lavorazioni: string;
  attivo: boolean;
  cliente_id: string | null;
};
