import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";

type SupabaseClient = typeof supabase;

export async function eliminaModuloFotovoltaico({
  moduloId,
  supabaseClient = supabase,
}: {
  moduloId: string;
  supabaseClient?: SupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient
    .from("moduli_fotovoltaici")
    .delete()
    .eq("id", moduloId);

  if (error) {
    throwErroreSupabase("Eliminazione modulo fotovoltaico", error);
  }
}
