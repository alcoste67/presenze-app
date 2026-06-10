import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { TipoMacchinarioRecord } from "@/types/macchinari";

type SupabaseClient = typeof supabase;

export async function loadTipiMacchinario({
  soloAttivi = false,
  supabaseClient = supabase,
}: {
  soloAttivi?: boolean;
  supabaseClient?: SupabaseClient;
} = {}): Promise<TipoMacchinarioRecord[]> {
  let query = supabaseClient
    .from("tipi_macchinario")
    .select("id, nome, attivo")
    .order("nome", { ascending: true });

  if (soloAttivi) {
    query = query.eq("attivo", true);
  }

  const { data, error } = await query;

  if (error) {
    throwErroreSupabase("Lettura tipi macchinario", error);
  }

  return (data || []) as TipoMacchinarioRecord[];
}
