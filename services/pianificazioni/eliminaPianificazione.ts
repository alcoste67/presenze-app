import type { SupabaseClient } from "@supabase/supabase-js";

export async function eliminaPianificazione({
  pianificazioneId,
  aziendaId,
  supabaseClient,
}: {
  pianificazioneId: string;
  aziendaId: string;
  supabaseClient: SupabaseClient;
}): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from("pianificazioni_lavoro")
    .delete()
    .eq("id", pianificazioneId)
    .eq("azienda_id", aziendaId)
    .select("id")
    .maybeSingle();

  if (error) throw error;

  return Boolean(data);
}
