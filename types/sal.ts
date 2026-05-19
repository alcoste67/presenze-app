import type { SAL_STATI } from "@/constants/sal";

export type StatoSalLavorazione =
  (typeof SAL_STATI)[keyof typeof SAL_STATI];

export type SalLavorazione = {
  id: string;
  cantiere_id: string;
  nome: string;
  ordine: number;
  percentuale_completamento: number;
  stato: StatoSalLavorazione;
};

export type SalCantiere = {
  cantiereId: string;
  avanzamentoTotale: number;
  lavorazioni: SalLavorazione[];
};
