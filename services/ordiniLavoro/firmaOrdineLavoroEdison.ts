import { supabase } from "@/lib/supabase";
import {
  ORDINI_LAVORO_LIMITI,
  ORDINI_LAVORO_STATI,
  ORDINI_LAVORO_TESTI,
} from "@/constants/ordiniLavoro";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import { SELECT_ORDINE_LAVORO_EDISON } from "@/services/ordiniLavoro/creaOrdineLavoroEdison";
import type { OrdineLavoroEdison } from "@/types/ordiniLavoro";

type SupabaseClient = typeof supabase;

type Params = {
  ordineId: string;
  firmaTecnicoDataUrl: string;
  firmaTecnicoNome: string;
  firmaClienteDataUrl: string;
  firmaClienteNome: string;
  supabaseClient?: SupabaseClient;
};

/**
 * Firma un ordine di lavoro in BOZZA: salva le due firme e porta lo
 * stato a FIRMATO. Da quel momento è immutabile (lock enforced a
 * livello DB, trigger trg_lock_ordine_lavoro_edison).
 */
export async function firmaOrdineLavoroEdison({
  ordineId,
  firmaTecnicoDataUrl,
  firmaTecnicoNome,
  firmaClienteDataUrl,
  firmaClienteNome,
  supabaseClient = supabase,
}: Params): Promise<OrdineLavoroEdison> {
  if (!firmaTecnicoDataUrl || !firmaClienteDataUrl) {
    throw new Error(ORDINI_LAVORO_TESTI.ERRORI.FIRME_OBBLIGATORIE);
  }

  if (!firmaTecnicoNome.trim()) {
    throw new Error(
      ORDINI_LAVORO_TESTI.ERRORI.FIRMA_TECNICO_NOME_OBBLIGATORIO
    );
  }

  if (!firmaClienteNome.trim()) {
    throw new Error(
      ORDINI_LAVORO_TESTI.ERRORI.FIRMA_CLIENTE_NOME_OBBLIGATORIO
    );
  }

  const maxCaratteri = ORDINI_LAVORO_LIMITI.FIRMA_MAX_DATA_URL_CARATTERI;
  if (
    firmaTecnicoDataUrl.length > maxCaratteri ||
    firmaClienteDataUrl.length > maxCaratteri
  ) {
    throw new Error(ORDINI_LAVORO_TESTI.ERRORI.FIRMA_TROPPO_GRANDE);
  }

  const adesso = new Date().toISOString();

  const { data, error } = await supabaseClient
    .from("ordini_lavoro_edison")
    .update({
      firma_tecnico_data_url: firmaTecnicoDataUrl,
      firma_tecnico_nome: firmaTecnicoNome.trim(),
      firma_tecnico_at: adesso,
      firma_cliente_data_url: firmaClienteDataUrl,
      firma_cliente_nome: firmaClienteNome.trim(),
      firma_cliente_at: adesso,
      stato: ORDINI_LAVORO_STATI.FIRMATO,
      updated_at: adesso,
    })
    .eq("id", ordineId)
    .eq("stato", ORDINI_LAVORO_STATI.BOZZA)
    .select(SELECT_ORDINE_LAVORO_EDISON)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Firma ordine di lavoro", error);
  }

  if (!data) {
    throw new Error(ORDINI_LAVORO_TESTI.ERRORI.ORDINE_FIRMATO);
  }

  return data as OrdineLavoroEdison;
}
