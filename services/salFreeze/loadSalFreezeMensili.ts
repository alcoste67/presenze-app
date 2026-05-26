import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { SalFreezeMensile } from "@/types/salFreeze";

type SupabaseClient = typeof supabase;

const SELECT_SAL_FREEZE_MENSILI =
  "id, cantiere_id, period_start, period_end, freeze_at, created_by, note, metadata, annullato_at, annullato_by";

export async function loadSalFreezeMensili({
  cantiereId,
  supabaseClient = supabase,
}: {
  cantiereId: string;
  supabaseClient?: SupabaseClient;
}): Promise<SalFreezeMensile[]> {
  if (!cantiereId) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("sal_freeze_mensili")
    .select(SELECT_SAL_FREEZE_MENSILI)
    .eq("cantiere_id", cantiereId)
    .order("freeze_at", { ascending: false });

  if (error) {
    throwErroreSupabase(
      "Lettura freeze SAL mensili",
      error
    );
  }

  return (data || []) as SalFreezeMensile[];
}
