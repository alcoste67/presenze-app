import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  ModuloFotovoltaico,
  ModuloFotovoltaicoInput,
} from "@/types/moduliFotovoltaici";

type SupabaseClient = typeof supabase;

const SELECT_MODULO_FOTOVOLTAICO =
  "id, marca, modello, potenza_wp, lunghezza_mm, larghezza_mm, spessore_mm, peso_kg, attivo, created_at, updated_at";

export async function creaModuloFotovoltaico({
  modulo,
  supabaseClient = supabase,
}: {
  modulo: ModuloFotovoltaicoInput;
  supabaseClient?: SupabaseClient;
}): Promise<ModuloFotovoltaico> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(supabaseClient, user.id);

  const { data, error } = await supabaseClient
    .from("moduli_fotovoltaici")
    .insert({ ...modulo, azienda_id: aziendaId })
    .select(SELECT_MODULO_FOTOVOLTAICO)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Creazione modulo fotovoltaico", error);
  }

  if (!data) {
    throw new Error("Modulo fotovoltaico non creato");
  }

  return data as ModuloFotovoltaico;
}
