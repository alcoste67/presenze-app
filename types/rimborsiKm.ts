export type RimborsoKmRiga = {
  dipendenteId: string;
  dipendente: string;
  veicoloDescrizione: string;
  kmTotali: number;
  tariffaKmRimborso: number | null;
  rimborso: number | null;
};

export type RimborsiKmMensiliRisposta = {
  anno: number;
  mese: number;
  righe: RimborsoKmRiga[];
};
