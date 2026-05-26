import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { CostoMacchinarioCommessa } from "@/types/costiMacchinari";

type SupabaseClient = typeof supabase;

const SELECT_COSTI_MACCHINARI =
  "id, cantiere_id, rapporto_intervento_id, tipo_macchinario, descrizione, data_utilizzo, ore_utilizzo, tariffa_oraria, costo_totale, note, created_by, created_at, updated_at";

export async function loadCostiMacchinariCommessa({
  cantiereId,
  supabaseClient = supabase,
}: {
  cantiereId: string;
  supabaseClient?: SupabaseClient;
}): Promise<CostoMacchinarioCommessa[]> {
  if (!cantiereId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("costi_macchinari_commessa")
    .select(SELECT_COSTI_MACCHINARI)
    .eq("cantiere_id", cantiereId)
    .order("data_utilizzo", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throwErroreSupabase(
      "Lettura costi macchinari",
      error
    );
  }

  return (
    data || []
  ) as CostoMacchinarioCommessa[];
}
