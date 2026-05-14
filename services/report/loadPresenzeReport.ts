import { ATTIVITA } from "@/constants/attivita";
import {
  LABEL_ATTIVITA_REPORT,
  LABEL_TIMBRATURE_REPORT,
  REPORT_PRESENZE_LIMITI,
  REPORT_PRESENZE_TESTI,
  REPORT_PRESENZE_TIME_ZONE,
} from "@/constants/reportPresenze";
import { TIMBRATURE } from "@/constants/stati";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TipoAttivita } from "@/types/attivita";
import type {
  PresenzeReportFiltri,
  PresenzeReportRiga,
  PresenzeReportRisposta,
} from "@/types/reportPresenze";
import type { TipoTimbratura } from "@/types/timbrature";

const SELECT_TIMBRATURA_REPORT =
  "id, user_id, cantiere_id, attivita_tipo, tipo, created_at";

const SELECT_DIPENDENTE_REPORT =
  "id, nome, cognome, email, auth_user_id";

const SELECT_CANTIERE_REPORT = "id, nome";

const DATA_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})$/;

const TIPI_TIMBRATURA = Object.values(
  TIMBRATURE
) as readonly TipoTimbratura[];

const TIPI_ATTIVITA = Object.values(
  ATTIVITA
) as readonly TipoAttivita[];

const formattaDataReport =
  new Intl.DateTimeFormat("it-IT", {
    timeZone: REPORT_PRESENZE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const formattaOraReport =
  new Intl.DateTimeFormat("it-IT", {
    timeZone: REPORT_PRESENZE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });

type TimbraturaReportRow = {
  id: string;
  user_id: string;
  cantiere_id: string | null;
  attivita_tipo: string | null;
  tipo: string;
  created_at: string;
};

type DipendenteReportRow = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  auth_user_id: string | null;
};

type CantiereReportRow = {
  id: string;
  nome: string;
};

type DataParts = {
  year: number;
  month: number;
  day: number;
};

function parseDataInput(data: string): DataParts {
  const match = DATA_PATTERN.exec(data);

  if (!match) {
    throw new Error(
      REPORT_PRESENZE_TESTI.ERRORI.FILTRI_NON_VALIDI
    );
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formattaDataInput(
  data: Date
): string {
  const year = data.getUTCFullYear();
  const month = String(
    data.getUTCMonth() + 1
  ).padStart(2, "0");
  const day = String(
    data.getUTCDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDataSuccessiva(data: string) {
  const parts = parseDataInput(data);
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

  return formattaDataInput(dataUtc);
}

function getDateTimePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): number {
  const value = parts.find(
    (part) => part.type === type
  )?.value;

  if (!value) {
    throw new Error(
      REPORT_PRESENZE_TESTI.ERRORI.FILTRI_NON_VALIDI
    );
  }

  return Number(value);
}

function getTimeZoneOffsetMs(
  data: Date
): number {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: REPORT_PRESENZE_TIME_ZONE,
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

function getUtcDaDataLocale(
  data: string
): Date {
  const parts = parseDataInput(data);
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

async function loadDipendente(
  dipendenteId: string
): Promise<DipendenteReportRow | null> {
  const { data, error } = await supabaseAdmin
    .from("dipendenti")
    .select(SELECT_DIPENDENTE_REPORT)
    .eq("id", dipendenteId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as DipendenteReportRow | null;
}

async function loadDipendentiByAuthUserIds(
  authUserIds: string[]
): Promise<Map<string, DipendenteReportRow>> {
  if (authUserIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("dipendenti")
    .select(SELECT_DIPENDENTE_REPORT)
    .in("auth_user_id", authUserIds);

  if (error) {
    throw error;
  }

  const dipendenti =
    (data || []) as DipendenteReportRow[];

  return new Map(
    dipendenti
      .filter(
        (dipendente) =>
          dipendente.auth_user_id !== null
      )
      .map((dipendente) => [
        dipendente.auth_user_id as string,
        dipendente,
      ])
  );
}

async function loadCantieriByIds(
  cantiereIds: string[]
): Promise<Map<string, CantiereReportRow>> {
  if (cantiereIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabaseAdmin
    .from("cantieri")
    .select(SELECT_CANTIERE_REPORT)
    .in("id", cantiereIds);

  if (error) {
    throw error;
  }

  const cantieri =
    (data || []) as CantiereReportRow[];

  return new Map(
    cantieri.map((cantiere) => [
      cantiere.id,
      cantiere,
    ])
  );
}

function getValoriUnici(
  valori: Array<string | null>
): string[] {
  return Array.from(
    new Set(
      valori.filter(
        (value): value is string =>
          Boolean(value)
      )
    )
  );
}

function getTipoTimbratura(
  value: string
): TipoTimbratura {
  if (
    TIPI_TIMBRATURA.includes(
      value as TipoTimbratura
    )
  ) {
    return value as TipoTimbratura;
  }

  throw new Error(
    REPORT_PRESENZE_TESTI.ERRORI.GENERICO
  );
}

function getAttivitaTipo(
  value: string | null
): TipoAttivita | null {
  if (!value) {
    return null;
  }

  if (
    TIPI_ATTIVITA.includes(
      value as TipoAttivita
    )
  ) {
    return value as TipoAttivita;
  }

  throw new Error(
    REPORT_PRESENZE_TESTI.ERRORI.GENERICO
  );
}

function formattaDipendente(
  dipendente: DipendenteReportRow | undefined
) {
  if (!dipendente) {
    return REPORT_PRESENZE_TESTI
      .DIPENDENTE_NON_DISPONIBILE;
  }

  return `${dipendente.cognome} ${dipendente.nome}`.trim();
}

function creaRigaReport({
  timbratura,
  dipendentiByAuthUserId,
  cantieriById,
}: {
  timbratura: TimbraturaReportRow;
  dipendentiByAuthUserId: Map<
    string,
    DipendenteReportRow
  >;
  cantieriById: Map<string, CantiereReportRow>;
}): PresenzeReportRiga {
  const tipo = getTipoTimbratura(
    timbratura.tipo
  );
  const attivitaTipo = getAttivitaTipo(
    timbratura.attivita_tipo
  );
  const dipendente =
    dipendentiByAuthUserId.get(
      timbratura.user_id
    );
  const cantiere = timbratura.cantiere_id
    ? cantieriById.get(
        timbratura.cantiere_id
      )
    : undefined;
  const attivita = attivitaTipo
    ? LABEL_ATTIVITA_REPORT[attivitaTipo]
    : REPORT_PRESENZE_TESTI
        .ATTIVITA_NON_DISPONIBILE;
  const cantiereNome =
    cantiere?.nome ||
    REPORT_PRESENZE_TESTI
      .CANTIERE_NON_DISPONIBILE;
  const destinazione =
    cantiere?.nome ||
    attivita ||
    REPORT_PRESENZE_TESTI
      .DESTINAZIONE_NON_DISPONIBILE;
  const dataTimbratura = new Date(
    timbratura.created_at
  );

  return {
    id: timbratura.id,
    created_at: timbratura.created_at,
    data:
      formattaDataReport.format(
        dataTimbratura
      ),
    ora:
      formattaOraReport.format(
        dataTimbratura
      ),
    dipendente:
      formattaDipendente(dipendente),
    email:
      dipendente?.email ||
      REPORT_PRESENZE_TESTI
        .EMAIL_NON_DISPONIBILE,
    tipo,
    tipoLabel: LABEL_TIMBRATURE_REPORT[tipo],
    destinazione,
    cantiere: cantiereNome,
    attivita,
    attivitaTipo,
  };
}

export async function loadPresenzeReport(
  filtri: PresenzeReportFiltri
): Promise<PresenzeReportRisposta> {
  const dipendenteSelezionato =
    filtri.dipendenteId
      ? await loadDipendente(
          filtri.dipendenteId
        )
      : null;

  if (
    filtri.dipendenteId &&
    !dipendenteSelezionato?.auth_user_id
  ) {
    return {
      righe: [],
      limiteRighe:
        REPORT_PRESENZE_LIMITI.MAX_RIGHE,
      limiteRaggiunto: false,
    };
  }

  const dataInizioUtc =
    getUtcDaDataLocale(
      filtri.dataInizio
    ).toISOString();
  const dataFineEsclusivaUtc =
    getUtcDaDataLocale(
      getDataSuccessiva(filtri.dataFine)
    ).toISOString();

  const baseQuery = supabaseAdmin
    .from("timbrature")
    .select(SELECT_TIMBRATURA_REPORT)
    .gte("created_at", dataInizioUtc)
    .lt("created_at", dataFineEsclusivaUtc);

  const queryDipendente =
    dipendenteSelezionato?.auth_user_id
      ? baseQuery.eq(
          "user_id",
          dipendenteSelezionato.auth_user_id
        )
      : baseQuery;

  const queryCantiere = filtri.cantiereId
    ? queryDipendente.eq(
        "cantiere_id",
        filtri.cantiereId
      )
    : queryDipendente;

  const { data, error } =
    await queryCantiere
      .order("created_at", {
        ascending: true,
      })
      .limit(
        REPORT_PRESENZE_LIMITI.MAX_RIGHE + 1
      );

  if (error) {
    throw error;
  }

  const timbrature =
    (data || []) as TimbraturaReportRow[];
  const limiteRaggiunto =
    timbrature.length >
    REPORT_PRESENZE_LIMITI.MAX_RIGHE;
  const timbratureLimitate =
    timbrature.slice(
      0,
      REPORT_PRESENZE_LIMITI.MAX_RIGHE
    );

  const authUserIds = getValoriUnici(
    timbratureLimitate.map(
      (timbratura) => timbratura.user_id
    )
  );
  const cantiereIds = getValoriUnici(
    timbratureLimitate.map(
      (timbratura) =>
        timbratura.cantiere_id
    )
  );

  const [
    dipendentiByAuthUserId,
    cantieriById,
  ] = await Promise.all([
    loadDipendentiByAuthUserIds(
      authUserIds
    ),
    loadCantieriByIds(cantiereIds),
  ]);

  return {
    righe: timbratureLimitate.map(
      (timbratura) =>
        creaRigaReport({
          timbratura,
          dipendentiByAuthUserId,
          cantieriById,
        })
    ),
    limiteRighe:
      REPORT_PRESENZE_LIMITI.MAX_RIGHE,
    limiteRaggiunto,
  };
}
