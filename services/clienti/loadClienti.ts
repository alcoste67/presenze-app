import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { Cliente } from "@/types/clienti";

type SupabaseClient = typeof supabase;

const SELECT_CLIENTE =
  "id, ragione_sociale, email, telefono, indirizzo, note, attivo, da_verificare, creato_il";

export async function loadClienti({
  soloAttivi = true,
  supabaseClient = supabase,
}: {
  soloAttivi?: boolean;
  supabaseClient?: SupabaseClient;
} = {}): Promise<Cliente[]> {
  let query = supabaseClient
    .from("clienti")
    .select(SELECT_CLIENTE)
    .order("ragione_sociale", { ascending: true });

  if (soloAttivi) {
    query = query.eq("attivo", true);
  }

  const { data, error } = await query;

  if (error) {
    throwErroreSupabase("Lettura clienti", error);
  }

  return (data || []) as Cliente[];
}
