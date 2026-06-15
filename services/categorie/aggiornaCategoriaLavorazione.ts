import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { CategoriaLavorazione } from "@/types/categorie";

type SupabaseClient = typeof supabase;

const SELECT_CATEGORIA = "id, nome, ordine, created_at";

export async function aggiornaCategoriaLavorazione({
  id,
  nome,
  ordine,
  supabaseClient = supabase,
}: {
  id: string;
  nome?: string;
  ordine?: number;
  supabaseClient?: SupabaseClient;
}): Promise<CategoriaLavorazione> {
  const update: Record<string, string | number> = {};
  if (nome !== undefined) update.nome = nome.trim();
  if (ordine !== undefined) update.ordine = ordine;

  const { data, error } = await supabaseClient
    .from("categorie_lavorazione")
    .update(update)
    .eq("id", id)
    .select(SELECT_CATEGORIA)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Aggiornamento categoria lavorazione", error);
  }

  if (!data) {
    throw new Error("Categoria non trovata");
  }

  return data as CategoriaLavorazione;
}
