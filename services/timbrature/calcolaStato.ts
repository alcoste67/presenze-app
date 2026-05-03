import {
  StatoLavoratore,
  TipoTimbratura,
} from "@/types/timbrature";

export function calcolaStatoDaUltimaTimbratura(
  ultimaTimbratura?: TipoTimbratura
): StatoLavoratore {
  switch (ultimaTimbratura) {
    case "ENTRATA":
      return "DENTRO";

    case "RIENTRO":
      return "DENTRO";

    case "PAUSA":
      return "IN_PAUSA";

    case "USCITA":
    default:
      return "FUORI";
  }
}