import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { CategoriaLavorazione } from "@/types/categorie";

type SupabaseClient = typeof supabase;

const SELECT_CATEGORIA = "id, nome, ordine, created_at";

export async function creaCategoriaLavorazione({
  nome,
  ordine = 0,
  supabaseClient = supabase,
}: {
  nome: string;
  ordine?: number;
  supabaseClient?: SupabaseClient;
}): Promise<CategoriaLavorazione> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(supabaseClient, user.id);

  const { data, error } = await supabaseClient
    .from("categorie_lavorazione")
    .insert({
      nome: nome.trim(),
      ordine,
      azienda_id: aziendaId,
    })
    .select(SELECT_CATEGORIA)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Creazione categoria lavorazione", error);
  }

  if (!data) {
    throw new Error("Categoria non creata");
  }

  return data as CategoriaLavorazione;
}
