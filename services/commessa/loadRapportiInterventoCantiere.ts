import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { RapportoIntervento } from "@/types/rapportiIntervento";

type SupabaseClient = typeof supabase;

const SELECT_RAPPORTO_INTERVENTO_COMPATTO =
  "id, cantiere_id, cantiere_nome_snapshot, cantiere_indirizzo_snapshot, data_intervento, cliente_committente, cliente_id, responsabile_nome, ore_uomo_reali_minuti, viaggio_minuti, diritto_uscita, regola_fatturazione, ore_fatturabili_minuti, note, firma_responsabile_data_url, firma_responsabile_nome, firma_responsabile_at, firma_cliente_data_url, firma_cliente_nome, firma_cliente_at, stato, created_by, created_at, updated_at";

export async function loadRapportiInterventoCantiere({
  cantiereId,
  limit,
  supabaseClient = supabase,
}: {
  cantiereId: string;
  limit?: number;
  supabaseClient?: SupabaseClient;
}): Promise<RapportoIntervento[]> {
  if (!cantiereId) {
    return [];
  }

  let query = supabaseClient
    .from("rapporti_intervento")
    .select(SELECT_RAPPORTO_INTERVENTO_COMPATTO)
    .eq("cantiere_id", cantiereId)
    .order("data_intervento", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throwErroreSupabase(
      "Lettura rapporti intervento cantiere",
      error
    );
  }

  return (data || []) as RapportoIntervento[];
}
