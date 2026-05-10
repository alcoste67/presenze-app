import { supabase } from "@/lib/supabase";
import { Dipendente } from "@/types/dipendenti";

export async function loadDipendenti(): Promise<
  Dipendente[]
> {
  const { data, error } = await supabase
    .from("dipendenti")
    .select(
      "id, nome, cognome, email, ruolo, attivo, auth_user_id, created_at"
    )
    .order("cognome", {
      ascending: true,
    })
    .order("nome", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data || []) as Dipendente[];
}
