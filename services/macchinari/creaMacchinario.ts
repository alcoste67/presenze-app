import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  Macchinario,
  MacchinarioInput,
} from "@/types/macchinari";

type SupabaseClient = typeof supabase;

const SELECT_MACCHINARIO =
  "id, nome, tipo, descrizione, costo_orario, attivo, created_at, updated_at";

export async function creaMacchinario({
  macchinario,
  supabaseClient = supabase,
}: {
  macchinario: MacchinarioInput;
  supabaseClient?: SupabaseClient;
}): Promise<Macchinario> {
  const { data, error } = await supabaseClient
    .from("macchinari")
    .insert(macchinario)
    .select(SELECT_MACCHINARIO)
    .maybeSingle();

  if (error) {
    throwErroreSupabase(
      "Creazione macchinario",
      error
    );
  }

  if (!data) {
    throw new Error("Macchinario non creato");
  }

  return data as Macchinario;
}
