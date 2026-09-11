import type { SupabaseClient } from "@supabase/supabase-js";

/** true se il dipendente ha un'assenza (ferie/permesso) approvata a giornata intera che copre la data indicata. */
export async function haAssenzaGiornataIntera({
  dipendenteId,
  data,
  supabaseClient,
}: {
  dipendenteId: string;
  data: string;
  supabaseClient: SupabaseClient;
}): Promise<boolean> {
  const { data: righe, error } = await supabaseClient
    .from("richieste_assenza")
    .select("id")
    .eq("dipendente_id", dipendenteId)
    .eq("stato", "APPROVATA")
    .eq("giornata_intera", true)
    .lte("data_inizio", data)
    .gte("data_fine", data)
    .limit(1);

  if (error) throw error;

  return (righe || []).length > 0;
}
