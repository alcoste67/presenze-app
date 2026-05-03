"use client";

import { useCallback, useState } from "react";

import {
  Timbratura,
  TipoTimbratura,
} from "@/types/timbrature";
import { calcolaStatoDaUltimaTimbratura } from "@/services/timbrature/calcolaStato";
import { creaTimbratura } from "@/services/timbrature/creaTimbratura";
import { loadUltimaTimbratura } from "@/services/timbrature/loadUltimaTimbratura";

type Params = {
  userId: string | null;
};

type HandleTimbraturaParams = {
  cantiereId: string;
  tipo: TipoTimbratura;
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
      tipo,
    }: HandleTimbraturaParams) => {
      if (!userId) {
        throw new Error(
          "Utente non autenticato"
        );
      }

      if (!cantiereId) {
        throw new Error(
          "Seleziona un cantiere"
        );
      }

      try {
        setLoadingTimbratura(true);

        const nuovaTimbratura =
          await creaTimbratura({
            userId,
            cantiereId,
            tipo,
          });

        setUltimaTimbratura(
          nuovaTimbratura
        );

        return nuovaTimbratura;
      } finally {
        setLoadingTimbratura(false);
      }
    },
    [userId]
  );

  return {
    ultimaTimbratura,
    statoAttuale,
    loadingTimbratura,
    refreshUltimaTimbratura,
    handleTimbratura,
  };
}
