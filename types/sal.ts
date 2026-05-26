import type { SAL_STATI } from "@/constants/sal";

export type StatoSalLavorazione =
  (typeof SAL_STATI)[keyof typeof SAL_STATI];

export type SalLavorazione = {
  id: string;
  cantiere_id: string;
  nome: string;
  ordine: number;
  percentuale_completamento: number;
  oreUomoMinuti: number;
  stato: StatoSalLavorazione;
};

export type SalCantiere = {
  cantiereId: string;
  avanzamentoTotale: number;
  oreUomoTotaliMinuti: number;
  lavorazioni: SalLavorazione[];
};

export type SalLavorazioneFoto = {
  id: string;
  cantiere_id: string;
  lavorazione_id: string | null;
  timbratura_id: string | null;
  data_riferimento: string;
  immagine_data_url: string;
  descrizione: string;
  created_by: string | null;
  created_at: string;
};

export type SalLavorazioneFotoInput = {
  cantiere_id: string;
  lavorazione_id: string | null;
  timbratura_id: string | null;
  data_riferimento: string;
  immagine_data_url: string;
  descrizione: string;
};
