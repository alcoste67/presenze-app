import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { Macchinario } from "@/types/macchinari";

type SupabaseClient = typeof supabase;

const SELECT_MACCHINARI =
  "id, nome, tipo, descrizione, costo_orario, attivo, created_at, updated_at";

export async function loadMacchinariAdmin({
  supabaseClient = supabase,
}: {
  supabaseClient?: SupabaseClient;
} = {}): Promise<Macchinario[]> {
  const { data, error } = await supabaseClient
    .from("macchinari")
    .select(SELECT_MACCHINARI)
    .order("nome", { ascending: true });

  if (error) {
    throwErroreSupabase(
      "Lettura macchinari admin",
      error
    );
  }

  return (data || []) as Macchinario[];
}
