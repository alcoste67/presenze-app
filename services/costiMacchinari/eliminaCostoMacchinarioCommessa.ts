import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";

type SupabaseClient = typeof supabase;

export async function eliminaCostoMacchinarioCommessa({
  costoId,
  supabaseClient = supabase,
}: {
  costoId: string;
  supabaseClient?: SupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient
    .from("costi_macchinari_commessa")
    .delete()
    .eq("id", costoId);

  if (error) {
    throwErroreSupabase(
      "Eliminazione costo macchinario",
      error
    );
  }
}
