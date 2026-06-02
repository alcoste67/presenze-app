import { isRecord } from "@/lib/typeGuards";
import { getMessaggioErroreApi } from "@/lib/errors";
import { ATTIVITA } from "@/constants/attivita";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import {
  REPORT_PRESENZE_TESTI,
} from "@/constants/reportPresenze";
import { TIMBRATURE } from "@/constants/stati";
import { supabase } from "@/lib/supabase";
import type { TipoAttivita } from "@/types/attivita";
import type {
  PresenzeReportFiltri,
  PresenzeReportRiga,
  PresenzeReportRisposta,
} from "@/types/reportPresenze";
import type { TipoTimbratura } from "@/types/timbrature";

const TIPI_TIMBRATURA = Object.values(
  TIMBRATURE
) as readonly TipoTimbratura[];

const TIPI_ATTIVITA = Object.values(
  ATTIVITA
) as readonly TipoAttivita[];

function isTipoTimbratura(
  value: unknown
): value is TipoTimbratura {
  return (
    typeof value === "string" &&
    TIPI_TIMBRATURA.includes(
      value as TipoTimbratura
    )
  );
}

function isAttivitaTipo(
  value: unknown
): value is TipoAttivita | null {
  return (
    value === null ||
    (typeof value === "string" &&
      TIPI_ATTIVITA.includes(
        value as TipoAttivita
      ))
  );
}

function isPresenzeReportRiga(
  value: unknown
): value is PresenzeReportRiga {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.created_at === "string" &&
    typeof value.data === "string" &&
    typeof value.ora === "string" &&
    typeof value.dipendente === "string" &&
    typeof value.email === "string" &&
    isTipoTimbratura(value.tipo) &&
    typeof value.tipoLabel === "string" &&
    typeof value.destinazione === "string" &&
    typeof value.cantiere === "string" &&
    typeof value.attivita === "string" &&
    isAttivitaTipo(value.attivitaTipo)
  );
}

function isPresenzeReportRisposta(
  value: unknown
): value is PresenzeReportRisposta {
  return (
    isRecord(value) &&
    Array.isArray(value.righe) &&
    value.righe.every(isPresenzeReportRiga) &&
    typeof value.limiteRighe === "number" &&
    typeof value.limiteRaggiunto ===
      "boolean"
  );
}


async function leggiJsonResponse(
  response: Response
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchPresenzeReport(
  filtri: PresenzeReportFiltri
): Promise<PresenzeReportRisposta> {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken =
    data.session?.access_token;

  if (!accessToken) {
    throw new Error(
      REPORT_PRESENZE_TESTI.ERRORI
        .SESSIONE_MANCANTE
    );
  }

  const response = await fetch(
    API_ROUTES.REPORT_PRESENZE,
    {
      method: "POST",
      headers: {
        [API_HEADERS.CONTENT_TYPE]:
          API_HEADERS.APPLICATION_JSON,
        [API_HEADERS.AUTHORIZATION]:
          `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
      body: JSON.stringify(filtri),
    }
  );

  const payload =
    await leggiJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      getMessaggioErroreApi(payload, REPORT_PRESENZE_TESTI.ERRORI.GENERICO)
    );
  }

  if (!isPresenzeReportRisposta(payload)) {
    throw new Error(
      REPORT_PRESENZE_TESTI.ERRORI
        .RISPOSTA_NON_VALIDA
    );
  }

  return payload;
}
