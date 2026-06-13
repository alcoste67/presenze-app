import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";

type SupabaseClient = typeof supabase;

/**
 * Assegna (o rimuove) la lavorazione a una collaborazione/subappaltatore.
 * collaborazioneId = null → la voce resta interna all'appaltatore.
 */
export async function assegnaSubappalto({
  lavorazioneId,
  collaborazioneId,
  supabaseClient = supabase,
}: {
  lavorazioneId: string;
  collaborazioneId: string | null;
  supabaseClient?: SupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient
    .from("lavorazioni_cantiere")
    .update({ subappaltata_a_collaborazione_id: collaborazioneId })
    .eq("id", lavorazioneId);

  if (error) {
    throwErroreSupabase("Assegnazione subappalto", error);
  }
}
