import type { SupabaseClient } from "@supabase/supabase-js";

import { salvaSquadraEMacchinari } from "@/services/pianificazioni/salvaSquadraEMacchinari";
import type { PianificazioneInput } from "@/types/pianificazioni";

export async function creaPianificazione({
  aziendaId,
  creatoDa,
  input,
  supabaseClient,
}: {
  aziendaId: string;
  creatoDa: string;
  input: PianificazioneInput;
  supabaseClient: SupabaseClient;
}): Promise<string> {
  const { data: pianificazione, error } = await supabaseClient
    .from("pianificazioni_lavoro")
    .insert({
      azienda_id: aziendaId,
      cantiere_id: input.cantiereId,
      data: input.data,
      note: input.note,
      creato_da: creatoDa,
    })
    .select("id")
    .single();

  if (error || !pianificazione) {
    throw error || new Error("Inserimento pianificazione fallito");
  }

  const pianificazioneId = pianificazione.id as string;

  await salvaSquadraEMacchinari({
    pianificazioneId,
    aziendaId,
    dipendentiIds: input.dipendentiIds,
    macchinariIds: input.macchinariIds,
    supabaseClient,
  });

  return pianificazioneId;
}
