import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { Collaborazione } from "@/types/collaborazioni";

type SupabaseClient = typeof supabase;

const SELECT_COLLABORAZIONE =
  "id, cantiere_committente_id, azienda_committente_id, cantiere_committente_nome, azienda_committente_nome, email_invito, azienda_collaboratrice_id, azienda_collaboratrice_nome, cantiere_collaboratore_id, cantiere_collaboratore_nome, stato, novita_per_collaboratore, novita_per_committente, creato_il, accettato_il";

/**
 * Tutte le collaborazioni visibili all'azienda corrente (la RLS filtra:
 * come committente, come collaboratrice, o invito alla propria email).
 */
export async function loadCollaborazioni({
  supabaseClient = supabase,
}: {
  supabaseClient?: SupabaseClient;
} = {}): Promise<Collaborazione[]> {
  const { data, error } = await supabaseClient
    .from("cantieri_collaborazioni")
    .select(SELECT_COLLABORAZIONE)
    .order("creato_il", { ascending: false });

  if (error) {
    throwErroreSupabase("Lettura collaborazioni", error);
  }

  return (data || []) as Collaborazione[];
}
