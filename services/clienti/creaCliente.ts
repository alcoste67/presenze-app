import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { Cliente } from "@/types/clienti";

type SupabaseClient = typeof supabase;

const SELECT_CLIENTE =
  "id, ragione_sociale, email, telefono, indirizzo, note, attivo, creato_il";

export async function creaCliente({
  ragioneSociale,
  email = null,
  telefono = null,
  indirizzo = null,
  note = "",
  supabaseClient = supabase,
}: {
  ragioneSociale: string;
  email?: string | null;
  telefono?: string | null;
  indirizzo?: string | null;
  note?: string;
  supabaseClient?: SupabaseClient;
}): Promise<Cliente> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(
    supabaseClient,
    user.id
  );

  const { data, error } = await supabaseClient
    .from("clienti")
    .insert({
      ragione_sociale: ragioneSociale.trim(),
      email: email?.trim() || null,
      telefono: telefono?.trim() || null,
      indirizzo: indirizzo?.trim() || null,
      note,
      azienda_id: aziendaId,
      creato_da: user.id,
    })
    .select(SELECT_CLIENTE)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Creazione cliente", error);
  }

  if (!data) {
    throw new Error("Cliente non creato");
  }

  return data as Cliente;
}
