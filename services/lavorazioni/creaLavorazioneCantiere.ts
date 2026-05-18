import { supabase } from "@/lib/supabase";
import type {
  LavorazioneCantiere,
  LavorazioneCantiereInput,
} from "@/types/lavorazioni";

const SELECT_LAVORAZIONE_CANTIERE =
  "id, cantiere_id, nome, ordine, attiva, percentuale_completamento, created_at";

export async function creaLavorazioneCantiere(
  lavorazione: LavorazioneCantiereInput
): Promise<LavorazioneCantiere> {
  const { data, error } = await supabase
    .from("lavorazioni_cantiere")
    .insert({
      cantiere_id: lavorazione.cantiere_id,
      nome: lavorazione.nome,
      ordine: lavorazione.ordine,
      attiva: lavorazione.attiva,
      percentuale_completamento:
        lavorazione.percentuale_completamento,
    })
    .select(SELECT_LAVORAZIONE_CANTIERE)
    .single();

  if (error) {
    throw error;
  }

  return data as LavorazioneCantiere;
}
