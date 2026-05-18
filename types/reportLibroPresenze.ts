export type LibroPresenzeReportFiltri = {
  dipendenteId: string | null;
  cantiereId: string | null;
  dataInizio: string;
  dataFine: string;
};

export type LibroPresenzeReportRiga = {
  id: string;
  data: string;
  dipendente: string;
  orePaghe: string;
  cantiereAttivita: string;
  note: string;
};

export type LibroPresenzeReportRisposta = {
  righe: LibroPresenzeReportRiga[];
  limiteRighe: number;
  limiteRaggiunto: boolean;
};
