import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { Cliente, ClienteInput } from "@/types/clienti";

type SupabaseClient = typeof supabase;

const SELECT_CLIENTE =
  "id, ragione_sociale, email, telefono, indirizzo, note, attivo, da_verificare, creato_il";

export async function aggiornaCliente({
  clienteId,
  cliente,
  supabaseClient = supabase,
}: {
  clienteId: string;
  cliente: Partial<ClienteInput>;
  supabaseClient?: SupabaseClient;
}): Promise<Cliente> {
  const { data, error } = await supabaseClient
    .from("clienti")
    .update(cliente)
    .eq("id", clienteId)
    .select(SELECT_CLIENTE)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Aggiornamento cliente", error);
  }

  if (!data) {
    throw new Error("Cliente non aggiornato");
  }

  return data as Cliente;
}
