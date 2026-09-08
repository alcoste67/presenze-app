import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import {
  REPORT_PRESENZE_LIMITI,
  REPORT_PRESENZE_PDF,
  REPORT_PRESENZE_TESTI,
} from "@/constants/reportPresenze";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { loadPresenzeReport } from "@/services/report/loadPresenzeReport";
import {
  generaPresenzeReportPdf,
  getNomeFilePresenzePdf,
} from "@/services/report/pdf/generaPresenzeReportPdf";
import type { PresenzeReportFiltri } from "@/types/reportPresenze";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const DATA_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function jsonErrore(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: NO_STORE_HEADERS }
  );
}

function estraiAccessToken(request: Request): string | null {
  const authorization = request.headers.get(API_HEADERS.AUTHORIZATION);

  if (!authorization?.startsWith(API_HEADERS.BEARER_PREFIX)) {
    return null;
  }

  const accessToken = authorization
    .slice(API_HEADERS.BEARER_PREFIX.length)
    .trim();

  return accessToken || null;
}

function parseDataInput(value: string): Date | null {
  const match = DATA_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const data = new Date(Date.UTC(year, month - 1, day));

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

  return Math.floor((fine.getTime() - inizio.getTime()) / MS_PER_DAY) + 1;
}

function normalizzaId(value: unknown): string | null | undefined {
  if (value === null || typeof value === "undefined") {
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
): Promise<PresenzeReportFiltri | null> {
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
    typeof payload.dataInizio !== "string" ||
    typeof payload.dataFine !== "string"
  ) {
    return null;
  }

  const dipendenteId = normalizzaId(payload.dipendenteId);
  const cantiereId = normalizzaId(payload.cantiereId);

  if (
    typeof dipendenteId === "undefined" ||
    typeof cantiereId === "undefined"
  ) {
    return null;
  }

  return {
    dipendenteId,
    cantiereId,
    dataInizio: payload.dataInizio.trim(),
    dataFine: payload.dataFine.trim(),
  };
}

function getErroreFiltri(filtri: PresenzeReportFiltri): string | null {
  if (!filtri.dataInizio || !filtri.dataFine) {
    return REPORT_PRESENZE_TESTI.ERRORI.DATE_OBBLIGATORIE;
  }

  const giorni = getGiorniIntervallo(filtri.dataInizio, filtri.dataFine);

  if (!giorni || giorni <= 0) {
    return REPORT_PRESENZE_TESTI.ERRORI.INTERVALLO_NON_VALIDO;
  }

  if (giorni > REPORT_PRESENZE_LIMITI.MAX_GIORNI) {
    return `${REPORT_PRESENZE_TESTI.ERRORI.INTERVALLO_MASSIMO_PREFIX} ${REPORT_PRESENZE_LIMITI.MAX_GIORNI} ${REPORT_PRESENZE_TESTI.ERRORI.INTERVALLO_MASSIMO_SUFFIX}`;
  }

  return null;
}

async function getEtichettaDipendente(
  dipendenteId: string | null,
  aziendaId: string
): Promise<string> {
  if (!dipendenteId) {
    return REPORT_PRESENZE_PDF.TESTI.TUTTI_DIPENDENTI;
  }

  const { data } = await supabaseAdmin
    .from("dipendenti")
    .select("nome, cognome")
    .eq("id", dipendenteId)
    .eq("azienda_id", aziendaId)
    .maybeSingle();

  if (!data) {
    return REPORT_PRESENZE_TESTI.DIPENDENTE_NON_DISPONIBILE;
  }

  return `${data.cognome} ${data.nome}`.trim();
}

async function getEtichettaCantiere(
  cantiereId: string | null,
  aziendaId: string
): Promise<string> {
  if (!cantiereId) {
    return REPORT_PRESENZE_PDF.TESTI.TUTTI_CANTIERI;
  }

  const { data } = await supabaseAdmin
    .from("cantieri")
    .select("nome")
    .eq("id", cantiereId)
    .eq("azienda_id", aziendaId)
    .maybeSingle();

  return data?.nome || REPORT_PRESENZE_TESTI.CANTIERE_NON_DISPONIBILE;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const accessToken = estraiAccessToken(request);

    if (!accessToken) {
      return jsonErrore(
        REPORT_PRESENZE_TESTI.ERRORI.TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(
        REPORT_PRESENZE_TESTI.ERRORI.TOKEN_NON_VALIDO,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const utenteAdmin = await isAdmin(user.email, supabaseAdmin);

    if (!utenteAdmin) {
      return jsonErrore(
        REPORT_PRESENZE_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const filtri = await leggiFiltri(request);

    if (!filtri) {
      return jsonErrore(
        REPORT_PRESENZE_TESTI.ERRORI.FILTRI_NON_VALIDI,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const erroreFiltri = getErroreFiltri(filtri);

    if (erroreFiltri) {
      return jsonErrore(erroreFiltri, HTTP_STATUS.BAD_REQUEST);
    }

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, user.id);

    const [report, dipendenteLabel, cantiereLabel] = await Promise.all([
      loadPresenzeReport(filtri, aziendaId),
      getEtichettaDipendente(filtri.dipendenteId, aziendaId),
      getEtichettaCantiere(filtri.cantiereId, aziendaId),
    ]);

    const dataGenerazione = new Date();
    const pdfBytes = await generaPresenzeReportPdf({
      righe: report.righe,
      limiteRaggiunto: report.limiteRaggiunto,
      filtri: {
        dataInizio: filtri.dataInizio,
        dataFine: filtri.dataFine,
        dipendenteLabel,
        cantiereLabel,
      },
      dataGenerazione,
    });
    const fileName = getNomeFilePresenzePdf(dataGenerazione);
    const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
    const pdfView = new Uint8Array(pdfBuffer);

    pdfView.set(pdfBytes);

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": REPORT_PRESENZE_PDF.CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("Errore generazione PDF presenze", error);

    return jsonErrore(
      REPORT_PRESENZE_PDF.ERRORI.PDF_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
