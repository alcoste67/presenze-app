import { supabase } from "@/lib/supabase";
import {
  RAPPORTI_INTERVENTO_LIMITI,
  RAPPORTI_INTERVENTO_STATI,
  RAPPORTI_INTERVENTO_TESTI,
} from "@/constants/rapportiIntervento";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { RapportoIntervento } from "@/types/rapportiIntervento";

type SupabaseClient = typeof supabase;

type Params = {
  rapportoId: string;
  firmaResponsabileDataUrl: string;
  firmaResponsabileNome: string;
  firmaClienteDataUrl: string;
  firmaClienteNome: string;
  supabaseClient?: SupabaseClient;
};

/**
 * Firma un rapporto in BOZZA: salva le due firme e porta lo stato a
 * FIRMATO. Da quel momento il rapporto è immutabile (lock enforced a
 * livello DB, trigger trg_lock_rapporto).
 */
export async function firmaRapportoIntervento({
  rapportoId,
  firmaResponsabileDataUrl,
  firmaResponsabileNome,
  firmaClienteDataUrl,
  firmaClienteNome,
  supabaseClient = supabase,
}: Params): Promise<RapportoIntervento> {
  if (!firmaResponsabileDataUrl || !firmaClienteDataUrl) {
    throw new Error(
      RAPPORTI_INTERVENTO_TESTI.ERRORI.FIRME_OBBLIGATORIE
    );
  }

  const maxCaratteri =
    RAPPORTI_INTERVENTO_LIMITI.FIRMA_MAX_DATA_URL_CARATTERI;
  if (
    firmaResponsabileDataUrl.length > maxCaratteri ||
    firmaClienteDataUrl.length > maxCaratteri
  ) {
    throw new Error(
      RAPPORTI_INTERVENTO_TESTI.ERRORI.FIRMA_TROPPO_GRANDE
    );
  }

  const adesso = new Date().toISOString();

  const { data, error } = await supabaseClient
    .from("rapporti_intervento")
    .update({
      firma_responsabile_data_url: firmaResponsabileDataUrl,
      firma_responsabile_nome: firmaResponsabileNome.trim(),
      firma_responsabile_at: adesso,
      firma_cliente_data_url: firmaClienteDataUrl,
      firma_cliente_nome: firmaClienteNome.trim(),
      firma_cliente_at: adesso,
      stato: RAPPORTI_INTERVENTO_STATI.FIRMATO,
      updated_at: adesso,
    })
    .eq("id", rapportoId)
    .eq("stato", RAPPORTI_INTERVENTO_STATI.BOZZA)
    .select("id, stato, firma_responsabile_at, firma_cliente_at")
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Firma rapporto", error);
  }

  if (!data) {
    throw new Error(
      RAPPORTI_INTERVENTO_TESTI.ERRORI.RAPPORTO_FIRMATO
    );
  }

  return data as RapportoIntervento;
}
