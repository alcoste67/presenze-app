export type Cliente = {
  id: string;
  ragione_sociale: string;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  note: string;
  attivo: boolean;
  creato_il: string;
};

export type ClienteInput = {
  ragione_sociale: string;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  note: string;
  attivo: boolean;
};
