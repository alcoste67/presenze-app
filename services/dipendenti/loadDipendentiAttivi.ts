import { supabase } from "@/lib/supabase";
import type { Dipendente } from "@/types/dipendenti";

export async function loadDipendentiAttivi(): Promise<
  Dipendente[]
> {
  const { data, error } = await supabase
    .from("dipendenti")
    .select(
      "id, nome, cognome, email, ruolo, attivo, tipo_conteggio_ore, auth_user_id, created_at"
    )
    .eq("attivo", true)
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
