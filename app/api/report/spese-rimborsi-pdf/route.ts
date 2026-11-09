import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { REPORT_NOTE_SPESE_RIMBORSI_PDF, REPORT_NOTE_SPESE_RIMBORSI_TESTI } from "@/constants/reportNoteSpeseRimborsi";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { caricaAziendaBranding } from "@/services/aziende/caricaAziendaBranding";
import { loadReportSpeseRimborsi } from "@/services/report/loadReportSpeseRimborsi";
import {
  generaPdfReportSpeseRimborsi,
  getNomeFileReportSpeseRimborsi,
} from "@/services/report/pdf/generaPdfReportSpeseRimborsi";
import type { ReportSpeseRimborsiFiltri } from "@/types/reportNoteSpeseRimborsi";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

function estraiAccessToken(request: Request): string | null {
  const authorization = request.headers.get(API_HEADERS.AUTHORIZATION);

  if (!authorization?.startsWith(API_HEADERS.BEARER_PREFIX)) {
    return null;
  }

  const accessToken = authorization.slice(API_HEADERS.BEARER_PREFIX.length).trim();

  return accessToken || null;
}

function leggiFiltri(body: unknown): ReportSpeseRimborsiFiltri | null {
  if (!isRecord(body)) return null;
  if (typeof body.anno !== "number" || typeof body.mese !== "number") return null;
  if (!Number.isInteger(body.anno) || !Number.isInteger(body.mese)) return null;
  if (body.mese < 1 || body.mese > 12) return null;

  return { anno: body.anno, mese: body.mese };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const accessToken = estraiAccessToken(request);

    if (!accessToken) {
      return jsonErrore(REPORT_NOTE_SPESE_RIMBORSI_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(REPORT_NOTE_SPESE_RIMBORSI_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const utenteAdmin = await isAdmin(user.email, supabaseAdmin);

    if (!utenteAdmin) {
      return jsonErrore(REPORT_NOTE_SPESE_RIMBORSI_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
    }

    const body = await request.json().catch(() => null);
    const filtri = leggiFiltri(body);

    if (!filtri) {
      return jsonErrore(REPORT_NOTE_SPESE_RIMBORSI_TESTI.ERRORI.MESE_OBBLIGATORIO, HTTP_STATUS.BAD_REQUEST);
    }

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, user.id);

    const [righe, azienda] = await Promise.all([
      loadReportSpeseRimborsi(filtri, aziendaId, supabaseAdmin),
      caricaAziendaBranding(aziendaId, supabaseAdmin),
    ]);

    const pdfBytes = await generaPdfReportSpeseRimborsi({ righe, anno: filtri.anno, mese: filtri.mese, azienda });
    const fileName = getNomeFileReportSpeseRimborsi(filtri.anno, filtri.mese);
    const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(pdfBuffer).set(pdfBytes);

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": REPORT_NOTE_SPESE_RIMBORSI_PDF.CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("Errore generazione PDF note spese e rimborsi", error);

    return jsonErrore(REPORT_NOTE_SPESE_RIMBORSI_PDF.ERRORI.PDF_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
