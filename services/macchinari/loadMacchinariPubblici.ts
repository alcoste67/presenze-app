import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { MacchinarioPubblico } from "@/types/macchinari";

type SupabaseClient = typeof supabase;

const SELECT_MACCHINARI_PUBBLICI =
  "id, nome, tipo, descrizione, attivo";

export async function loadMacchinariPubblici({
  supabaseClient = supabase,
}: {
  supabaseClient?: SupabaseClient;
} = {}): Promise<MacchinarioPubblico[]> {
  const { data, error } = await supabaseClient
    .from("macchinari_pubblici")
    .select(SELECT_MACCHINARI_PUBBLICI)
    .order("nome", { ascending: true });

  if (error) {
    throwErroreSupabase(
      "Lettura macchinari pubblici",
      error
    );
  }

  return (data || []) as MacchinarioPubblico[];
}
