import { isRecord } from "@/lib/typeGuards";
import { getMessaggioErroreApi } from "@/lib/errors";
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

function isLibroPresenzeReportRiga(
  value: unknown
): value is LibroPresenzeReportRiga {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.data === "string" &&
    typeof value.dipendente === "string" &&
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
      getMessaggioErroreApi(payload, REPORT_LIBRO_PRESENZE_TESTI.ERRORI.GENERICO)
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
