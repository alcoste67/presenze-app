import type { SupabaseClient } from "@supabase/supabase-js";

export async function annullaRichiesta({
  richiestaId,
  aziendaId,
  annullataDa,
  supabaseClient,
}: {
  richiestaId: string;
  aziendaId: string;
  annullataDa: string;
  supabaseClient: SupabaseClient;
}): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from("richieste_assenza")
    .update({
      stato: "ANNULLATA",
      annullata_da: annullataDa,
      annullata_il: new Date().toISOString(),
    })
    .eq("id", richiestaId)
    .eq("azienda_id", aziendaId)
    .in("stato", ["IN_ATTESA", "APPROVATA"])
    .select("id")
    .maybeSingle();

  if (error) throw error;

  return Boolean(data);
}
