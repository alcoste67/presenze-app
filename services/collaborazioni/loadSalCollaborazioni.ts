import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";

type SupabaseClient = typeof supabase;

export type LavorazioneCollaboratore = {
  azienda_collaboratrice_nome: string;
  cantiere_collaboratore_nome: string;
  lavorazione_nome: string;
  percentuale_completamento: number;
};

/**
 * Lavorazioni + % del subappaltatore per il SAL unico del committente.
 * Sola lettura via RPC SECURITY DEFINER: nessun dato economico.
 */
export async function loadSalCollaborazioni({
  cantiereCommittenteId,
  supabaseClient = supabase,
}: {
  cantiereCommittenteId: string;
  supabaseClient?: SupabaseClient;
}): Promise<LavorazioneCollaboratore[]> {
  if (!cantiereCommittenteId) return [];

  const { data, error } = await supabaseClient.rpc(
    "sal_collaborazioni_cantiere",
    { cantiere_committente: cantiereCommittenteId }
  );

  if (error) {
    throwErroreSupabase("Lettura SAL collaborazioni", error);
  }

  return (data || []) as LavorazioneCollaboratore[];
}
