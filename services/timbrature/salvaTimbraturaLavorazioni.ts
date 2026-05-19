import { supabase } from "@/lib/supabase";
import type { TimbraturaLavorazione } from "@/types/timbratureLavorazioni";

const SELECT_TIMBRATURA_LAVORAZIONE =
  "id, timbratura_id, lavorazione_id, created_at";

type Params = {
  timbraturaId: string;
  lavorazioneIds: string[];
};

export async function salvaTimbraturaLavorazioni({
  timbraturaId,
  lavorazioneIds,
}: Params): Promise<TimbraturaLavorazione[]> {
  const lavorazioneIdsUnici = Array.from(
    new Set(lavorazioneIds)
  );

  if (
    !timbraturaId ||
    lavorazioneIdsUnici.length === 0
  ) {
    return [];
  }

  const righe = lavorazioneIdsUnici.map(
    (lavorazioneId) => ({
      timbratura_id: timbraturaId,
      lavorazione_id: lavorazioneId,
    })
  );

  const { data, error } = await supabase
    .from("timbrature_lavorazioni")
    .upsert(righe, {
      onConflict:
        "timbratura_id,lavorazione_id",
      ignoreDuplicates: true,
    })
    .select(SELECT_TIMBRATURA_LAVORAZIONE);

  if (error) {
    throw error;
  }

  return (data || []) as TimbraturaLavorazione[];
}
