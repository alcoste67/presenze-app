import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";

type SupabaseClient = typeof supabase;

export type EsitoInvioLavorazioni = {
  inviate: number;
  rimosse: number;
  bloccate: number;
};

/**
 * Sincronizza le lavorazioni assegnate verso il cantiere del
 * subappaltatore. Ritorna i conteggi: inviate/aggiornate, rimosse (voci
 * a 0% non più assegnate), bloccate (disassegnate ma avanzate >0%, non
 * rimosse per non perdere l'avanzamento del subappaltatore).
 */
export async function inviaLavorazioniSubappaltatore({
  collaborazioneId,
  supabaseClient = supabase,
}: {
  collaborazioneId: string;
  supabaseClient?: SupabaseClient;
}): Promise<EsitoInvioLavorazioni> {
  const { data, error } = await supabaseClient.rpc(
    "invia_lavorazioni_subappaltatore",
    { collaborazione_id: collaborazioneId }
  );

  if (error) {
    throwErroreSupabase("Invio lavorazioni subappaltatore", error);
  }

  const esito = (data || {}) as Partial<EsitoInvioLavorazioni>;
  return {
    inviate: esito.inviate ?? 0,
    rimosse: esito.rimosse ?? 0,
    bloccate: esito.bloccate ?? 0,
  };
}
