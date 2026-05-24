import {
  RAPPORTI_INTERVENTO_TIME_ZONE,
} from "@/constants/rapportiIntervento";
import { supabase } from "@/lib/supabase";
import { calcolaOreUomoLavorazioni } from "@/services/lavorazioni/calcolaOreUomoLavorazioni";
import type {
  TimbraturaLavorazioneOreUomo,
  TimbraturaOreUomoLavorazione,
} from "@/services/lavorazioni/calcolaOreUomoLavorazioni";
import type { TipoTimbratura } from "@/types/timbrature";
import type { RapportoInterventoLavorazioneSnapshot } from "@/types/rapportiIntervento";

type SupabaseClient = typeof supabase;

type Params = {
  cantiereId: string;
  dataIntervento: string;
};

type LavorazioneRow = {
  id: string;
  nome: string;
  ordine: number;
};

type TimbraturaRow = {
  id: string;
  user_id: string;
  cantiere_id: string | null;
  tipo: string;
  created_at: string;
};

const DATA_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})$/;

const SELECT_LAVORAZIONE =
  "id, nome, ordine";
const SELECT_TIMBRATURA =
  "id, user_id, cantiere_id, tipo, created_at";
const SELECT_TIMBRATURA_LAVORAZIONE =
  "timbratura_id, lavorazione_id";

function getDateTimePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): number {
  const value = parts.find(
    (part) => part.type === type
  )?.value;

  if (!value) {
    return 0;
  }

  return Number(value);
}

function getTimeZoneOffsetMs(
  data: Date
): number {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone:
        RAPPORTI_INTERVENTO_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  ).formatToParts(data);

  const localeAsUtc = Date.UTC(
    getDateTimePart(parts, "year"),
    getDateTimePart(parts, "month") - 1,
    getDateTimePart(parts, "day"),
    getDateTimePart(parts, "hour"),
    getDateTimePart(parts, "minute"),
    getDateTimePart(parts, "second")
  );

  return localeAsUtc - data.getTime();
}

function parseDataInput(data: string) {
  const match = DATA_PATTERN.exec(data);

  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function getDataInputSuccessiva(data: string) {
  const parts = parseDataInput(data);

  if (!parts) {
    return data;
  }

  const dataUtc = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day
    )
  );

  dataUtc.setUTCDate(
    dataUtc.getUTCDate() + 1
  );

  const year = dataUtc.getUTCFullYear();
  const month = String(
    dataUtc.getUTCMonth() + 1
  ).padStart(2, "0");
  const day = String(
    dataUtc.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getUtcDaDataLocale(
  data: string
): Date | null {
  const parts = parseDataInput(data);

  if (!parts) {
    return null;
  }

  let utcTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day
  );
  const offset = getTimeZoneOffsetMs(
    new Date(utcTime)
  );

  utcTime -= offset;

  const offsetCorretto =
    getTimeZoneOffsetMs(new Date(utcTime));

  if (offsetCorretto !== offset) {
    utcTime -= offsetCorretto - offset;
  }

  return new Date(utcTime);
}

function unisciTimbrature(
  timbrature: TimbraturaOreUomoLavorazione[]
) {
  return Array.from(
    new Map(
      timbrature.map((timbratura) => [
        timbratura.id,
        timbratura,
      ])
    ).values()
  );
}

function castTimbratura(
  timbratura: TimbraturaRow
): TimbraturaOreUomoLavorazione {
  return {
    ...timbratura,
    tipo: timbratura.tipo as TipoTimbratura,
  };
}

async function loadTimbratureLavorazioni(
  timbraturaIds: string[],
  supabaseClient: SupabaseClient
): Promise<TimbraturaLavorazioneOreUomo[]> {
  if (timbraturaIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseClient
    .from("timbrature_lavorazioni")
    .select(SELECT_TIMBRATURA_LAVORAZIONE)
    .in("timbratura_id", timbraturaIds);

  if (error) {
    throw error;
  }

  return (
    data || []
  ) as TimbraturaLavorazioneOreUomo[];
}

export async function loadLavorazioniRapportoIntervento(
  {
    cantiereId,
    dataIntervento,
  }: Params,
  supabaseClient: SupabaseClient = supabase
): Promise<
  RapportoInterventoLavorazioneSnapshot[]
> {
  if (!cantiereId || !dataIntervento) {
    return [];
  }

  const dataInizio =
    getUtcDaDataLocale(dataIntervento);
  const dataFine = getUtcDaDataLocale(
    getDataInputSuccessiva(dataIntervento)
  );

  const { data: lavorazioniData, error } =
    await supabaseClient
      .from("lavorazioni_cantiere")
      .select(SELECT_LAVORAZIONE)
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

  const lavorazioni =
    (lavorazioniData || []) as LavorazioneRow[];

  if (!dataInizio || !dataFine) {
    return lavorazioni.map(
      (lavorazione, index) => ({
        lavorazione_id: lavorazione.id,
        descrizione_snapshot:
          lavorazione.nome,
        ore_uomo_minuti: 0,
        ordine: lavorazione.ordine || index + 1,
      })
    );
  }

  const {
    data: timbratureCantiereData,
    error: timbratureCantiereError,
  } = await supabaseClient
    .from("timbrature")
    .select(SELECT_TIMBRATURA)
    .eq("cantiere_id", cantiereId)
    .gte(
      "created_at",
      dataInizio.toISOString()
    )
    .lt("created_at", dataFine.toISOString())
    .order("created_at", {
      ascending: true,
    });

  if (timbratureCantiereError) {
    throw timbratureCantiereError;
  }

  const timbratureCantiere =
    (timbratureCantiereData ||
      []) as TimbraturaRow[];
  const userIds = Array.from(
    new Set(
      timbratureCantiere.map(
        (timbratura) => timbratura.user_id
      )
    )
  );

  let timbratureUtenti: TimbraturaRow[] = [];

  if (userIds.length > 0) {
    const {
      data: timbratureUtentiData,
      error: timbratureUtentiError,
    } = await supabaseClient
      .from("timbrature")
      .select(SELECT_TIMBRATURA)
      .in("user_id", userIds)
      .gte(
        "created_at",
        dataInizio.toISOString()
      )
      .lt(
        "created_at",
        dataFine.toISOString()
      )
      .order("created_at", {
        ascending: true,
      });

    if (timbratureUtentiError) {
      throw timbratureUtentiError;
    }

    timbratureUtenti =
      (timbratureUtentiData ||
        []) as TimbraturaRow[];
  }

  const timbrature = unisciTimbrature(
    [
      ...timbratureCantiere,
      ...timbratureUtenti,
    ].map(castTimbratura)
  );
  const timbraturaIds = timbrature.map(
    (timbratura) => timbratura.id
  );
  const timbratureLavorazioni =
    await loadTimbratureLavorazioni(
      timbraturaIds,
      supabaseClient
    );
  const oreUomo =
    calcolaOreUomoLavorazioni({
      cantiereId,
      timbrature,
      timbratureLavorazioni,
    });

  return lavorazioni.map(
    (lavorazione, index) => ({
      lavorazione_id: lavorazione.id,
      descrizione_snapshot: lavorazione.nome,
      ore_uomo_minuti:
        oreUomo.oreUomoMinutiByLavorazioneId.get(
          lavorazione.id
        ) || 0,
      ordine: lavorazione.ordine || index + 1,
    })
  );
}
