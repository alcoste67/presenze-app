import type { SupabaseClient } from "@supabase/supabase-js";

import type { RichiestaAssenzaInput } from "@/types/assenze";

export async function creaRichiestaAssenza({
  aziendaId,
  dipendenteId,
  input,
  supabaseClient,
}: {
  aziendaId: string;
  dipendenteId: string;
  input: RichiestaAssenzaInput;
  supabaseClient: SupabaseClient;
}): Promise<string> {
  const { data, error } = await supabaseClient
    .from("richieste_assenza")
    .insert({
      azienda_id: aziendaId,
      dipendente_id: dipendenteId,
      tipo: input.tipo,
      data_inizio: input.dataInizio,
      data_fine: input.dataFine,
      giornata_intera: input.giornataIntera,
      ore: input.giornataIntera ? null : input.ore,
      nota: input.nota,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error || new Error("Inserimento richiesta assenza fallito");
  }

  return data.id as string;
}
