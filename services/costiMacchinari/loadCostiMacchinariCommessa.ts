import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  CostoMacchinarioCommessa,
  CostoMacchinarioCommessaPubblico,
} from "@/types/costiMacchinari";

type SupabaseClient = typeof supabase;

const SELECT_COSTI_MACCHINARI_ADMIN =
  "id, cantiere_id, rapporto_intervento_id, macchinario_id, tipo_macchinario, descrizione, data_utilizzo, ore_utilizzo, tariffa_oraria, costo_totale, note, created_by, created_at, updated_at";
const SELECT_COSTI_MACCHINARI_PUBBLICO =
  "id, cantiere_id, rapporto_intervento_id, macchinario_id, tipo_macchinario, descrizione, data_utilizzo, ore_utilizzo, note, created_by, created_at, updated_at";

export async function loadCostiMacchinariCommessa({
  cantiereId,
  includeCosti = true,
  supabaseClient = supabase,
}: {
  cantiereId: string;
  includeCosti?: boolean;
  supabaseClient?: SupabaseClient;
}): Promise<
  Array<
    | CostoMacchinarioCommessa
    | CostoMacchinarioCommessaPubblico
  >
> {
  if (!cantiereId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from(
      includeCosti
        ? "costi_macchinari_commessa"
        : "costi_macchinari_pubblici"
    )
    .select(
      includeCosti
        ? SELECT_COSTI_MACCHINARI_ADMIN
        : SELECT_COSTI_MACCHINARI_PUBBLICO
    )
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
  ) as unknown as Array<
    | CostoMacchinarioCommessa
    | CostoMacchinarioCommessaPubblico
  >;
}
