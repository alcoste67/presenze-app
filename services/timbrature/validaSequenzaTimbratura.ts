import { STATI, TIMBRATURE } from "@/constants/stati";
import {
  StatoLavoratore,
  TipoTimbratura,
} from "@/types/timbrature";

type RisultatoValidazioneSequenza = {
  valida: boolean;
  errore?: string;
};

export function validaSequenzaTimbratura(
  stato: StatoLavoratore,
  tipo: TipoTimbratura
): RisultatoValidazioneSequenza {
  const transizioneValida =
    (stato === STATI.FUORI &&
      tipo === TIMBRATURE.ENTRATA) ||
    (stato === STATI.DENTRO &&
      (tipo === TIMBRATURE.PAUSA ||
        tipo === TIMBRATURE.USCITA)) ||
    (stato === STATI.IN_PAUSA &&
      tipo === TIMBRATURE.RIENTRO);

  if (transizioneValida) {
    return {
      valida: true,
    };
  }

  return {
    valida: false,
    errore: `Timbratura ${tipo} non consentita dallo stato ${stato}`,
  };
}
