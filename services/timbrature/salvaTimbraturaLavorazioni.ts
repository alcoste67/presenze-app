import { supabase } from "@/lib/supabase";
import type {
  TimbraturaLavorazione,
  TimbraturaLavorazioneInput,
} from "@/types/timbratureLavorazioni";

const SELECT_TIMBRATURA_LAVORAZIONE =
  "id, timbratura_id, lavorazione_id, percentuale_avanzamento, created_at";

type Params = {
  timbraturaId: string;
  lavorazioni: TimbraturaLavorazioneInput[];
};

export async function salvaTimbraturaLavorazioni({
  timbraturaId,
  lavorazioni,
}: Params): Promise<TimbraturaLavorazione[]> {
  const lavorazioniUniche = Array.from(
    new Map(
      lavorazioni
        .filter((lavorazione) =>
          Boolean(lavorazione.lavorazioneId)
        )
        .map((lavorazione) => [
          lavorazione.lavorazioneId,
          lavorazione,
        ])
    ).values()
  );

  if (
    !timbraturaId ||
    lavorazioniUniche.length === 0
  ) {
    return [];
  }

  const righe = lavorazioniUniche.map(
    (lavorazione) => ({
      timbratura_id: timbraturaId,
      lavorazione_id:
        lavorazione.lavorazioneId,
      percentuale_avanzamento:
        lavorazione.percentualeAvanzamento,
    })
  );

  const { data, error } = await supabase
    .from("timbrature_lavorazioni")
    .upsert(righe, {
      onConflict:
        "timbratura_id,lavorazione_id",
    })
    .select(SELECT_TIMBRATURA_LAVORAZIONE);

  if (error) {
    throw error;
  }

  return (data || []) as TimbraturaLavorazione[];
}
