import { supabase } from "@/lib/supabase";

type SupabaseClient = typeof supabase;

/**
 * Riassegna una timbratura fatta su attività "Cantiere nuovo" al
 * cantiere appena creato (le ore finiscono sul cantiere, non
 * sull'attività generica).
 */
export async function assegnaCantiereTimbratura({
  timbraturaId,
  cantiereId,
  supabaseClient = supabase,
}: {
  timbraturaId: string;
  cantiereId: string;
  supabaseClient?: SupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient
    .from("timbrature")
    .update({ cantiere_id: cantiereId, attivita_tipo: null })
    .eq("id", timbraturaId);

  if (error) {
    throw error;
  }
}
