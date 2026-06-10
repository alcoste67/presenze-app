import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { TipoMacchinarioRecord } from "@/types/macchinari";

type SupabaseClient = typeof supabase;

export async function creaTipoMacchinario({
  nome,
  supabaseClient = supabase,
}: {
  nome: string;
  supabaseClient?: SupabaseClient;
}): Promise<TipoMacchinarioRecord> {
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
    .from("tipi_macchinario")
    .insert({ nome: nome.trim(), azienda_id: aziendaId })
    .select("id, nome, attivo")
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Creazione tipo macchinario", error);
  }

  if (!data) {
    throw new Error("Tipo macchinario non creato");
  }

  return data as TipoMacchinarioRecord;
}
