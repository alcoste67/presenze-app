import { CORREZIONI_TIMBRATURE } from "@/constants/correzioniTimbrature";
import { STATI } from "@/constants/stati";
import type { StatoGiornataDipendente } from "@/services/timbrature/statoGiornataDipendente";

export type TipoPromemoria = "ENTRATA" | "USCITA";

/**
 * Determina se, data l'ora attuale (Italia) e lo stato della giornata, va
 * mandato un promemoria/è disponibile una correzione — e di quale tipo.
 * Stessa logica usata dal cron (chi avvisare) e dalla route di correzione
 * (per non fidarsi del client).
 */
export function valutaPromemoria(
  oraRoma: number,
  stato: StatoGiornataDipendente,
  giornoLavorativo: boolean
): TipoPromemoria | null {
  if (!giornoLavorativo) {
    return null;
  }

  if (oraRoma >= CORREZIONI_TIMBRATURE.SOGLIA_ORA_ENTRATA && !stato.haEntrataOggi) {
    return "ENTRATA";
  }

  // "sei attualmente dentro", non "è mai risultata un'uscita oggi": con più
  // cicli entrata/uscita nello stesso giorno (es. attività poi cantiere) il
  // secondo controllo resta vero anche se il dipendente è di nuovo dentro.
  if (
    oraRoma >= CORREZIONI_TIMBRATURE.SOGLIA_ORA_USCITA &&
    stato.statoAttuale === STATI.DENTRO
  ) {
    return "USCITA";
  }

  return null;
}
