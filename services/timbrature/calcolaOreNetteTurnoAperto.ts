import { TIMBRATURE } from "@/constants/stati";
import type { TipoTimbratura } from "@/types/timbrature";

type EventoTimbratura = {
  id: string;
  tipo: TipoTimbratura;
  created_at: string;
};

export type TurnoAperto = {
  timbraturaAperturaId: string;
  apertoDalle: Date;
  oreNette: number;
};

const TIPI_APERTURA: TipoTimbratura[] = [
  TIMBRATURE.ENTRATA,
  TIMBRATURE.RIENTRO,
  TIMBRATURE.CAMBIO_CANTIERE,
];

/**
 * Dato lo storico timbrature di un dipendente (ordinato ASCENDENTE per
 * created_at, quanto basta per coprire anche un turno che ha superato la
 * mezzanotte), calcola il turno ancora aperto e le ore nette lavorate finora
 * (sottraendo le pause). Ritorna null se il turno è chiuso (ultima
 * timbratura = USCITA) o se non c'è storico.
 */
export function calcolaTurnoApertoENetteOre(
  eventi: EventoTimbratura[],
  adesso: Date = new Date()
): TurnoAperto | null {
  if (eventi.length === 0) return null;

  const ultimo = eventi[eventi.length - 1];
  if (ultimo.tipo === TIMBRATURE.USCITA) return null;

  let inizioTurno = 0;
  for (let i = eventi.length - 1; i >= 0; i--) {
    if (eventi[i].tipo === TIMBRATURE.USCITA) {
      inizioTurno = i + 1;
      break;
    }
  }

  const eventiTurno = eventi.slice(inizioTurno);
  const apertura = eventiTurno[0];
  if (!TIPI_APERTURA.includes(apertura.tipo)) return null;

  let millisecondiLavorati = 0;
  let cursore = new Date(apertura.created_at);
  let lavorando = true;

  for (let i = 1; i < eventiTurno.length; i++) {
    const evento = eventiTurno[i];
    const orarioEvento = new Date(evento.created_at);

    if (lavorando) {
      millisecondiLavorati += orarioEvento.getTime() - cursore.getTime();
    }

    if (TIPI_APERTURA.includes(evento.tipo)) {
      lavorando = true;
    } else if (evento.tipo === TIMBRATURE.PAUSA) {
      lavorando = false;
    }
    cursore = orarioEvento;
  }

  if (lavorando) {
    millisecondiLavorati += adesso.getTime() - cursore.getTime();
  }

  return {
    timbraturaAperturaId: apertura.id,
    apertoDalle: new Date(apertura.created_at),
    oreNette: millisecondiLavorati / 3_600_000,
  };
}
