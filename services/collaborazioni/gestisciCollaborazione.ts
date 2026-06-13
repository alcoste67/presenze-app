import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { Collaborazione } from "@/types/collaborazioni";

type SupabaseClient = typeof supabase;

/**
 * L'azienda invitata accetta: il cantiere viene creato automaticamente
 * ereditando nome + indirizzo + lavorazioni dal committente, con cliente
 * = nome dell'appaltatore.
 */
export async function accettaCollaborazione({
  collaborazioneId,
  supabaseClient = supabase,
}: {
  collaborazioneId: string;
  supabaseClient?: SupabaseClient;
}): Promise<Collaborazione> {
  const { data, error } = await supabaseClient.rpc(
    "accetta_collaborazione_crea_cantiere",
    { collaborazione_id: collaborazioneId }
  );

  if (error) {
    throwErroreSupabase("Accettazione collaborazione", error);
  }

  return data as Collaborazione;
}

/** Revoca (committente) o rifiuto: porta lo stato a 'revocata'. */
export async function revocaCollaborazione({
  collaborazioneId,
  supabaseClient = supabase,
}: {
  collaborazioneId: string;
  supabaseClient?: SupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient
    .from("cantieri_collaborazioni")
    .update({ stato: "revocata" })
    .eq("id", collaborazioneId);

  if (error) {
    throwErroreSupabase("Revoca collaborazione", error);
  }
}
