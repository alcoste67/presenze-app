import { supabase } from "@/lib/supabase";
import {
  Dipendente,
  DipendenteInput,
} from "@/types/dipendenti";

export async function creaDipendente(
  dipendente: DipendenteInput
): Promise<Dipendente> {
  const { data, error } = await supabase
    .from("dipendenti")
    .insert({
      nome: dipendente.nome,
      cognome: dipendente.cognome,
      email: dipendente.email,
      ruolo: dipendente.ruolo,
      attivo: dipendente.attivo,
    })
    .select(
      "id, nome, cognome, email, ruolo, attivo, auth_user_id, created_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return data as Dipendente;
}
