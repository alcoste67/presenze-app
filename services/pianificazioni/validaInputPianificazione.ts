import type { SupabaseClient } from "@supabase/supabase-js";

import { PIANIFICAZIONI_TESTI } from "@/constants/pianificazioni";
import type { PianificazioneInput } from "@/types/pianificazioni";

/**
 * Verifica che cantiere e dipendenti indicati appartengano davvero
 * all'azienda del chiamante — cantiere_id/dipendenteId arrivano dal
 * client e non vanno mai fidati ciecamente (i macchinari non sono
 * multi-tenant, nessun controllo necessario su quelli).
 */
export async function validaInputPianificazione({
  aziendaId,
  input,
  supabaseClient,
}: {
  aziendaId: string;
  input: PianificazioneInput;
  supabaseClient: SupabaseClient;
}): Promise<string | null> {
  if (!input.cantiereId) {
    return PIANIFICAZIONI_TESTI.ERRORI.CANTIERE_OBBLIGATORIO;
  }

  if (!input.data) {
    return PIANIFICAZIONI_TESTI.ERRORI.DATA_OBBLIGATORIA;
  }

  const { data: cantiere, error: erroreCantiere } = await supabaseClient
    .from("cantieri")
    .select("id")
    .eq("id", input.cantiereId)
    .eq("azienda_id", aziendaId)
    .maybeSingle();

  if (erroreCantiere) throw erroreCantiere;
  if (!cantiere) {
    return PIANIFICAZIONI_TESTI.ERRORI.CANTIERE_OBBLIGATORIO;
  }

  if (input.dipendentiIds.length > 0) {
    const { data: dipendenti, error: erroreDipendenti } = await supabaseClient
      .from("dipendenti")
      .select("id")
      .eq("azienda_id", aziendaId)
      .in("id", input.dipendentiIds);

    if (erroreDipendenti) throw erroreDipendenti;
    if ((dipendenti || []).length !== new Set(input.dipendentiIds).size) {
      return PIANIFICAZIONI_TESTI.ERRORI.GENERICO;
    }
  }

  return null;
}
