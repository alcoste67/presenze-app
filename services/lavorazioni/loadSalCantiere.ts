import { supabase } from "@/lib/supabase";

import { SAL_STATI } from "@/constants/sal";
import { calcolaOreUomoLavorazioni } from "@/services/lavorazioni/calcolaOreUomoLavorazioni";
import type {
  TimbraturaLavorazioneOreUomo,
  TimbraturaOreUomoLavorazione,
} from "@/services/lavorazioni/calcolaOreUomoLavorazioni";
import type {
  SalCantiere,
  SalLavorazione,
  StatoSalLavorazione,
} from "@/types/sal";

const SELECT_LAVORAZIONE_SAL =
  "id, cantiere_id, nome, ordine, percentuale_completamento";
const SELECT_TIMBRATURA_ORE_UOMO =
  "id, user_id, cantiere_id, tipo, created_at";
const SELECT_TIMBRATURA_LAVORAZIONE_ORE_UOMO =
  "timbratura_id, lavorazione_id";

type LavorazioneSalRow = {
  id: string;
  cantiere_id: string;
  nome: string;
  ordine: number;
  percentuale_completamento: number;
};

function getStatoSalLavorazione(
  percentuale: number
): StatoSalLavorazione {
  if (percentuale === 0) {
    return SAL_STATI.NON_INIZIATA;
  }

  if (percentuale === 100) {
    return SAL_STATI.COMPLETATA;
  }

  return SAL_STATI.IN_CORSO;
}

function getAvanzamentoTotale(
  lavorazioni: SalLavorazione[]
) {
  if (lavorazioni.length === 0) {
    return 0;
  }

  const totale = lavorazioni.reduce(
    (somma, lavorazione) =>
      somma +
      lavorazione.percentuale_completamento,
    0
  );

  return Math.round(totale / lavorazioni.length);
}

async function loadTimbratureLavorazioni(
  lavorazioneIds: string[]
): Promise<TimbraturaLavorazioneOreUomo[]> {
  if (lavorazioneIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("timbrature_lavorazioni")
    .select(
      SELECT_TIMBRATURA_LAVORAZIONE_ORE_UOMO
    )
    .in("lavorazione_id", lavorazioneIds);

  if (error) {
    throw error;
  }

  return (
    data || []
  ) as TimbraturaLavorazioneOreUomo[];
}

async function loadTimbratureCantiere(
  cantiereId: string
): Promise<TimbraturaOreUomoLavorazione[]> {
  const { data, error } = await supabase
    .from("timbrature")
    .select(SELECT_TIMBRATURA_ORE_UOMO)
    .eq("cantiere_id", cantiereId);

  if (error) {
    throw error;
  }

  return (
    data || []
  ) as TimbraturaOreUomoLavorazione[];
}

async function loadTimbratureByUserIds(
  userIds: string[]
): Promise<TimbraturaOreUomoLavorazione[]> {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("timbrature")
    .select(SELECT_TIMBRATURA_ORE_UOMO)
    .in("user_id", userIds)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (
    data || []
  ) as TimbraturaOreUomoLavorazione[];
}

function unisciTimbrature(
  timbrature: TimbraturaOreUomoLavorazione[]
): TimbraturaOreUomoLavorazione[] {
  return Array.from(
    new Map(
      timbrature.map((timbratura) => [
        timbratura.id,
        timbratura,
      ])
    ).values()
  );
}

export async function loadSalCantiere(
  cantiereId: string
): Promise<SalCantiere> {
  if (!cantiereId) {
    return {
      cantiereId,
      avanzamentoTotale: 0,
      oreUomoTotaliMinuti: 0,
      lavorazioni: [],
    };
  }

  const { data, error } = await supabase
    .from("lavorazioni_cantiere")
    .select(SELECT_LAVORAZIONE_SAL)
    .eq("cantiere_id", cantiereId)
    .eq("attiva", true)
    .order("ordine", {
      ascending: true,
    })
    .order("nome", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const lavorazioniRows =
    (data || []) as LavorazioneSalRow[];
  const lavorazioneIds = lavorazioniRows.map(
    (lavorazione) => lavorazione.id
  );
  const timbratureLavorazioni =
    await loadTimbratureLavorazioni(
      lavorazioneIds
    );
  const timbratureCantiere =
    await loadTimbratureCantiere(cantiereId);
  const userIdsCantiere =
    Array.from(
      new Set(
        timbratureCantiere.map(
          (timbratura) => timbratura.user_id
        )
      )
    );
  const timbratureUtenti =
    await loadTimbratureByUserIds(
      userIdsCantiere
    );
  const oreUomo =
    calcolaOreUomoLavorazioni({
      cantiereId,
      timbrature: unisciTimbrature([
        ...timbratureCantiere,
        ...timbratureUtenti,
      ]),
      timbratureLavorazioni,
    });

  const lavorazioni = lavorazioniRows.map((lavorazione) => ({
    ...lavorazione,
    oreUomoMinuti:
      oreUomo.oreUomoMinutiByLavorazioneId.get(
        lavorazione.id
      ) || 0,
    stato: getStatoSalLavorazione(
      lavorazione.percentuale_completamento
    ),
  }));

  return {
    cantiereId,
    avanzamentoTotale:
      getAvanzamentoTotale(lavorazioni),
    oreUomoTotaliMinuti:
      oreUomo.oreUomoTotaliMinuti,
    lavorazioni,
  };
}
