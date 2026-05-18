import { supabase } from "@/lib/supabase";
import type {
  LavorazioneCantiere,
  LavorazioneCantiereUpdate,
} from "@/types/lavorazioni";

const SELECT_LAVORAZIONE_CANTIERE =
  "id, cantiere_id, nome, ordine, attiva, percentuale_completamento, created_at";

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
    })
    .eq("id", lavorazioneId)
    .select(SELECT_LAVORAZIONE_CANTIERE)
    .single();

  if (error) {
    throw error;
  }

  return data as LavorazioneCantiere;
}
