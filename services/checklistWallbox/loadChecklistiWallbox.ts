import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import { SELECT_CHECKLIST_WALLBOX } from "@/services/checklistWallbox/creaChecklistWallbox";
import type { ChecklistWallbox } from "@/types/checklistWallbox";

type SupabaseClient = typeof supabase;

export async function loadChecklistiWallbox(
  supabaseClient: SupabaseClient = supabase
): Promise<ChecklistWallbox[]> {
  const { data, error } = await supabaseClient
    .from("checklist_wallbox")
    .select(SELECT_CHECKLIST_WALLBOX)
    .order("created_at", { ascending: false });

  if (error) {
    throwErroreSupabase("Lettura elenco checklist wallbox", error);
  }

  return (data || []) as ChecklistWallbox[];
}

export async function loadChecklistWallbox(
  id: string,
  supabaseClient: SupabaseClient = supabase
): Promise<ChecklistWallbox | null> {
  if (!id) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("checklist_wallbox")
    .select(SELECT_CHECKLIST_WALLBOX)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Lettura checklist wallbox", error);
  }

  return (data as ChecklistWallbox) || null;
}
