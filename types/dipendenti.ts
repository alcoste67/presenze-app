import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";

export type RuoloDipendente =
  (typeof RUOLI_DIPENDENTE)[keyof typeof RUOLI_DIPENDENTE];

export type Dipendente = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: RuoloDipendente;
  attivo: boolean;
  auth_user_id: string | null;
  created_at: string;
};

export type DipendenteInput = {
  nome: string;
  cognome: string;
  email: string;
  ruolo: RuoloDipendente;
  attivo: boolean;
};
