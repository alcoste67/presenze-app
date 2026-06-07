import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import {
  LAVORAZIONI_LIMITI,
  LAVORAZIONI_TESTI,
} from "@/constants/lavorazioni";
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

function isPercentualeValida(
  percentuale: number | null
) {
  return (
    percentuale === null ||
    (Number.isInteger(percentuale) &&
      percentuale >=
        LAVORAZIONI_LIMITI.PERCENTUALE_MIN &&
      percentuale <=
        LAVORAZIONI_LIMITI.PERCENTUALE_MAX)
  );
}

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Utente non autenticato");
  const aziendaId = await getAziendaIdFromAuthUser(supabase, user.id);

  const percentualiValide =
    lavorazioniUniche.every(
      (lavorazione) =>
        isPercentualeValida(
          lavorazione.percentualeAvanzamento
        )
    );

  if (!percentualiValide) {
    throw new Error(
      LAVORAZIONI_TESTI.ERRORI
        .PERCENTUALE_NON_VALIDA
    );
  }

  const righe = lavorazioniUniche.map(
    (lavorazione) => ({
      timbratura_id: timbraturaId,
      lavorazione_id:
        lavorazione.lavorazioneId,
      percentuale_avanzamento:
        lavorazione.percentualeAvanzamento,
      azienda_id: aziendaId,
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

  await Promise.all(
    lavorazioniUniche
      .filter(
        (lavorazione) =>
          lavorazione.percentualeAvanzamento !==
          null
      )
      .map(async (lavorazione) => {
        const { error: updateError } =
          await supabase
            .from("lavorazioni_cantiere")
            .update({
              percentuale_completamento:
                lavorazione.percentualeAvanzamento,
            })
            .eq(
              "id",
              lavorazione.lavorazioneId
            );

        if (updateError) {
          throw updateError;
        }
      })
  );

  return (data || []) as TimbraturaLavorazione[];
}
