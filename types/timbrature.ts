import {
  STATI,
  TIMBRATURE,
} from "@/constants/stati";
import { TipoAttivita } from "@/types/attivita";

export type TipoTimbratura =
  (typeof TIMBRATURE)[keyof typeof TIMBRATURE];

export type StatoLavoratore =
  (typeof STATI)[keyof typeof STATI];

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
