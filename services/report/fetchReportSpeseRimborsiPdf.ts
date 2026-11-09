import { isRecord } from "@/lib/typeGuards";
import { getMessaggioErroreApi } from "@/lib/errors";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { REPORT_NOTE_SPESE_RIMBORSI_PDF, REPORT_NOTE_SPESE_RIMBORSI_TESTI } from "@/constants/reportNoteSpeseRimborsi";
import { supabase } from "@/lib/supabase";
import type { ReportSpeseRimborsiFiltri } from "@/types/reportNoteSpeseRimborsi";

type ReportSpeseRimborsiPdf = {
  blob: Blob;
  nomeFile: string;
};

async function leggiMessaggioErrorePdf(response: Response) {
  try {
    const payload = await response.json();

    if (isRecord(payload)) {
      return getMessaggioErroreApi(payload, REPORT_NOTE_SPESE_RIMBORSI_PDF.ERRORI.PDF_GENERICO);
    }
  } catch {
    return REPORT_NOTE_SPESE_RIMBORSI_PDF.ERRORI.PDF_GENERICO;
  }

  return REPORT_NOTE_SPESE_RIMBORSI_PDF.ERRORI.PDF_GENERICO;
}

function getNomeFilePdf(response: Response) {
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(contentDisposition);

  return match?.[1] || `${REPORT_NOTE_SPESE_RIMBORSI_PDF.FILE_PREFIX}.pdf`;
}

export async function fetchReportSpeseRimborsiPdf(
  filtri: ReportSpeseRimborsiFiltri
): Promise<ReportSpeseRimborsiPdf> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error(REPORT_NOTE_SPESE_RIMBORSI_TESTI.ERRORI.SESSIONE_MANCANTE);
  }

  const response = await fetch(API_ROUTES.REPORT_SPESE_RIMBORSI_PDF, {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
    },
    body: JSON.stringify(filtri),
  });

  if (!response.ok) {
    throw new Error(await leggiMessaggioErrorePdf(response));
  }

  return {
    blob: await response.blob(),
    nomeFile: getNomeFilePdf(response),
  };
}
