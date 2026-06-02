import type { SupabaseClient } from "@supabase/supabase-js";

/** Ritorna azienda_id del dipendente associato a auth_user_id. Lancia errore se non trovato o non attivo. */
export async function getAziendaIdFromAuthUser(
  supabase: SupabaseClient,
  authUserId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("dipendenti")
    .select("azienda_id")
    .eq("auth_user_id", authUserId)
    .eq("attivo", true)
    .single();

  if (error || !data?.azienda_id) {
    throw new Error(
      "Azienda non determinabile per utente autenticato"
    );
  }

  return data.azienda_id as string;
}
