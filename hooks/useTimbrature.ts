"use client";

import { useCallback, useState } from "react";

import { TIMBRATURE } from "@/constants/stati";
import { TipoAttivita } from "@/types/attivita";
import {
  Timbratura,
  TipoTimbratura,
} from "@/types/timbrature";
import { calcolaStatoDaUltimaTimbratura } from "@/services/timbrature/calcolaStato";
import { creaTimbratura } from "@/services/timbrature/creaTimbratura";
import { loadUltimaTimbratura } from "@/services/timbrature/loadUltimaTimbratura";
import { salvaTimbraturaLavorazioni } from "@/services/timbrature/salvaTimbraturaLavorazioni";

type Params = {
  userId: string | null;
};

type HandleTimbraturaParams = {
  cantiereId: string | null;
  attivitaTipo: TipoAttivita | null;
  tipo: TipoTimbratura;
  lavorazioneIds?: string[];
};

export function useTimbrature({
  userId,
}: Params) {
  const [
    ultimaTimbratura,
    setUltimaTimbratura,
  ] = useState<Timbratura | null>(null);

  const [
    loadingTimbratura,
    setLoadingTimbratura,
  ] = useState(false);

  const statoAttuale =
    calcolaStatoDaUltimaTimbratura(
      ultimaTimbratura?.tipo
    );

  const refreshUltimaTimbratura =
    useCallback(
      async (targetUserId: string | null) => {
        if (!targetUserId) {
          setUltimaTimbratura(null);

          return null;
        }

        const ultima =
          await loadUltimaTimbratura(
            targetUserId
          );

        setUltimaTimbratura(ultima);

        return ultima;
      },
      []
    );

  const handleTimbratura = useCallback(
    async ({
      cantiereId,
      attivitaTipo,
      tipo,
      lavorazioneIds = [],
    }: HandleTimbraturaParams) => {
      if (!userId) {
        throw new Error(
          "Utente non autenticato"
        );
      }

      try {
        setLoadingTimbratura(true);

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

        const nuovaTimbratura =
          await creaTimbratura({
            userId,
            cantiereId:
              destinazioneCantiereId,
            attivitaTipo:
              destinazioneAttivitaTipo,
            tipo,
          });

        if (
          tipo === TIMBRATURE.USCITA &&
          lavorazioneIds.length > 0
        ) {
          await salvaTimbraturaLavorazioni({
            timbraturaId:
              nuovaTimbratura.id,
            lavorazioneIds,
          });
        }

        setUltimaTimbratura(
          nuovaTimbratura
        );

        return nuovaTimbratura;
      } finally {
        setLoadingTimbratura(false);
      }
    },
    [ultimaTimbratura, userId]
  );

  return {
    ultimaTimbratura,
    statoAttuale,
    loadingTimbratura,
    refreshUltimaTimbratura,
    handleTimbratura,
  };
}
