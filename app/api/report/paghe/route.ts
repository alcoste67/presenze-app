import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { REPORT_PAGHE_TESTI } from "@/constants/reportPaghe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { loadReportPaghe } from "@/services/report/loadReportPaghe";
import type { ReportPagheFiltri } from "@/types/reportPaghe";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE_HEADERS });
}

function jsonOk(payload: unknown) {
  return Response.json(payload, { status: HTTP_STATUS.OK, headers: NO_STORE_HEADERS });
}

function estraiAccessToken(request: Request): string | null {
  const authorization = request.headers.get(API_HEADERS.AUTHORIZATION);

  if (!authorization?.startsWith(API_HEADERS.BEARER_PREFIX)) {
    return null;
  }

  const accessToken = authorization.slice(API_HEADERS.BEARER_PREFIX.length).trim();

  return accessToken || null;
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

async function leggiFiltri(request: Request): Promise<ReportPagheFiltri | null> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.anno !== "number" || typeof payload.mese !== "number") {
    return null;
  }

  if (!Number.isInteger(payload.anno) || !Number.isInteger(payload.mese)) {
    return null;
  }

  if (payload.mese < 1 || payload.mese > 12) {
    return null;
  }

  const dipendenteId = normalizzaId(payload.dipendenteId);

  if (typeof dipendenteId === "undefined") {
    return null;
  }

  return {
    anno: payload.anno,
    mese: payload.mese,
    dipendenteId,
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const accessToken = estraiAccessToken(request);

    if (!accessToken) {
      return jsonErrore(REPORT_PAGHE_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(REPORT_PAGHE_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const utenteAdmin = await isAdmin(user.email, supabaseAdmin);

    if (!utenteAdmin) {
      return jsonErrore(REPORT_PAGHE_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
    }

    const filtri = await leggiFiltri(request);

    if (!filtri) {
      return jsonErrore(REPORT_PAGHE_TESTI.ERRORI.FILTRI_NON_VALIDI, HTTP_STATUS.BAD_REQUEST);
    }

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, user.id);

    const report = await loadReportPaghe(filtri, aziendaId);

    return jsonOk(report);
  } catch (error: unknown) {
    console.error("Errore report paghe", error);

    return jsonErrore(REPORT_PAGHE_TESTI.ERRORI.GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
