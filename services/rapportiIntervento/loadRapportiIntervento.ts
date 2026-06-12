import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { RapportoIntervento } from "@/types/rapportiIntervento";

type SupabaseClient = typeof supabase;

const SELECT_RAPPORTO_INTERVENTO =
  "id, cantiere_id, cantiere_nome_snapshot, cantiere_indirizzo_snapshot, data_intervento, ora_arrivo, ora_partenza, cliente_committente, cliente_id, responsabile_nome, ore_uomo_reali_minuti, viaggio_minuti, diritto_uscita, regola_fatturazione, ore_fatturabili_minuti, note, firma_responsabile_data_url, firma_responsabile_nome, firma_responsabile_at, firma_cliente_data_url, firma_cliente_nome, firma_cliente_at, stato, created_by, created_at, updated_at";

export async function loadRapportiIntervento(
  supabaseClient: SupabaseClient = supabase
): Promise<RapportoIntervento[]> {
  const { data, error } = await supabaseClient
    .from("rapporti_intervento")
    .select(SELECT_RAPPORTO_INTERVENTO)
    .order("data_intervento", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    throwErroreSupabase(
      "Lettura rapporti intervento",
      error
    );
  }

  return (data || []) as RapportoIntervento[];
}
