import { supabase } from "@/lib/supabase";
import type { CantiereBackoffice } from "@/types/cantieri";

const SELECT_CANTIERE_BACKOFFICE =
  "id, nome, indirizzo, lavorazioni, attivo";

export async function loadCantiereBackoffice(
  cantiereId: string
): Promise<CantiereBackoffice | null> {
  if (!cantiereId) {
    return null;
  }

  const { data, error } = await supabase
    .from("cantieri")
    .select(SELECT_CANTIERE_BACKOFFICE)
    .eq("id", cantiereId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as CantiereBackoffice | null;
}
