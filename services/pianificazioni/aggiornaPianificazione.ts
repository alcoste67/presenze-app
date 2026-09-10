import type { SupabaseClient } from "@supabase/supabase-js";

import { salvaSquadraEMacchinari } from "@/services/pianificazioni/salvaSquadraEMacchinari";
import type { PianificazioneInput } from "@/types/pianificazioni";

export async function aggiornaPianificazione({
  pianificazioneId,
  aziendaId,
  input,
  supabaseClient,
}: {
  pianificazioneId: string;
  aziendaId: string;
  input: PianificazioneInput;
  supabaseClient: SupabaseClient;
}): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from("pianificazioni_lavoro")
    .update({
      cantiere_id: input.cantiereId,
      data: input.data,
      note: input.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", pianificazioneId)
    .eq("azienda_id", aziendaId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (!data) return false;

  await salvaSquadraEMacchinari({
    pianificazioneId,
    aziendaId,
    dipendentiIds: input.dipendentiIds,
    macchinariIds: input.macchinariIds,
    supabaseClient,
  });

  return true;
}
