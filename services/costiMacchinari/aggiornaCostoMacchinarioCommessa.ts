import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  CostoMacchinarioCommessa,
  CostoMacchinarioCommessaInput,
} from "@/types/costiMacchinari";

type SupabaseClient = typeof supabase;

const SELECT_COSTI_MACCHINARI =
  "id, cantiere_id, rapporto_intervento_id, tipo_macchinario, descrizione, data_utilizzo, ore_utilizzo, tariffa_oraria, costo_totale, note, created_by, created_at, updated_at";

export async function aggiornaCostoMacchinarioCommessa({
  costoId,
  costo,
  supabaseClient = supabase,
}: {
  costoId: string;
  costo: CostoMacchinarioCommessaInput;
  supabaseClient?: SupabaseClient;
}): Promise<CostoMacchinarioCommessa> {
  const { data, error } = await supabaseClient
    .from("costi_macchinari_commessa")
    .update({
      ...costo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", costoId)
    .select(SELECT_COSTI_MACCHINARI)
    .maybeSingle();

  if (error) {
    throwErroreSupabase(
      "Aggiornamento costo macchinario",
      error
    );
  }

  if (!data) {
    throw new Error(
      "Costo macchinario non aggiornato"
    );
  }

  return data as CostoMacchinarioCommessa;
}
