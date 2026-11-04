import { supabase } from "@/lib/supabase";
import {
  CHECKLIST_FOTOVOLTAICO_LIMITI,
  CHECKLIST_FOTOVOLTAICO_STATI,
  CHECKLIST_FOTOVOLTAICO_TESTI,
} from "@/constants/checklistFotovoltaico";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import { SELECT_CHECKLIST_FOTOVOLTAICO } from "@/services/checklistFotovoltaico/creaChecklistFotovoltaico";
import type { ChecklistFotovoltaico } from "@/types/checklistFotovoltaico";

type SupabaseClient = typeof supabase;

type Params = {
  checklistId: string;
  firmaTecnicoDataUrl: string;
  firmaTecnicoNome: string;
  firmaClienteDataUrl: string;
  firmaClienteNome: string;
  supabaseClient?: SupabaseClient;
};

/**
 * Firma una checklist in BOZZA: salva le due firme e porta lo stato a
 * FIRMATO. Da quel momento è immutabile (lock enforced a livello DB,
 * trigger trg_lock_checklist_fotovoltaico).
 */
export async function firmaChecklistFotovoltaico({
  checklistId,
  firmaTecnicoDataUrl,
  firmaTecnicoNome,
  firmaClienteDataUrl,
  firmaClienteNome,
  supabaseClient = supabase,
}: Params): Promise<ChecklistFotovoltaico> {
  if (!firmaTecnicoDataUrl || !firmaClienteDataUrl) {
    throw new Error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.FIRME_OBBLIGATORIE);
  }

  if (!firmaTecnicoNome.trim()) {
    throw new Error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.FIRMA_TECNICO_NOME_OBBLIGATORIO);
  }

  if (!firmaClienteNome.trim()) {
    throw new Error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.FIRMA_CLIENTE_NOME_OBBLIGATORIO);
  }

  const maxCaratteri = CHECKLIST_FOTOVOLTAICO_LIMITI.FIRMA_MAX_DATA_URL_CARATTERI;
  if (
    firmaTecnicoDataUrl.length > maxCaratteri ||
    firmaClienteDataUrl.length > maxCaratteri
  ) {
    throw new Error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.FIRMA_TROPPO_GRANDE);
  }

  const adesso = new Date().toISOString();

  const { data, error } = await supabaseClient
    .from("checklist_fotovoltaico")
    .update({
      firma_tecnico_data_url: firmaTecnicoDataUrl,
      firma_tecnico_nome: firmaTecnicoNome.trim(),
      firma_tecnico_at: adesso,
      firma_cliente_data_url: firmaClienteDataUrl,
      firma_cliente_nome: firmaClienteNome.trim(),
      firma_cliente_at: adesso,
      stato: CHECKLIST_FOTOVOLTAICO_STATI.FIRMATO,
      updated_at: adesso,
    })
    .eq("id", checklistId)
    .eq("stato", CHECKLIST_FOTOVOLTAICO_STATI.BOZZA)
    .select(SELECT_CHECKLIST_FOTOVOLTAICO)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Firma checklist fotovoltaico", error);
  }

  if (!data) {
    throw new Error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.CHECKLIST_FIRMATA);
  }

  return data as ChecklistFotovoltaico;
}
