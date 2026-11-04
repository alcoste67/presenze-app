import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import { SELECT_CHECKLIST_FOTOVOLTAICO } from "@/services/checklistFotovoltaico/creaChecklistFotovoltaico";
import type { ChecklistFotovoltaico } from "@/types/checklistFotovoltaico";

type SupabaseClient = typeof supabase;

export async function loadChecklistiFotovoltaico(
  { creatoDa }: { creatoDa?: string } = {},
  supabaseClient: SupabaseClient = supabase
): Promise<ChecklistFotovoltaico[]> {
  let query = supabaseClient
    .from("checklist_fotovoltaico")
    .select(SELECT_CHECKLIST_FOTOVOLTAICO)
    .order("created_at", { ascending: false });

  if (creatoDa) {
    query = query.eq("created_by", creatoDa);
  }

  const { data, error } = await query;

  if (error) {
    throwErroreSupabase("Lettura elenco checklist fotovoltaico", error);
  }

  return (data || []) as ChecklistFotovoltaico[];
}

export async function loadChecklistFotovoltaico(
  id: string,
  supabaseClient: SupabaseClient = supabase
): Promise<ChecklistFotovoltaico | null> {
  if (!id) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("checklist_fotovoltaico")
    .select(SELECT_CHECKLIST_FOTOVOLTAICO)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Lettura checklist fotovoltaico", error);
  }

  return (data as ChecklistFotovoltaico) || null;
}
