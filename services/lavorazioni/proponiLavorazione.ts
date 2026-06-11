import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import type { LavorazioneCantiere } from "@/types/lavorazioni";

type SupabaseClient = typeof supabase;

/**
 * Crea una lavorazione "proposta" dal campo (wizard timbratura uscita).
 * Resta in attesa di verifica dell'admin, ma può già ricevere % e foto.
 */
export async function proponiLavorazione({
  cantiereId,
  nome,
  nota = "",
  supabaseClient = supabase,
}: {
  cantiereId: string;
  nome: string;
  nota?: string;
  supabaseClient?: SupabaseClient;
}): Promise<LavorazioneCantiere> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(
    supabaseClient,
    user.id
  );

  const { data, error } = await supabaseClient
    .from("lavorazioni_cantiere")
    .insert({
      cantiere_id: cantiereId,
      nome: nome.trim(),
      attiva: true,
      percentuale_completamento: 0,
      stato: "proposta",
      proposta_da: user.id,
      nota_proposta: nota.trim(),
      azienda_id: aziendaId,
    })
    .select(
      "id, cantiere_id, nome, ordine, attiva, percentuale_completamento, stato, created_at"
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Lavorazione non proposta");
  }

  return data as LavorazioneCantiere;
}
