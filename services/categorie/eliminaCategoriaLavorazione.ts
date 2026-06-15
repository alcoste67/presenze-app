import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";

type SupabaseClient = typeof supabase;

export async function eliminaCategoriaLavorazione({
  id,
  supabaseClient = supabase,
}: {
  id: string;
  supabaseClient?: SupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient
    .from("categorie_lavorazione")
    .delete()
    .eq("id", id);

  if (error) {
    throwErroreSupabase("Eliminazione categoria lavorazione", error);
  }
}
