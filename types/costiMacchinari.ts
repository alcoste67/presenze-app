import type { TIPI_MACCHINARIO } from "@/constants/macchinari";

export type TipoMacchinario =
  (typeof TIPI_MACCHINARIO)[keyof typeof TIPI_MACCHINARIO];

export type CostoMacchinarioCommessa = {
  id: string;
  cantiere_id: string;
  rapporto_intervento_id: string | null;
  tipo_macchinario: TipoMacchinario;
  descrizione: string;
  data_utilizzo: string;
  ore_utilizzo: number;
  tariffa_oraria: number | null;
  costo_totale: number | null;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CostoMacchinarioCommessaInput = {
  cantiere_id: string;
  rapporto_intervento_id: string | null;
  tipo_macchinario: TipoMacchinario;
  descrizione: string;
  data_utilizzo: string;
  ore_utilizzo: number;
  tariffa_oraria: number | null;
  costo_totale: number | null;
  note: string;
};
