import { TipoAttivita } from "@/types/attivita";

export type TipoTimbratura =
  | "ENTRATA"
  | "PAUSA"
  | "RIENTRO"
  | "USCITA";

export type StatoLavoratore =
  | "FUORI"
  | "DENTRO"
  | "IN_PAUSA";

export interface Timbratura {
  id: string;
  user_id: string;
  cantiere_id: string | null;
  attivita_tipo?: TipoAttivita | null;
  tipo: TipoTimbratura;
  timestamp: string;
  lat?: number | null;
  lng?: number | null;
  note?: string | null;
  created_at: string;
}
