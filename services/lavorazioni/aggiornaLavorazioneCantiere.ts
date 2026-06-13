import { supabase } from "@/lib/supabase";
import type {
  LavorazioneCantiere,
  LavorazioneCantiereUpdate,
} from "@/types/lavorazioni";

const SELECT_LAVORAZIONE_CANTIERE =
  "id, cantiere_id, nome, ordine, attiva, percentuale_completamento, quantita, prezzo_unitario, unita_misura, subappaltata_a_collaborazione_id, created_at";

type Params = {
  lavorazioneId: string;
  lavorazione: LavorazioneCantiereUpdate;
};

export async function aggiornaLavorazioneCantiere({
  lavorazioneId,
  lavorazione,
}: Params): Promise<LavorazioneCantiere> {
  const { data, error } = await supabase
    .from("lavorazioni_cantiere")
    .update({
      nome: lavorazione.nome,
      ordine: lavorazione.ordine,
      attiva: lavorazione.attiva,
      percentuale_completamento:
        lavorazione.percentuale_completamento,
      quantita: lavorazione.quantita ?? null,
      prezzo_unitario: lavorazione.prezzo_unitario ?? null,
      unita_misura: lavorazione.unita_misura ?? null,
    })
    .eq("id", lavorazioneId)
    .select(SELECT_LAVORAZIONE_CANTIERE)
    .single();

  if (error) {
    throw error;
  }

  return data as LavorazioneCantiere;
}
