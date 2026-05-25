import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  RapportoInterventoFoto,
  RapportoInterventoMateriale,
  RapportoIntervento,
  RapportoInterventoCompleto,
  RapportoInterventoLavorazione,
  RapportoInterventoOperatore,
} from "@/types/rapportiIntervento";

type SupabaseClient = typeof supabase;

const SELECT_RAPPORTO_INTERVENTO =
  "id, cantiere_id, cantiere_nome_snapshot, cantiere_indirizzo_snapshot, data_intervento, cliente_committente, responsabile_nome, ore_uomo_reali_minuti, viaggio_minuti, diritto_uscita, regola_fatturazione, ore_fatturabili_minuti, note, firma_responsabile_data_url, firma_responsabile_nome, firma_responsabile_at, firma_cliente_data_url, firma_cliente_nome, firma_cliente_at, stato, created_by, created_at, updated_at";

const SELECT_RAPPORTO_INTERVENTO_LAVORAZIONE =
  "id, rapporto_intervento_id, lavorazione_id, descrizione_snapshot, ore_uomo_minuti, ordine, created_at";
const SELECT_RAPPORTO_INTERVENTO_OPERATORE =
  "id, rapporto_intervento_id, dipendente_id, nome_snapshot, email_snapshot, ore_minuti, ordine, created_at";
const SELECT_RAPPORTO_INTERVENTO_FOTO =
  "id, rapporto_intervento_id, immagine_data_url, descrizione, ordine, created_at";
const SELECT_RAPPORTO_INTERVENTO_MATERIALE =
  "id, rapporto_intervento_id, descrizione, quantita, unita_misura, ordine, created_at";

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
    throwErroreSupabase(
      "Lettura rapporto intervento",
      error
    );
  }

  if (!rapportoData) {
    return null;
  }

  const [
    lavorazioniResult,
    operatoriResult,
    fotoResult,
    materialiResult,
  ] = await Promise.all([
    supabaseClient
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
      }),
    supabaseClient
      .from("rapporti_intervento_operatori")
      .select(SELECT_RAPPORTO_INTERVENTO_OPERATORE)
      .eq(
        "rapporto_intervento_id",
        rapportoInterventoId
      )
      .order("ordine", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      }),
    supabaseClient
      .from("rapporti_intervento_foto")
      .select(SELECT_RAPPORTO_INTERVENTO_FOTO)
      .eq(
        "rapporto_intervento_id",
        rapportoInterventoId
      )
      .order("ordine", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      }),
    supabaseClient
      .from("rapporti_intervento_materiali")
      .select(SELECT_RAPPORTO_INTERVENTO_MATERIALE)
      .eq(
        "rapporto_intervento_id",
        rapportoInterventoId
      )
      .order("ordine", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      }),
  ]);

  if (lavorazioniResult.error) {
    throwErroreSupabase(
      "Lettura lavorazioni rapporto intervento",
      lavorazioniResult.error
    );
  }

  if (fotoResult.error) {
    throwErroreSupabase(
      "Lettura foto rapporto intervento",
      fotoResult.error
    );
  }

  if (operatoriResult.error) {
    throwErroreSupabase(
      "Lettura operatori rapporto intervento",
      operatoriResult.error
    );
  }

  if (materialiResult.error) {
    throwErroreSupabase(
      "Lettura materiali rapporto intervento",
      materialiResult.error
    );
  }

  return {
    ...(rapportoData as RapportoIntervento),
    lavorazioni:
      (lavorazioniResult.data ||
        []) as RapportoInterventoLavorazione[],
    operatori:
      (operatoriResult.data ||
        []) as RapportoInterventoOperatore[],
    foto:
      (fotoResult.data ||
        []) as RapportoInterventoFoto[],
    materiali:
      (materialiResult.data ||
        []) as RapportoInterventoMateriale[],
  };
}
