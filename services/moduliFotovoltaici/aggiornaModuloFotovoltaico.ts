import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  ModuloFotovoltaico,
  ModuloFotovoltaicoInput,
} from "@/types/moduliFotovoltaici";

type SupabaseClient = typeof supabase;

const SELECT_MODULO_FOTOVOLTAICO =
  "id, marca, modello, potenza_wp, lunghezza_mm, larghezza_mm, spessore_mm, peso_kg, attivo, created_at, updated_at";

export async function aggiornaModuloFotovoltaico({
  moduloId,
  modulo,
  supabaseClient = supabase,
}: {
  moduloId: string;
  modulo: ModuloFotovoltaicoInput;
  supabaseClient?: SupabaseClient;
}): Promise<ModuloFotovoltaico> {
  const { data, error } = await supabaseClient
    .from("moduli_fotovoltaici")
    .update({ ...modulo, updated_at: new Date().toISOString() })
    .eq("id", moduloId)
    .select(SELECT_MODULO_FOTOVOLTAICO)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Aggiornamento modulo fotovoltaico", error);
  }

  if (!data) {
    throw new Error("Modulo fotovoltaico non aggiornato");
  }

  return data as ModuloFotovoltaico;
}
