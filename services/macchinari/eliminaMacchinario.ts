import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";

type SupabaseClient = typeof supabase;

export async function eliminaMacchinario({
  macchinarioId,
  supabaseClient = supabase,
}: {
  macchinarioId: string;
  supabaseClient?: SupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient
    .from("macchinari")
    .delete()
    .eq("id", macchinarioId);

  if (error) {
    throwErroreSupabase(
      "Eliminazione macchinario",
      error
    );
  }
}
