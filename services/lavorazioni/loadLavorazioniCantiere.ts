import { supabase } from "@/lib/supabase";
import type { LavorazioneCantiere } from "@/types/lavorazioni";

const SELECT_LAVORAZIONE_CANTIERE =
  "id, cantiere_id, nome, ordine, attiva, percentuale_completamento, created_at";

export async function loadLavorazioniCantiere(
  cantiereId: string
): Promise<LavorazioneCantiere[]> {
  if (!cantiereId) {
    return [];
  }

  const { data, error } = await supabase
    .from("lavorazioni_cantiere")
    .select(SELECT_LAVORAZIONE_CANTIERE)
    .eq("cantiere_id", cantiereId)
    .order("ordine", {
      ascending: true,
    })
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data || []) as LavorazioneCantiere[];
}
