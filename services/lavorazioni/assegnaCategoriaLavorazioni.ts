import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { LavorazioneCantiere } from "@/types/lavorazioni";

type SupabaseClient = typeof supabase;

const SELECT_LAVORAZIONE_CANTIERE =
  "id, cantiere_id, nome, ordine, attiva, percentuale_completamento, quantita, prezzo_unitario, unita_misura, categoria, subappaltata_a_collaborazione_id, created_at";

// Assegna (o azzera) la macro-area a più lavorazioni in un colpo solo.
// categoria = null per togliere l'etichetta.
export async function assegnaCategoriaLavorazioni({
  lavorazioneIds,
  categoria,
  supabaseClient = supabase,
}: {
  lavorazioneIds: string[];
  categoria: string | null;
  supabaseClient?: SupabaseClient;
}): Promise<LavorazioneCantiere[]> {
  if (lavorazioneIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("lavorazioni_cantiere")
    .update({ categoria: categoria?.trim() || null })
    .in("id", lavorazioneIds)
    .select(SELECT_LAVORAZIONE_CANTIERE);

  if (error) {
    throwErroreSupabase("Assegnazione categoria lavorazioni", error);
  }

  return (data || []) as LavorazioneCantiere[];
}
