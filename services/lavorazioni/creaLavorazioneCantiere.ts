import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import type {
  LavorazioneCantiere,
  LavorazioneCantiereInput,
} from "@/types/lavorazioni";

const SELECT_LAVORAZIONE_CANTIERE =
  "id, cantiere_id, nome, ordine, attiva, percentuale_completamento, quantita, prezzo_unitario, unita_misura, subappaltata_a_collaborazione_id, created_at";

export async function creaLavorazioneCantiere(
  lavorazione: LavorazioneCantiereInput
): Promise<LavorazioneCantiere> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(
    supabase,
    user.id
  );

  const { data, error } = await supabase
    .from("lavorazioni_cantiere")
    .insert({
      cantiere_id: lavorazione.cantiere_id,
      nome: lavorazione.nome,
      ordine: lavorazione.ordine,
      attiva: lavorazione.attiva,
      percentuale_completamento:
        lavorazione.percentuale_completamento,
      quantita: lavorazione.quantita ?? null,
      prezzo_unitario: lavorazione.prezzo_unitario ?? null,
      unita_misura: lavorazione.unita_misura ?? null,
      azienda_id: aziendaId,
    })
    .select(SELECT_LAVORAZIONE_CANTIERE)
    .single();

  if (error) {
    throw error;
  }

  return data as LavorazioneCantiere;
}
