import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { ModuloFotovoltaico } from "@/types/moduliFotovoltaici";

type SupabaseClient = typeof supabase;

const SELECT_MODULO_FOTOVOLTAICO =
  "id, marca, modello, potenza_wp, lunghezza_mm, larghezza_mm, spessore_mm, peso_kg, attivo, created_at, updated_at";

export async function loadModuliFotovoltaiciAdmin({
  supabaseClient = supabase,
}: {
  supabaseClient?: SupabaseClient;
} = {}): Promise<ModuloFotovoltaico[]> {
  const { data, error } = await supabaseClient
    .from("moduli_fotovoltaici")
    .select(SELECT_MODULO_FOTOVOLTAICO)
    .order("marca", { ascending: true })
    .order("modello", { ascending: true });

  if (error) {
    throwErroreSupabase("Lettura moduli fotovoltaici", error);
  }

  return (data || []) as ModuloFotovoltaico[];
}
