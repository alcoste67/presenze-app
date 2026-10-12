import type { SupabaseClient } from "@supabase/supabase-js";

import type { StatoNotaSpesa } from "@/types/noteSpese";

export async function aggiornaStatoNotaSpesa({
  notaId,
  aziendaId,
  stato,
  notaRifiuto,
  approvataDa,
  supabaseClient,
}: {
  notaId: string;
  aziendaId: string;
  stato: Extract<StatoNotaSpesa, "APPROVATA" | "RIFIUTATA">;
  notaRifiuto: string;
  approvataDa: string;
  supabaseClient: SupabaseClient;
}): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from("note_spese")
    .update({
      stato,
      nota_rifiuto: notaRifiuto,
      approvata_da: approvataDa,
      approvata_il: new Date().toISOString(),
    })
    .eq("id", notaId)
    .eq("azienda_id", aziendaId)
    .eq("stato", "IN_ATTESA")
    .select("id")
    .maybeSingle();

  if (error) throw error;

  return Boolean(data);
}
