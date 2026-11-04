import { supabase } from "@/lib/supabase";
import {
  CHECKLIST_FOTOVOLTAICO_STATI,
  CHECKLIST_FOTOVOLTAICO_TESTI,
} from "@/constants/checklistFotovoltaico";
import { calcolaOutputPerSalvataggio } from "@/services/checklistFotovoltaico/calcolaOutputPerSalvataggio";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import { SELECT_CHECKLIST_FOTOVOLTAICO } from "@/services/checklistFotovoltaico/creaChecklistFotovoltaico";
import type {
  ChecklistFotovoltaico,
  ChecklistFotovoltaicoInput,
} from "@/types/checklistFotovoltaico";

type SupabaseClient = typeof supabase;

/**
 * Aggiorna una checklist ancora in BOZZA. Non è un'alternativa al lock
 * post-firma: il trigger DB blocca comunque qualunque UPDATE una volta
 * che lo stato è FIRMATO o INVIATO, questo è solo un controllo
 * applicativo per dare un errore leggibile prima di provarci.
 */
export async function aggiornaChecklistFotovoltaico(
  checklistId: string,
  input: ChecklistFotovoltaicoInput,
  supabaseClient: SupabaseClient = supabase
): Promise<ChecklistFotovoltaico> {
  const output = await calcolaOutputPerSalvataggio(input, supabaseClient);

  const { data, error } = await supabaseClient
    .from("checklist_fotovoltaico")
    .update({
      ...input,
      ...output,
      updated_at: new Date().toISOString(),
    })
    .eq("id", checklistId)
    .eq("stato", CHECKLIST_FOTOVOLTAICO_STATI.BOZZA)
    .select(SELECT_CHECKLIST_FOTOVOLTAICO)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Aggiornamento checklist fotovoltaico", error);
  }

  if (!data) {
    throw new Error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.CHECKLIST_FIRMATA);
  }

  return data as ChecklistFotovoltaico;
}
