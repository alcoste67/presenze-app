import type { TIPI_MACCHINARIO } from "@/constants/macchinari";

export type TipoMacchinario =
  (typeof TIPI_MACCHINARIO)[keyof typeof TIPI_MACCHINARIO];

export type Macchinario = {
  id: string;
  nome: string;
  tipo: TipoMacchinario;
  descrizione: string;
  costo_orario: number | null;
  attivo: boolean;
  created_at: string;
  updated_at: string;
};

export type MacchinarioPubblico = Pick<
  Macchinario,
  "id" | "nome" | "tipo" | "descrizione" | "attivo"
>;

export type MacchinarioInput = {
  nome: string;
  tipo: TipoMacchinario;
  descrizione: string;
  costo_orario: number | null;
  attivo: boolean;
};
