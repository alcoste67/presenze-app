export type ReportPagheFiltri = {
  anno: number;
  mese: number;
  dipendenteId: string | null;
};

export type ReportPagheGiorno = {
  giorno: number;
  valore: string;
};

export type ReportPagheRiga = {
  dipendenteId: string;
  dipendente: string;
  giorni: ReportPagheGiorno[];
  totaleOrePaghe: string;
};

export type ReportPagheRisposta = {
  righe: ReportPagheRiga[];
  numeroGiorni: number;
  limiteRaggiunto: boolean;
};
