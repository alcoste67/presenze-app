import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  CostoMacchinarioCommessa,
  CostoMacchinarioCommessaInput,
} from "@/types/costiMacchinari";

type SupabaseClient = typeof supabase;

const SELECT_COSTI_MACCHINARI =
  "id, cantiere_id, rapporto_intervento_id, tipo_macchinario, descrizione, data_utilizzo, ore_utilizzo, tariffa_oraria, costo_totale, note, created_by, created_at, updated_at";

export async function creaCostoMacchinarioCommessa({
  costo,
  supabaseClient = supabase,
}: {
  costo: CostoMacchinarioCommessaInput;
  supabaseClient?: SupabaseClient;
}): Promise<CostoMacchinarioCommessa> {
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError) {
    throwErroreSupabase(
      "Lettura utente costi macchinari",
      authError
    );
  }

  const { data, error } = await supabaseClient
    .from("costi_macchinari_commessa")
    .insert({
      ...costo,
      created_by: user?.id || null,
    })
    .select(SELECT_COSTI_MACCHINARI)
    .maybeSingle();

  if (error) {
    throwErroreSupabase(
      "Salvataggio costo macchinario",
      error
    );
  }

  if (!data) {
    throw new Error(
      "Costo macchinario non creato"
    );
  }

  return data as CostoMacchinarioCommessa;
}
