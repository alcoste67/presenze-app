import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import { SELECT_ORDINE_LAVORO_EDISON } from "@/services/ordiniLavoro/creaOrdineLavoroEdison";
import type { OrdineLavoroEdison } from "@/types/ordiniLavoro";

type SupabaseClient = typeof supabase;

export async function loadOrdiniLavoro(
  supabaseClient: SupabaseClient = supabase
): Promise<OrdineLavoroEdison[]> {
  const { data, error } = await supabaseClient
    .from("ordini_lavoro_edison")
    .select(SELECT_ORDINE_LAVORO_EDISON)
    .order("created_at", { ascending: false });

  if (error) {
    throwErroreSupabase("Lettura elenco ordini di lavoro", error);
  }

  return (data || []) as OrdineLavoroEdison[];
}

export async function loadOrdineLavoro(
  id: string,
  supabaseClient: SupabaseClient = supabase
): Promise<OrdineLavoroEdison | null> {
  if (!id) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("ordini_lavoro_edison")
    .select(SELECT_ORDINE_LAVORO_EDISON)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Lettura ordine di lavoro", error);
  }

  return (data as OrdineLavoroEdison) || null;
}
