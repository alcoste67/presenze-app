export type TipoSpesa = "PASTO" | "MATERIALE" | "FATTURA" | "ALTRO";
export type StatoNotaSpesa = "IN_ATTESA" | "APPROVATA" | "RIFIUTATA";

export type NotaSpesa = {
  id: string;
  dipendenteId: string;
  dipendenteNome: string;
  data: string;
  tipo: TipoSpesa;
  importo: number;
  descrizione: string;
  fotoScontrinoPath: string;
  stato: StatoNotaSpesa;
  notaRifiuto: string;
  approvataDaId: string | null;
  approvataIl: string | null;
  createdAt: string;
};

export type NotaSpesaInput = {
  data: string;
  tipo: TipoSpesa;
  importo: number;
  descrizione: string;
  fotoScontrinoPath: string;
};

export type NotaChilometri = {
  id: string;
  dipendenteId: string;
  data: string;
  km: number;
};
