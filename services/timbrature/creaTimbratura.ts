import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";

import {
  TIMBRATURE,
  TIMBRATURE_TESTI,
} from "@/constants/stati";
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

  if (tipo === TIMBRATURE.CAMBIO_CANTIERE) {
    if (
      !ultimaTimbratura?.cantiere_id ||
      ultimaTimbratura.attivita_tipo
    ) {
      throw new Error(
        TIMBRATURE_TESTI.ERRORI
          .CAMBIO_CANTIERE_ATTIVITA_NON_CONSENTITA
      );
    }

    if (!cantiereId) {
      throw new Error(
        TIMBRATURE_TESTI.ERRORI
          .CAMBIO_CANTIERE_OBBLIGATORIO
      );
    }

    if (
      cantiereId ===
      ultimaTimbratura.cantiere_id
    ) {
      throw new Error(
        TIMBRATURE_TESTI.ERRORI
          .CAMBIO_CANTIERE_STESSO
      );
    }
  }

  const usaNuovaDestinazione =
    tipo === TIMBRATURE.ENTRATA ||
    tipo === TIMBRATURE.CAMBIO_CANTIERE;

  const destinazioneCantiereId =
    usaNuovaDestinazione
      ? cantiereId
      : ultimaTimbratura?.cantiere_id ||
        null;

  const destinazioneAttivitaTipo =
    usaNuovaDestinazione
      ? attivitaTipo
      : ultimaTimbratura?.attivita_tipo ||
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

  // Verifica che il cantiere esista ed è visibile (stessa azienda, RLS):
  // protegge da liste cantieri rimaste in memoria nella PWA dopo un
  // cambio utente o una modifica al DB
  if (destinazioneCantiereId) {
    const { data: cantiereValido, error: erroreCantiere } =
      await supabase
        .from("cantieri")
        .select("id")
        .eq("id", destinazioneCantiereId)
        .maybeSingle();

    if (erroreCantiere) {
      throw erroreCantiere;
    }

    if (!cantiereValido) {
      throw new Error(
        TIMBRATURE_TESTI.ERRORI
          .CANTIERE_NON_DISPONIBILE
      );
    }
  }

  const aziendaId = await getAziendaIdFromAuthUser(
    supabase,
    userId
  );

  const { data, error } = await supabase
    .from("timbrature")
    .insert({
      user_id: userId,
      cantiere_id:
        destinazioneCantiereId,
      attivita_tipo:
        destinazioneAttivitaTipo,
      tipo,
      azienda_id: aziendaId,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Timbratura;
}
