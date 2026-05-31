import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import {
  REPORT_LIBRO_PRESENZE_LIMITI,
  REPORT_LIBRO_PRESENZE_TESTI,
} from "@/constants/reportLibroPresenze";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { loadLibroPresenzeReport } from "@/services/report/loadLibroPresenzeReport";
import type { LibroPresenzeReportFiltri } from "@/types/reportLibroPresenze";


const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const DATA_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})$/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function jsonErrore(
  errore: string,
  status: number
) {
  return Response.json(
    {
      errore,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  );
}

function jsonOk(payload: unknown) {
  return Response.json(payload, {
    status: HTTP_STATUS.OK,
    headers: NO_STORE_HEADERS,
  });
}

function estraiAccessToken(
  request: Request
): string | null {
  const authorization = request.headers.get(
    API_HEADERS.AUTHORIZATION
  );

  if (
    !authorization?.startsWith(
      API_HEADERS.BEARER_PREFIX
    )
  ) {
    return null;
  }

  const accessToken = authorization
    .slice(API_HEADERS.BEARER_PREFIX.length)
    .trim();

  return accessToken || null;
}

function parseDataInput(
  value: string
): Date | null {
  const match = DATA_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const data = new Date(
    Date.UTC(year, month - 1, day)
  );

  if (
    data.getUTCFullYear() !== year ||
    data.getUTCMonth() !== month - 1 ||
    data.getUTCDate() !== day
  ) {
    return null;
  }

  return data;
}

function getGiorniIntervallo(
  dataInizio: string,
  dataFine: string
): number | null {
  const inizio = parseDataInput(dataInizio);
  const fine = parseDataInput(dataFine);

  if (!inizio || !fine) {
    return null;
  }

  return (
    Math.floor(
      (fine.getTime() - inizio.getTime()) /
        MS_PER_DAY
    ) + 1
  );
}

function normalizzaId(
  value: unknown
): string | null | undefined {
  if (
    value === null ||
    typeof value === "undefined"
  ) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

async function leggiFiltri(
  request: Request
): Promise<LibroPresenzeReportFiltri | null> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  if (
    typeof payload.dataInizio !==
      "string" ||
    typeof payload.dataFine !== "string"
  ) {
    return null;
  }

  const dipendenteId = normalizzaId(
    payload.dipendenteId
  );
  const cantiereId = normalizzaId(
    payload.cantiereId
  );

  if (
    typeof dipendenteId === "undefined" ||
    typeof cantiereId === "undefined"
  ) {
    return null;
  }

  return {
    dipendenteId,
    cantiereId,
    dataInizio:
      payload.dataInizio.trim(),
    dataFine: payload.dataFine.trim(),
  };
}

function getErroreFiltri(
  filtri: LibroPresenzeReportFiltri
): string | null {
  if (!filtri.dataInizio || !filtri.dataFine) {
    return REPORT_LIBRO_PRESENZE_TESTI
      .ERRORI.DATE_OBBLIGATORIE;
  }

  const giorni = getGiorniIntervallo(
    filtri.dataInizio,
    filtri.dataFine
  );

  if (!giorni || giorni <= 0) {
    return REPORT_LIBRO_PRESENZE_TESTI
      .ERRORI.INTERVALLO_NON_VALIDO;
  }

  if (
    giorni >
    REPORT_LIBRO_PRESENZE_LIMITI.MAX_GIORNI
  ) {
    return `${REPORT_LIBRO_PRESENZE_TESTI.ERRORI.INTERVALLO_MASSIMO_PREFIX} ${REPORT_LIBRO_PRESENZE_LIMITI.MAX_GIORNI} ${REPORT_LIBRO_PRESENZE_TESTI.ERRORI.INTERVALLO_MASSIMO_SUFFIX}`;
  }

  return null;
}

export async function POST(
  request: Request
): Promise<Response> {
  try {
    const accessToken =
      estraiAccessToken(request);

    if (!accessToken) {
      return jsonErrore(
        REPORT_LIBRO_PRESENZE_TESTI
          .ERRORI.TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (authError || !user?.email) {
      return jsonErrore(
        REPORT_LIBRO_PRESENZE_TESTI
          .ERRORI.TOKEN_NON_VALIDO,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const utenteAdmin = await isAdmin(
      user.email,
      supabaseAdmin
    );

    if (!utenteAdmin) {
      return jsonErrore(
        REPORT_LIBRO_PRESENZE_TESTI
          .ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const filtri =
      await leggiFiltri(request);

    if (!filtri) {
      return jsonErrore(
        REPORT_LIBRO_PRESENZE_TESTI
          .ERRORI.FILTRI_NON_VALIDI,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const erroreFiltri =
      getErroreFiltri(filtri);

    if (erroreFiltri) {
      return jsonErrore(
        erroreFiltri,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const report =
      await loadLibroPresenzeReport(filtri);

    return jsonOk(report);
  } catch (error: unknown) {
    console.error(
      "Errore libro presenze",
      error
    );

    return jsonErrore(
      REPORT_LIBRO_PRESENZE_TESTI.ERRORI
        .GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
