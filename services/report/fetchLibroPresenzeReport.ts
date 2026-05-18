import {
  API_HEADERS,
  API_ROUTES,
} from "@/constants/api";
import { REPORT_LIBRO_PRESENZE_TESTI } from "@/constants/reportLibroPresenze";
import { supabase } from "@/lib/supabase";
import type {
  LibroPresenzeReportFiltri,
  LibroPresenzeReportRiga,
  LibroPresenzeReportRisposta,
} from "@/types/reportLibroPresenze";

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isLibroPresenzeReportRiga(
  value: unknown
): value is LibroPresenzeReportRiga {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.giorno === "string" &&
    typeof value.giornoIso === "string" &&
    typeof value.dipendente === "string" &&
    typeof value.email === "string" &&
    typeof value.entrata === "string" &&
    typeof value.uscita === "string" &&
    typeof value.totaleMinutiReali ===
      "number" &&
    typeof value.totaleOreReali ===
      "string" &&
    typeof value.minutiPaghe === "number" &&
    typeof value.orePaghe === "string" &&
    typeof value.cantiereAttivita ===
      "string" &&
    typeof value.note === "string"
  );
}

function isLibroPresenzeReportRisposta(
  value: unknown
): value is LibroPresenzeReportRisposta {
  return (
    isRecord(value) &&
    Array.isArray(value.righe) &&
    value.righe.every(
      isLibroPresenzeReportRiga
    ) &&
    typeof value.limiteRighe === "number" &&
    typeof value.limiteRaggiunto ===
      "boolean"
  );
}

function getMessaggioErroreApi(
  payload: unknown
): string {
  if (
    isRecord(payload) &&
    typeof payload.errore === "string"
  ) {
    return payload.errore;
  }

  return REPORT_LIBRO_PRESENZE_TESTI.ERRORI
    .GENERICO;
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

export async function fetchLibroPresenzeReport(
  filtri: LibroPresenzeReportFiltri
): Promise<LibroPresenzeReportRisposta> {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken =
    data.session?.access_token;

  if (!accessToken) {
    throw new Error(
      REPORT_LIBRO_PRESENZE_TESTI.ERRORI
        .SESSIONE_MANCANTE
    );
  }

  const response = await fetch(
    API_ROUTES.REPORT_LIBRO_PRESENZE,
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
      getMessaggioErroreApi(payload)
    );
  }

  if (
    !isLibroPresenzeReportRisposta(payload)
  ) {
    throw new Error(
      REPORT_LIBRO_PRESENZE_TESTI.ERRORI
        .RISPOSTA_NON_VALIDA
    );
  }

  return payload;
}
