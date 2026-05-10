import { supabase } from "@/lib/supabase";

import { TIMBRATURE } from "@/constants/stati";
import { TipoAttivita } from "@/types/attivita";
import {
  Timbratura,
  TipoTimbratura,
} from "@/types/timbrature";
import { calcolaStatoDaUltimaTimbratura } from "@/services/timbrature/calcolaStato";
import { loadUltimaTimbratura } from "@/services/timbrature/loadUltimaTimbratura";
import { validaDestinazioneTimbratura } from "@/services/timbrature/validaDestinazioneTimbratura";
import { validaSequenzaTimbratura } from "@/services/timbrature/validaSequenzaTimbratura";

type Params = {
  userId: string;
  cantiereId: string | null;
  attivitaTipo: TipoAttivita | null;
  tipo: TipoTimbratura;
};

export async function creaTimbratura({
  userId,
  cantiereId,
  attivitaTipo,
  tipo,
}: Params): Promise<Timbratura> {
  const ultimaTimbratura =
    await loadUltimaTimbratura(userId);

  const statoAttuale =
    calcolaStatoDaUltimaTimbratura(
      ultimaTimbratura?.tipo
    );

  const validazione =
    validaSequenzaTimbratura(
      statoAttuale,
      tipo
    );

  if (!validazione.valida) {
    throw new Error(
      validazione.errore ||
        "Sequenza timbratura non valida"
    );
  }

  const destinazioneCantiereId =
    tipo === TIMBRATURE.ENTRATA
      ? cantiereId
      : cantiereId ||
        ultimaTimbratura?.cantiere_id ||
        null;

  const destinazioneAttivitaTipo =
    tipo === TIMBRATURE.ENTRATA
      ? attivitaTipo
      : attivitaTipo ||
        ultimaTimbratura?.attivita_tipo ||
        null;

  const validazioneDestinazione =
    validaDestinazioneTimbratura({
      cantiereId: destinazioneCantiereId,
      attivitaTipo:
        destinazioneAttivitaTipo,
    });

  if (!validazioneDestinazione.valida) {
    throw new Error(
      validazioneDestinazione.errore ||
        "Destinazione timbratura non valida"
    );
  }

  const { data, error } = await supabase
    .from("timbrature")
    .insert({
      user_id: userId,
      cantiere_id:
        destinazioneCantiereId,
      attivita_tipo:
        destinazioneAttivitaTipo,
      tipo,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Timbratura;
}
