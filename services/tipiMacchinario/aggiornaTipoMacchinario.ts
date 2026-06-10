import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { TipoMacchinarioRecord } from "@/types/macchinari";

type SupabaseClient = typeof supabase;

export async function aggiornaTipoMacchinario({
  tipoId,
  nome,
  attivo,
  supabaseClient = supabase,
}: {
  tipoId: string;
  nome?: string;
  attivo?: boolean;
  supabaseClient?: SupabaseClient;
}): Promise<TipoMacchinarioRecord> {
  const patch: Record<string, unknown> = {};
  if (nome !== undefined) patch.nome = nome.trim();
  if (attivo !== undefined) patch.attivo = attivo;

  const { data, error } = await supabaseClient
    .from("tipi_macchinario")
    .update(patch)
    .eq("id", tipoId)
    .select("id, nome, attivo")
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Aggiornamento tipo macchinario", error);
  }

  if (!data) {
    throw new Error("Tipo macchinario non aggiornato");
  }

  return data as TipoMacchinarioRecord;
}
