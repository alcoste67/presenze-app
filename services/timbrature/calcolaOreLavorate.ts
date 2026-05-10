import { TIMBRATURE } from "@/constants/stati";
import { TimbraturaStorico } from "@/services/timbrature/loadStoricoTimbrature";

type TimbraturaCalcoloOre = Pick<
  TimbraturaStorico,
  "tipo" | "created_at"
>;

export type RisultatoOreLavorate = {
  totaleMinuti: number;
  giornataAperta: boolean;
  sequenzaIncompleta: boolean;
};

export function calcolaOreLavorate(
  timbrature: TimbraturaCalcoloOre[]
): RisultatoOreLavorate {
  let totaleMillisecondi = 0;
  let inizioIntervallo: Date | null = null;
  let sequenzaIncompleta = false;

  for (const timbratura of timbrature) {
    const dataTimbratura = new Date(
      timbratura.created_at
    );

    if (
      timbratura.tipo ===
        TIMBRATURE.ENTRATA ||
      timbratura.tipo === TIMBRATURE.RIENTRO
    ) {
      if (inizioIntervallo) {
        sequenzaIncompleta = true;
        continue;
      }

      inizioIntervallo = dataTimbratura;
      continue;
    }

    if (
      timbratura.tipo === TIMBRATURE.PAUSA ||
      timbratura.tipo === TIMBRATURE.USCITA
    ) {
      if (!inizioIntervallo) {
        sequenzaIncompleta = true;
        continue;
      }

      totaleMillisecondi +=
        dataTimbratura.getTime() -
        inizioIntervallo.getTime();

      inizioIntervallo = null;
    }
  }

  return {
    totaleMinuti: Math.max(
      0,
      Math.floor(
        totaleMillisecondi / 1000 / 60
      )
    ),
    giornataAperta: Boolean(
      inizioIntervallo
    ),
    sequenzaIncompleta,
  };
}
