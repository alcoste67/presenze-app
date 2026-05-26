import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  Macchinario,
  MacchinarioInput,
} from "@/types/macchinari";

type SupabaseClient = typeof supabase;

const SELECT_MACCHINARIO =
  "id, nome, tipo, descrizione, costo_orario, attivo, created_at, updated_at";

export async function aggiornaMacchinario({
  macchinarioId,
  macchinario,
  supabaseClient = supabase,
}: {
  macchinarioId: string;
  macchinario: MacchinarioInput;
  supabaseClient?: SupabaseClient;
}): Promise<Macchinario> {
  const { data, error } = await supabaseClient
    .from("macchinari")
    .update({
      ...macchinario,
      updated_at: new Date().toISOString(),
    })
    .eq("id", macchinarioId)
    .select(SELECT_MACCHINARIO)
    .maybeSingle();

  if (error) {
    throwErroreSupabase(
      "Aggiornamento macchinario",
      error
    );
  }

  if (!data) {
    throw new Error("Macchinario non aggiornato");
  }

  return data as Macchinario;
}
