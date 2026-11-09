import { isRecord } from "@/lib/typeGuards";
import { getMessaggioErroreApi } from "@/lib/errors";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { REPORT_PAGHE_TESTI } from "@/constants/reportPaghe";
import { supabase } from "@/lib/supabase";
import type { ReportPagheFiltri, ReportPagheGiorno, ReportPagheRiga, ReportPagheRisposta } from "@/types/reportPaghe";

function isReportPagheGiorno(value: unknown): value is ReportPagheGiorno {
  return isRecord(value) && typeof value.giorno === "number" && typeof value.valore === "string";
}

function isReportPagheRiga(value: unknown): value is ReportPagheRiga {
  return (
    isRecord(value) &&
    typeof value.dipendenteId === "string" &&
    typeof value.dipendente === "string" &&
    Array.isArray(value.giorni) &&
    value.giorni.every(isReportPagheGiorno) &&
    typeof value.totaleOrePaghe === "string"
  );
}

function isReportPagheRisposta(value: unknown): value is ReportPagheRisposta {
  return (
    isRecord(value) &&
    Array.isArray(value.righe) &&
    value.righe.every(isReportPagheRiga) &&
    typeof value.numeroGiorni === "number" &&
    typeof value.limiteRaggiunto === "boolean"
  );
}

async function leggiJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchReportPaghe(filtri: ReportPagheFiltri): Promise<ReportPagheRisposta> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error(REPORT_PAGHE_TESTI.ERRORI.SESSIONE_MANCANTE);
  }

  const response = await fetch(API_ROUTES.REPORT_PAGHE, {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
    },
    body: JSON.stringify(filtri),
  });

  const payload = await leggiJsonResponse(response);

  if (!response.ok) {
    throw new Error(getMessaggioErroreApi(payload, REPORT_PAGHE_TESTI.ERRORI.GENERICO));
  }

  if (!isReportPagheRisposta(payload)) {
    throw new Error(REPORT_PAGHE_TESTI.ERRORI.RISPOSTA_NON_VALIDA);
  }

  return payload;
}
