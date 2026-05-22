import { TIMBRATURE } from "@/constants/stati";
import type { TipoTimbratura } from "@/types/timbrature";

export type TimbraturaOreUomoLavorazione = {
  id: string;
  user_id: string;
  cantiere_id: string | null;
  tipo: TipoTimbratura;
  created_at: string;
};

export type TimbraturaLavorazioneOreUomo = {
  timbratura_id: string;
  lavorazione_id: string;
};

export type RisultatoOreUomoLavorazioni = {
  oreUomoTotaliMinuti: number;
  oreUomoMinutiByLavorazioneId: Map<
    string,
    number
  >;
};

type Params = {
  cantiereId: string;
  timbrature: TimbraturaOreUomoLavorazione[];
  timbratureLavorazioni: TimbraturaLavorazioneOreUomo[];
};

type InizioSegmento = {
  timestamp: number;
  cantiereId: string | null;
};

const MILLISECONDI_PER_MINUTO = 60 * 1000;

function aggiungiMillisecondi(
  valori: Map<string, number>,
  cantiereId: string | null,
  millisecondi: number
) {
  if (!cantiereId || millisecondi <= 0) {
    return;
  }

  valori.set(
    cantiereId,
    (valori.get(cantiereId) || 0) +
      millisecondi
  );
}

function getMinutiDaMillisecondi(
  millisecondi: number
) {
  return Math.max(
    0,
    Math.floor(
      millisecondi / MILLISECONDI_PER_MINUTO
    )
  );
}

function distribuisciMinuti(
  minuti: number,
  lavorazioneIds: string[],
  oreUomoMinutiByLavorazioneId: Map<
    string,
    number
  >
) {
  if (
    minuti <= 0 ||
    lavorazioneIds.length === 0
  ) {
    return;
  }

  const lavorazioneIdsUniche = Array.from(
    new Set(lavorazioneIds)
  ).sort();
  const minutiBase = Math.floor(
    minuti / lavorazioneIdsUniche.length
  );
  const resto =
    minuti % lavorazioneIdsUniche.length;

  lavorazioneIdsUniche.forEach(
    (lavorazioneId, index) => {
      const minutiLavorazione =
        minutiBase + (index < resto ? 1 : 0);

      oreUomoMinutiByLavorazioneId.set(
        lavorazioneId,
        (oreUomoMinutiByLavorazioneId.get(
          lavorazioneId
        ) || 0) + minutiLavorazione
      );
    }
  );
}

function raggruppaLavorazioniPerTimbratura(
  timbratureLavorazioni: TimbraturaLavorazioneOreUomo[]
) {
  const lavorazioniByTimbraturaId = new Map<
    string,
    string[]
  >();

  timbratureLavorazioni.forEach(
    (timbraturaLavorazione) => {
      const lavorazioni =
        lavorazioniByTimbraturaId.get(
          timbraturaLavorazione.timbratura_id
        ) || [];

      lavorazioni.push(
        timbraturaLavorazione.lavorazione_id
      );

      lavorazioniByTimbraturaId.set(
        timbraturaLavorazione.timbratura_id,
        lavorazioni
      );
    }
  );

  return lavorazioniByTimbraturaId;
}

function raggruppaTimbraturePerUtente(
  timbrature: TimbraturaOreUomoLavorazione[]
) {
  const timbratureByUserId = new Map<
    string,
    TimbraturaOreUomoLavorazione[]
  >();

  timbrature.forEach((timbratura) => {
    const timbratureUtente =
      timbratureByUserId.get(
        timbratura.user_id
      ) || [];

    timbratureUtente.push(timbratura);
    timbratureByUserId.set(
      timbratura.user_id,
      timbratureUtente
    );
  });

  timbratureByUserId.forEach(
    (timbratureUtente) => {
      timbratureUtente.sort(
        (prima, seconda) =>
          new Date(prima.created_at).getTime() -
            new Date(
              seconda.created_at
            ).getTime() ||
          prima.id.localeCompare(seconda.id)
      );
    }
  );

  return timbratureByUserId;
}

export function calcolaOreUomoLavorazioni({
  cantiereId,
  timbrature,
  timbratureLavorazioni,
}: Params): RisultatoOreUomoLavorazioni {
  const lavorazioniByTimbraturaId =
    raggruppaLavorazioniPerTimbratura(
      timbratureLavorazioni
    );
  const timbratureByUserId =
    raggruppaTimbraturePerUtente(timbrature);
  const oreUomoMinutiByLavorazioneId =
    new Map<string, number>();
  let totaleMillisecondiCantiere = 0;

  timbratureByUserId.forEach(
    (timbratureUtente) => {
      let inizioSegmento: InizioSegmento | null =
        null;
      const millisecondiPendentiByCantiereId =
        new Map<string, number>();

      const chiudiSegmento = (
        timestampFine: number
      ) => {
        if (!inizioSegmento) {
          return null;
        }

        const millisecondiSegmento =
          timestampFine -
          inizioSegmento.timestamp;
        const cantiereIdSegmento =
          inizioSegmento.cantiereId;

        if (
          cantiereIdSegmento === cantiereId &&
          millisecondiSegmento > 0
        ) {
          totaleMillisecondiCantiere +=
            millisecondiSegmento;
        }

        aggiungiMillisecondi(
          millisecondiPendentiByCantiereId,
          cantiereIdSegmento,
          millisecondiSegmento
        );

        inizioSegmento = null;

        return cantiereIdSegmento;
      };

      const assegnaPendenti = (
        timbraturaId: string,
        cantiereIdSorgente: string | null
      ) => {
        if (cantiereIdSorgente !== cantiereId) {
          return;
        }

        const lavorazioneIds =
          lavorazioniByTimbraturaId.get(
            timbraturaId
          ) || [];
        const millisecondiPendenti =
          millisecondiPendentiByCantiereId.get(
            cantiereIdSorgente
          ) || 0;

        distribuisciMinuti(
          getMinutiDaMillisecondi(
            millisecondiPendenti
          ),
          lavorazioneIds,
          oreUomoMinutiByLavorazioneId
        );

        millisecondiPendentiByCantiereId.delete(
          cantiereIdSorgente
        );
      };

      timbratureUtente.forEach((timbratura) => {
        const timestampTimbratura = new Date(
          timbratura.created_at
        ).getTime();

        if (
          timbratura.tipo ===
            TIMBRATURE.ENTRATA ||
          timbratura.tipo ===
            TIMBRATURE.RIENTRO
        ) {
          if (!inizioSegmento) {
            inizioSegmento = {
              timestamp: timestampTimbratura,
              cantiereId:
                timbratura.cantiere_id,
            };
          }

          return;
        }

        if (
          timbratura.tipo === TIMBRATURE.PAUSA
        ) {
          chiudiSegmento(
            timestampTimbratura
          );

          return;
        }

        if (
          timbratura.tipo === TIMBRATURE.USCITA
        ) {
          const cantiereIdSorgente =
            chiudiSegmento(
              timestampTimbratura
            ) || timbratura.cantiere_id;

          assegnaPendenti(
            timbratura.id,
            cantiereIdSorgente
          );

          return;
        }

        if (
          timbratura.tipo ===
          TIMBRATURE.CAMBIO_CANTIERE
        ) {
          const cantiereIdSorgente =
            chiudiSegmento(
              timestampTimbratura
            ) ||
            (lavorazioniByTimbraturaId.has(
              timbratura.id
            )
              ? cantiereId
              : null);

          assegnaPendenti(
            timbratura.id,
            cantiereIdSorgente
          );

          inizioSegmento = {
            timestamp: timestampTimbratura,
            cantiereId:
              timbratura.cantiere_id,
          };
        }
      });
    }
  );

  return {
    oreUomoTotaliMinuti:
      getMinutiDaMillisecondi(
        totaleMillisecondiCantiere
      ),
    oreUomoMinutiByLavorazioneId,
  };
}
