import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { TIPO_CONTEGGIO_ORE } from "@/constants/tipoConteggioOre";

export type RuoloDipendente =
  (typeof RUOLI_DIPENDENTE)[keyof typeof RUOLI_DIPENDENTE];

export type TipoConteggioOre =
  (typeof TIPO_CONTEGGIO_ORE)[keyof typeof TIPO_CONTEGGIO_ORE];

export type Dipendente = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: RuoloDipendente;
  attivo: boolean;
  tipo_conteggio_ore: TipoConteggioOre;
  auth_user_id: string | null;
  created_at: string;
  costo_orario: number | null;
  ral: number | null;
};

export type DipendenteInput = {
  nome: string;
  cognome: string;
  email: string;
  ruolo: RuoloDipendente;
  attivo: boolean;
  tipo_conteggio_ore: TipoConteggioOre;
  costo_orario: number | null;
  ral: number | null;
};
