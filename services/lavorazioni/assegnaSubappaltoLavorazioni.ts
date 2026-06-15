import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { LavorazioneCantiere } from "@/types/lavorazioni";

type SupabaseClient = typeof supabase;

const SELECT_LAVORAZIONE_CANTIERE =
  "id, cantiere_id, nome, ordine, attiva, percentuale_completamento, quantita, prezzo_unitario, unita_misura, categoria, subappaltata_a_collaborazione_id, created_at";

// Assegna (o rimuove, con collaborazioneId = null) più lavorazioni a un
// subappaltatore in un colpo solo.
export async function assegnaSubappaltoLavorazioni({
  lavorazioneIds,
  collaborazioneId,
  supabaseClient = supabase,
}: {
  lavorazioneIds: string[];
  collaborazioneId: string | null;
  supabaseClient?: SupabaseClient;
}): Promise<LavorazioneCantiere[]> {
  if (lavorazioneIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("lavorazioni_cantiere")
    .update({ subappaltata_a_collaborazione_id: collaborazioneId })
    .in("id", lavorazioneIds)
    .select(SELECT_LAVORAZIONE_CANTIERE);

  if (error) {
    throwErroreSupabase("Assegnazione subappalto lavorazioni", error);
  }

  return (data || []) as LavorazioneCantiere[];
}
