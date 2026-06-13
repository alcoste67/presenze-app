import { supabase } from "@/lib/supabase";

type SupabaseClient = typeof supabase;

/** Spegne le "spie" di novità del proprio lato (apertura pagina collaborazioni). */
export async function segnaCollaborazioniViste({
  supabaseClient = supabase,
}: {
  supabaseClient?: SupabaseClient;
} = {}): Promise<void> {
  await supabaseClient.rpc("segna_collaborazioni_viste");
}
