import { supabase } from "@/lib/supabase";
import { LAVORAZIONI_LIMITI } from "@/constants/lavorazioni";
import type { LavorazioneCantiere } from "@/types/lavorazioni";

const SELECT_LAVORAZIONE_CANTIERE =
  "id, cantiere_id, nome, ordine, attiva, percentuale_completamento, stato, created_at";

export async function loadLavorazioniAttiveCantiere(
  cantiereId: string
): Promise<LavorazioneCantiere[]> {
  if (!cantiereId) {
    return [];
  }

  const { data, error } = await supabase
    .from("lavorazioni_cantiere")
    .select(SELECT_LAVORAZIONE_CANTIERE)
    .eq("cantiere_id", cantiereId)
    .eq("attiva", true)
    .neq("stato", "rifiutata")
    .lt(
      "percentuale_completamento",
      LAVORAZIONI_LIMITI.PERCENTUALE_MAX
    )
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
