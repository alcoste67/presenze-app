import {
  STATI,
  TIMBRATURE,
} from "@/constants/stati";
import {
  StatoLavoratore,
  TipoTimbratura,
} from "@/types/timbrature";

export function calcolaStatoDaUltimaTimbratura(
  ultimaTimbratura?: TipoTimbratura
): StatoLavoratore {
  switch (ultimaTimbratura) {
    case TIMBRATURE.ENTRATA:
      return STATI.DENTRO;

    case TIMBRATURE.RIENTRO:
      return STATI.DENTRO;

    case TIMBRATURE.CAMBIO_CANTIERE:
      return STATI.DENTRO;

    case TIMBRATURE.PAUSA:
      return STATI.IN_PAUSA;

    case TIMBRATURE.USCITA:
    default:
      return STATI.FUORI;
  }
}
