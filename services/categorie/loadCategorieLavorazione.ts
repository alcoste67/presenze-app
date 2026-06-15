import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { CategoriaLavorazione } from "@/types/categorie";

type SupabaseClient = typeof supabase;

const SELECT_CATEGORIA = "id, nome, ordine, created_at";

export async function loadCategorieLavorazione(
  supabaseClient: SupabaseClient = supabase
): Promise<CategoriaLavorazione[]> {
  const { data, error } = await supabaseClient
    .from("categorie_lavorazione")
    .select(SELECT_CATEGORIA)
    .order("ordine", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    throwErroreSupabase("Lettura categorie lavorazione", error);
  }

  return (data || []) as CategoriaLavorazione[];
}
