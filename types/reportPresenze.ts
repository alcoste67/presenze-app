import type { TipoAttivita } from "@/types/attivita";
import type { TipoTimbratura } from "@/types/timbrature";

export type PresenzeReportFiltri = {
  dipendenteId: string | null;
  cantiereId: string | null;
  dataInizio: string;
  dataFine: string;
};

export type PresenzeReportRiga = {
  id: string;
  created_at: string;
  data: string;
  ora: string;
  dipendente: string;
  email: string;
  tipo: TipoTimbratura;
  tipoLabel: string;
  destinazione: string;
  cantiere: string;
  attivita: string;
  attivitaTipo: TipoAttivita | null;
};

export type PresenzeReportRisposta = {
  righe: PresenzeReportRiga[];
  limiteRighe: number;
  limiteRaggiunto: boolean;
};
