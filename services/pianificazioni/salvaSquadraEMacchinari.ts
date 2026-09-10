import type { SupabaseClient } from "@supabase/supabase-js";

/** Sostituisce interamente squadra e macchinari di una pianificazione (delete + reinsert). */
export async function salvaSquadraEMacchinari({
  pianificazioneId,
  aziendaId,
  dipendentiIds,
  macchinariIds,
  supabaseClient,
}: {
  pianificazioneId: string;
  aziendaId: string;
  dipendentiIds: string[];
  macchinariIds: string[];
  supabaseClient: SupabaseClient;
}): Promise<void> {
  const [eliminaSquadra, eliminaMacchinari] = await Promise.all([
    supabaseClient
      .from("pianificazioni_squadra")
      .delete()
      .eq("pianificazione_id", pianificazioneId),
    supabaseClient
      .from("pianificazioni_macchinari")
      .delete()
      .eq("pianificazione_id", pianificazioneId),
  ]);

  if (eliminaSquadra.error) throw eliminaSquadra.error;
  if (eliminaMacchinari.error) throw eliminaMacchinari.error;

  if (dipendentiIds.length > 0) {
    const { error } = await supabaseClient
      .from("pianificazioni_squadra")
      .insert(
        dipendentiIds.map((dipendenteId) => ({
          azienda_id: aziendaId,
          pianificazione_id: pianificazioneId,
          dipendente_id: dipendenteId,
        }))
      );

    if (error) throw error;
  }

  if (macchinariIds.length > 0) {
    const { error } = await supabaseClient
      .from("pianificazioni_macchinari")
      .insert(
        macchinariIds.map((macchinarioId) => ({
          azienda_id: aziendaId,
          pianificazione_id: pianificazioneId,
          macchinario_id: macchinarioId,
        }))
      );

    if (error) throw error;
  }
}
