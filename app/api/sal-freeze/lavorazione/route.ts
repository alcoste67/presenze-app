import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import {
  SAL_FREEZE_ERRORI,
  SalFreezeError,
} from "@/services/salFreeze/createSalFreeze";
import { aggiornaSalFreezeLavorazione } from "@/services/salFreeze/aggiornaSalFreezeLavorazione";
import { isRecord } from "@/lib/typeGuards";

const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  INPUT_NON_VALIDO: "Input non valido",
  FREEZE_NON_TROVATO: "Riga SAL periodo non trovata",
  FREEZE_GIA_ANNULLATO: "SAL periodo annullato",
  FREEZE_GIA_DEFINITIVO: "SAL periodo definitivo: non modificabile",
  ERRORE_GENERICO: "Aggiornamento riga SAL periodo fallito",
} as const;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json(
    { success: false, errore },
    { status, headers: NO_STORE_HEADERS }
  );
}

function jsonOk(payload: unknown) {
  return Response.json(
    { success: true, ...((payload as Record<string, unknown>) || {}) },
    { status: HTTP_STATUS.OK, headers: NO_STORE_HEADERS }
  );
}

function estraiAccessToken(request: Request): string | null {
  const authorization = request.headers.get(API_HEADERS.AUTHORIZATION);

  if (!authorization?.startsWith(API_HEADERS.BEARER_PREFIX)) {
    return null;
  }

  return authorization.slice(API_HEADERS.BEARER_PREFIX.length).trim() || null;
}

function numeroOpzionale(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  const n = typeof value === "number" ? value : Number(value);

  return Number.isFinite(n) ? n : undefined;
}

type PayloadRiga = {
  rigaId: string;
  percentualeAttuale?: number | null;
  importoMaturato?: number | null;
  importoPeriodo?: number | null;
};

async function leggiPayload(request: Request): Promise<PayloadRiga | null> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return null;
  }

  if (!isRecord(payload) || typeof payload.rigaId !== "string") {
    return null;
  }

  const rigaId = payload.rigaId.trim();

  if (!rigaId) {
    return null;
  }

  return {
    rigaId,
    percentualeAttuale: numeroOpzionale(payload.percentualeAttuale),
    importoMaturato: numeroOpzionale(payload.importoMaturato),
    importoPeriodo: numeroOpzionale(payload.importoPeriodo),
  };
}

function getErroreHttp(error: unknown): { status: number; errore: string } {
  if (error instanceof SalFreezeError) {
    switch (error.code) {
      case SAL_FREEZE_ERRORI.INPUT_NON_VALIDO:
        return {
          status: HTTP_STATUS.BAD_REQUEST,
          errore: ERRORI_API.INPUT_NON_VALIDO,
        };
      case SAL_FREEZE_ERRORI.ACCESSO_NEGATO:
        return {
          status: HTTP_STATUS.FORBIDDEN,
          errore: ERRORI_API.ACCESSO_NEGATO,
        };
      case SAL_FREEZE_ERRORI.FREEZE_NON_TROVATO:
        return {
          status: HTTP_STATUS.NOT_FOUND,
          errore: ERRORI_API.FREEZE_NON_TROVATO,
        };
      case SAL_FREEZE_ERRORI.FREEZE_GIA_ANNULLATO:
        return {
          status: HTTP_STATUS.CONFLICT,
          errore: ERRORI_API.FREEZE_GIA_ANNULLATO,
        };
      case SAL_FREEZE_ERRORI.FREEZE_GIA_DEFINITIVO:
        return {
          status: HTTP_STATUS.CONFLICT,
          errore: ERRORI_API.FREEZE_GIA_DEFINITIVO,
        };
      default:
        return {
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          errore: ERRORI_API.ERRORE_GENERICO,
        };
    }
  }

  return {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errore: ERRORI_API.ERRORE_GENERICO,
  };
}

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const accessToken = estraiAccessToken(request);

  if (!accessToken) {
    return jsonErrore(ERRORI_API.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user?.email) {
    return jsonErrore(ERRORI_API.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
  }

  const utenteAdmin = await isAdmin(user.email, supabaseAdmin);

  if (!utenteAdmin) {
    return jsonErrore(ERRORI_API.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
  }

  const payload = await leggiPayload(request);

  if (!payload) {
    return jsonErrore(ERRORI_API.INPUT_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const riga = await aggiornaSalFreezeLavorazione({
      rigaId: payload.rigaId,
      percentualeAttuale: payload.percentualeAttuale,
      importoMaturato: payload.importoMaturato,
      importoPeriodo: payload.importoPeriodo,
      userEmail: user.email,
      supabaseClient: supabaseAdmin,
    });

    return jsonOk({ riga });
  } catch (error: unknown) {
    const httpErrore = getErroreHttp(error);

    return jsonErrore(httpErrore.errore, httpErrore.status);
  }
}
