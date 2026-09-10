import type { SupabaseClient } from "@supabase/supabase-js";

import type { StatoRichiestaAssenza } from "@/types/assenze";

export async function aggiornaStatoRichiesta({
  richiestaId,
  aziendaId,
  stato,
  approvataDa,
  supabaseClient,
}: {
  richiestaId: string;
  aziendaId: string;
  stato: Extract<StatoRichiestaAssenza, "APPROVATA" | "RIFIUTATA">;
  approvataDa: string;
  supabaseClient: SupabaseClient;
}): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from("richieste_assenza")
    .update({
      stato,
      approvata_da: approvataDa,
      approvata_il: new Date().toISOString(),
    })
    .eq("id", richiestaId)
    .eq("azienda_id", aziendaId)
    .select("id")
    .maybeSingle();

  if (error) throw error;

  return Boolean(data);
}
