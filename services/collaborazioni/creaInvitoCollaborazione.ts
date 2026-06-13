import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { Collaborazione } from "@/types/collaborazioni";

type SupabaseClient = typeof supabase;

const SELECT_COLLABORAZIONE =
  "id, cantiere_committente_id, azienda_committente_id, cantiere_committente_nome, azienda_committente_nome, email_invito, azienda_collaboratrice_id, azienda_collaboratrice_nome, cantiere_collaboratore_id, cantiere_collaboratore_nome, stato, creato_il, accettato_il";

/** Il committente invita un'azienda (via email admin) su un proprio cantiere. */
export async function creaInvitoCollaborazione({
  cantiereId,
  cantiereNome,
  cantiereIndirizzo = "",
  emailInvito,
  supabaseClient = supabase,
}: {
  cantiereId: string;
  cantiereNome: string;
  cantiereIndirizzo?: string;
  emailInvito: string;
  supabaseClient?: SupabaseClient;
}): Promise<Collaborazione> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(supabaseClient, user.id);

  const { data: azienda } = await supabaseClient
    .from("aziende")
    .select("nome")
    .eq("id", aziendaId)
    .maybeSingle();

  const { data, error } = await supabaseClient
    .from("cantieri_collaborazioni")
    .insert({
      cantiere_committente_id: cantiereId,
      azienda_committente_id: aziendaId,
      cantiere_committente_nome: cantiereNome,
      cantiere_committente_indirizzo: cantiereIndirizzo,
      azienda_committente_nome: azienda?.nome || "",
      email_invito: emailInvito.trim().toLowerCase(),
      creato_da: user.id,
    })
    .select(SELECT_COLLABORAZIONE)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Invito collaborazione", error);
  }

  if (!data) {
    throw new Error("Invito non creato");
  }

  return data as Collaborazione;
}
