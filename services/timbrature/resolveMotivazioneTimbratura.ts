import type { SupabaseClient } from "@supabase/supabase-js";

import { LABEL_ATTIVITA } from "@/constants/attivita";

/**
 * Nome cantiere o etichetta attività di una timbratura, per le notifiche
 * admin (push/mail): "motivazione" della timbratura. Null se non c'è né
 * l'uno né l'altra (caso raro/di transizione).
 */
export async function resolveMotivazioneTimbratura(
  supabaseClient: SupabaseClient,
  { cantiereId, attivitaTipo }: { cantiereId: string | null; attivitaTipo: string | null }
): Promise<string | null> {
  if (cantiereId) {
    const { data } = await supabaseClient
      .from("cantieri")
      .select("nome")
      .eq("id", cantiereId)
      .maybeSingle();

    return data?.nome ?? null;
  }

  if (attivitaTipo) {
    return LABEL_ATTIVITA[attivitaTipo as keyof typeof LABEL_ATTIVITA] ?? attivitaTipo;
  }

  return null;
}
