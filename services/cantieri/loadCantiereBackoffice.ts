import { supabase } from "@/lib/supabase";
import type { CantiereBackoffice } from "@/types/cantieri";

type SupabaseClient = typeof supabase;

const SELECT_CANTIERE_BACKOFFICE =
  "id, nome, indirizzo, lavorazioni, attivo";

export async function loadCantiereBackoffice(
  cantiereId: string,
  supabaseClient: SupabaseClient = supabase
): Promise<CantiereBackoffice | null> {
  if (!cantiereId) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("cantieri")
    .select(SELECT_CANTIERE_BACKOFFICE)
    .eq("id", cantiereId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as CantiereBackoffice | null;
}
