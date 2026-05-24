import { supabase } from "@/lib/supabase";
import type {
  RapportoIntervento,
  RapportoInterventoCompleto,
  RapportoInterventoLavorazione,
} from "@/types/rapportiIntervento";

type SupabaseClient = typeof supabase;

const SELECT_RAPPORTO_INTERVENTO =
  "id, cantiere_id, cantiere_nome_snapshot, cantiere_indirizzo_snapshot, data_intervento, cliente_committente, responsabile_nome, ore_uomo_reali_minuti, viaggio_minuti, diritto_uscita, regola_fatturazione, ore_fatturabili_minuti, note, firma_responsabile_data_url, firma_responsabile_nome, firma_responsabile_at, firma_cliente_data_url, firma_cliente_nome, firma_cliente_at, stato, created_by, created_at, updated_at";

const SELECT_RAPPORTO_INTERVENTO_LAVORAZIONE =
  "id, rapporto_intervento_id, lavorazione_id, descrizione_snapshot, ore_uomo_minuti, ordine, created_at";

export async function loadRapportoIntervento(
  rapportoInterventoId: string,
  supabaseClient: SupabaseClient = supabase
): Promise<RapportoInterventoCompleto | null> {
  if (!rapportoInterventoId) {
    return null;
  }

  const { data: rapportoData, error } =
    await supabaseClient
      .from("rapporti_intervento")
      .select(SELECT_RAPPORTO_INTERVENTO)
      .eq("id", rapportoInterventoId)
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!rapportoData) {
    return null;
  }

  const {
    data: lavorazioniData,
    error: lavorazioniError,
  } = await supabaseClient
    .from("rapporti_intervento_lavorazioni")
    .select(SELECT_RAPPORTO_INTERVENTO_LAVORAZIONE)
    .eq(
      "rapporto_intervento_id",
      rapportoInterventoId
    )
    .order("ordine", {
      ascending: true,
    })
    .order("created_at", {
      ascending: true,
    });

  if (lavorazioniError) {
    throw lavorazioniError;
  }

  return {
    ...(rapportoData as RapportoIntervento),
    lavorazioni:
      (lavorazioniData ||
        []) as RapportoInterventoLavorazione[],
  };
}
