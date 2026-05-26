import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { SalLavorazioneFoto } from "@/types/sal";

type SupabaseClient = typeof supabase;

const SELECT_SAL_LAVORAZIONI_FOTO =
  "id, cantiere_id, lavorazione_id, timbratura_id, data_riferimento, immagine_data_url, descrizione, created_by, created_at";

export async function loadSalLavorazioniFoto({
  cantiereId,
  dataRiferimento,
  limit,
  supabaseClient = supabase,
}: {
  cantiereId: string;
  dataRiferimento?: string;
  limit?: number;
  supabaseClient?: SupabaseClient;
}): Promise<SalLavorazioneFoto[]> {
  if (!cantiereId) {
    return [];
  }

  let query = supabaseClient
    .from("sal_lavorazioni_foto")
    .select(SELECT_SAL_LAVORAZIONI_FOTO)
    .eq("cantiere_id", cantiereId)
    .order("created_at", {
      ascending: false,
    });

  if (dataRiferimento) {
    query = query.eq(
      "data_riferimento",
      dataRiferimento
    );
  }

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throwErroreSupabase(
      "Lettura foto SAL",
      error
    );
  }

  return (
    data || []
  ) as SalLavorazioneFoto[];
}
