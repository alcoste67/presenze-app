import { STATI } from "@/constants/stati";
import { CORREZIONI_TIMBRATURE } from "@/constants/correzioniTimbrature";
import type { StatoGiornataDipendente } from "@/services/timbrature/statoGiornataDipendente";

export type TipoPromemoriaPush = "ENTRATA" | "PAUSA" | "RIENTRO" | "USCITA";

// Il cron gira ogni 15 minuti (vedi .github/workflows/promemoria-timbrature.yml):
// la finestra deve combaciare con quella cadenza, altrimenti una soglia rischia
// di essere invita più volte (o di essere saltata).
const FINESTRA_MINUTI = 15;

function inFinestra(minutiRoma: number, sogliaMinuti: number): boolean {
  return minutiRoma >= sogliaMinuti && minutiRoma < sogliaMinuti + FINESTRA_MINUTI;
}

/** Quale push (se una) mandare adesso — mai la stessa due volte, a differenza di valutaPromemoria (usata per l'autocorrezione). */
export function valutaPromemoriaPush(
  minutiRoma: number,
  stato: StatoGiornataDipendente
): TipoPromemoriaPush | null {
  if (
    inFinestra(minutiRoma, CORREZIONI_TIMBRATURE.SOGLIA_ORA_ENTRATA * 60) &&
    !stato.haEntrataOggi
  ) {
    return "ENTRATA";
  }

  if (
    inFinestra(minutiRoma, CORREZIONI_TIMBRATURE.SOGLIA_MINUTI_PAUSA) &&
    stato.statoAttuale === STATI.DENTRO
  ) {
    return "PAUSA";
  }

  if (
    inFinestra(minutiRoma, CORREZIONI_TIMBRATURE.SOGLIA_MINUTI_RIENTRO) &&
    stato.statoAttuale === STATI.IN_PAUSA
  ) {
    return "RIENTRO";
  }

  if (
    inFinestra(minutiRoma, CORREZIONI_TIMBRATURE.SOGLIA_ORA_USCITA * 60) &&
    stato.haEntrataOggi &&
    !stato.haUscitaOggi
  ) {
    return "USCITA";
  }

  return null;
}
