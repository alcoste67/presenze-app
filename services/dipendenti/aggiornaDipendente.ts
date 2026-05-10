import { supabase } from "@/lib/supabase";
import {
  Dipendente,
  DipendenteInput,
} from "@/types/dipendenti";

type Params = {
  dipendenteId: string;
  dipendente: DipendenteInput;
};

export async function aggiornaDipendente({
  dipendenteId,
  dipendente,
}: Params): Promise<Dipendente> {
  const { data, error } = await supabase
    .from("dipendenti")
    .update({
      nome: dipendente.nome,
      cognome: dipendente.cognome,
      email: dipendente.email,
      ruolo: dipendente.ruolo,
      attivo: dipendente.attivo,
    })
    .eq("id", dipendenteId)
    .select(
      "id, nome, cognome, email, ruolo, attivo, auth_user_id, created_at"
    )
    .single();

  if (error) {
    throw error;
  }

  return data as Dipendente;
}
