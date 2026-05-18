export type LibroPresenzeReportFiltri = {
  dipendenteId: string | null;
  cantiereId: string | null;
  dataInizio: string;
  dataFine: string;
};

export type LibroPresenzeReportRiga = {
  id: string;
  giorno: string;
  giornoIso: string;
  dipendente: string;
  email: string;
  entrata: string;
  uscita: string;
  totaleMinutiReali: number;
  totaleOreReali: string;
  minutiPaghe: number;
  orePaghe: string;
  cantiereAttivita: string;
  note: string;
};

export type LibroPresenzeReportRisposta = {
  righe: LibroPresenzeReportRiga[];
  limiteRighe: number;
  limiteRaggiunto: boolean;
};
