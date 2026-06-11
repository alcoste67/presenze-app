import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { Cliente } from "@/types/clienti";

type SupabaseClient = typeof supabase;

/** Anti-doppioni soft: clienti con ragione sociale simile (pg_trgm). */
export async function cercaClientiSimili({
  nome,
  supabaseClient = supabase,
}: {
  nome: string;
  supabaseClient?: SupabaseClient;
}): Promise<Cliente[]> {
  const { data, error } = await supabaseClient.rpc(
    "cerca_clienti_simili",
    { nome: nome.trim() }
  );

  if (error) {
    throwErroreSupabase("Ricerca clienti simili", error);
  }

  return (data || []) as Cliente[];
}
