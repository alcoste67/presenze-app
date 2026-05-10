import { TipoAttivita } from "@/types/attivita";

type Params = {
  cantiereId: string | null;
  attivitaTipo: TipoAttivita | null;
};

type RisultatoValidazioneDestinazione = {
  valida: boolean;
  errore?: string;
};

export function validaDestinazioneTimbratura({
  cantiereId,
  attivitaTipo,
}: Params): RisultatoValidazioneDestinazione {
  const haCantiere = Boolean(cantiereId);
  const haAttivita = Boolean(attivitaTipo);

  if (haCantiere === haAttivita) {
    return {
      valida: false,
      errore:
        "Seleziona un cantiere oppure un'attività",
    };
  }

  return {
    valida: true,
  };
}
