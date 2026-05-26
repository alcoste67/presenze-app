import { API_HEADERS } from "@/constants/api";
import { SAL_FREEZE_ERRORI, SalFreezeError } from "@/services/salFreeze/createSalFreeze";
import { createSalFreeze } from "@/services/salFreeze/createSalFreeze";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";

const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  INPUT_NON_VALIDO: "Input non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  FREEZE_ESISTENTE: "Freeze SAL gia esistente per il periodo selezionato",
  NESSUNA_LAVORAZIONE: "Nessuna lavorazione SAL trovata per il cantiere selezionato",
  FOTO_NON_TROVATA: "Una o piu foto selezionate non sono valide",
  COPIA_FOTO_FALLITA: "Copia foto fallita",
  ERRORE_GENERICO: "Creazione SAL periodo fallita",
  ERRORE_IMPREVISTO:
    "Errore imprevisto durante la creazione SAL periodo",
} as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonErrore(
  errore: string,
  status: number,
  details?: {
    errorCode?: string;
    errorMessage?: string;
    step?: string;
  }
) {
  return Response.json(
    {
      success: false,
      errorCode: details?.errorCode || errore,
      errorMessage: details?.errorMessage || errore,
      step: details?.step || "unexpected",
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  );
}

function getErroreImprevisto(errorMessage?: string) {
  return {
    status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
    errorCode: "UNEXPECTED_ERROR",
    errorMessage:
      errorMessage?.trim() ||
      ERRORI_API.ERRORE_IMPREVISTO,
    step: "unexpected",
  };
}

function logSalFreezeCreateError(details: {
  step: string;
  errorCode: string;
  errorMessage: string;
}) {
  console.error("[sal-freeze-create-error]", details);
}

function jsonOk(payload: unknown) {
  return Response.json(
    {
      success: true,
      ...((payload as Record<string, unknown>) || {}),
    },
    {
      status: HTTP_STATUS.OK,
      headers: NO_STORE_HEADERS,
    }
  );
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
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

function leggiStringa(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

async function leggiPayload(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const cantiereId = leggiStringa(payload.cantiereId);
  const periodStart = leggiStringa(payload.periodStart);
  const periodEnd = leggiStringa(payload.periodEnd);

  if (!cantiereId || !periodStart || !periodEnd) {
    return null;
  }

  let selectedPhotoIds: string[] = [];

  if (typeof payload.selectedPhotoIds !== "undefined") {
    if (!Array.isArray(payload.selectedPhotoIds)) {
      return null;
    }

    const ids: string[] = [];

    for (const value of payload.selectedPhotoIds) {
      if (typeof value !== "string") {
        return null;
      }

      const trimmed = value.trim();

      if (!trimmed) {
        return null;
      }

      ids.push(trimmed);
    }

    selectedPhotoIds = Array.from(new Set(ids));
  }

  const note =
    typeof payload.note === "string"
      ? payload.note.trim()
      : undefined;

  if (
    typeof payload.note !== "undefined" &&
    typeof payload.note !== "string"
  ) {
    return null;
  }

  return {
    cantiereId,
    periodStart,
    periodEnd,
    selectedPhotoIds,
    note,
  };
}

function getErroreHttp(
  error: unknown
): {
  status: number;
  errorCode: string;
  errorMessage: string;
  step: string;
} {
  if (error instanceof SalFreezeError) {
    switch (error.code) {
      case SAL_FREEZE_ERRORI.INPUT_NON_VALIDO:
        return {
          status: HTTP_STATUS.BAD_REQUEST,
          errorCode: error.code,
          errorMessage: ERRORI_API.INPUT_NON_VALIDO,
          step: error.step || "auth",
        };
      case SAL_FREEZE_ERRORI.ACCESSO_NEGATO:
        return {
          status: HTTP_STATUS.FORBIDDEN,
          errorCode: error.code,
          errorMessage: ERRORI_API.ACCESSO_NEGATO,
          step: error.step || "admin_check",
        };
      case SAL_FREEZE_ERRORI.FREEZE_ESISTENTE:
        return {
          status: HTTP_STATUS.CONFLICT,
          errorCode: error.code,
          errorMessage: ERRORI_API.FREEZE_ESISTENTE,
          step: error.step || "existing_freeze_check",
        };
      case SAL_FREEZE_ERRORI.NESSUNA_LAVORAZIONE:
        return {
          status: HTTP_STATUS.NOT_FOUND,
          errorCode: error.code,
          errorMessage: ERRORI_API.NESSUNA_LAVORAZIONE,
          step: error.step || "load_sal_live",
        };
      case SAL_FREEZE_ERRORI.FOTO_NON_TROVATA:
        return {
          status: HTTP_STATUS.NOT_FOUND,
          errorCode: error.code,
          errorMessage: ERRORI_API.FOTO_NON_TROVATA,
          step: error.step || "copy_photos",
        };
      case SAL_FREEZE_ERRORI.COPIA_FOTO_FALLITA:
        return {
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          errorCode: error.code,
          errorMessage: ERRORI_API.COPIA_FOTO_FALLITA,
          step: error.step || "copy_photos",
        };
      case SAL_FREEZE_ERRORI.ERRORE_GENERICO:
        if (
          error.step === "unexpected" ||
          !error.step
        ) {
          return getErroreImprevisto(error.message);
        }

        return {
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          errorCode: error.code,
          errorMessage: ERRORI_API.ERRORE_GENERICO,
          step: error.step,
        };
      default:
        if (
          error.step === "unexpected" ||
          !error.step
        ) {
          return getErroreImprevisto(error.message);
        }

        return {
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          errorCode: error.code,
          errorMessage: ERRORI_API.ERRORE_GENERICO,
          step: error.step,
        };
    }
  }

  return getErroreImprevisto(
    error instanceof Error ? error.message : undefined
  );
}

export const dynamic = "force-dynamic";

export async function POST(
  request: Request
): Promise<Response> {
  const accessToken = estraiAccessToken(request);

  if (!accessToken) {
    logSalFreezeCreateError({
      step: "auth",
      errorCode: "TOKEN_MANCANTE",
      errorMessage: ERRORI_API.TOKEN_MANCANTE,
    });

    return jsonErrore(
      ERRORI_API.TOKEN_MANCANTE,
      HTTP_STATUS.UNAUTHORIZED,
      {
        errorCode: "TOKEN_MANCANTE",
        errorMessage: ERRORI_API.TOKEN_MANCANTE,
        step: "auth",
      }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user?.email) {
    logSalFreezeCreateError({
      step: "auth",
      errorCode: "TOKEN_NON_VALIDO",
      errorMessage: ERRORI_API.TOKEN_NON_VALIDO,
    });

    return jsonErrore(
      ERRORI_API.TOKEN_NON_VALIDO,
      HTTP_STATUS.UNAUTHORIZED,
      {
        errorCode: "TOKEN_NON_VALIDO",
        errorMessage: ERRORI_API.TOKEN_NON_VALIDO,
        step: "auth",
      }
    );
  }

  console.error("[SAL_FREEZE] email utente rilevata", {
    step: "auth",
    email: user.email,
  });

  const utenteAdmin = await isAdmin(
    user.email,
    supabaseAdmin
  );

  console.error("[SAL_FREEZE] esito check isAdmin", {
    step: "admin_check",
    email: user.email,
    isAdmin: utenteAdmin,
  });

  if (!utenteAdmin) {
    logSalFreezeCreateError({
      step: "admin_check",
      errorCode: SAL_FREEZE_ERRORI.ACCESSO_NEGATO,
      errorMessage: ERRORI_API.ACCESSO_NEGATO,
    });

    return jsonErrore(
      ERRORI_API.ACCESSO_NEGATO,
      HTTP_STATUS.FORBIDDEN,
      {
        errorCode: SAL_FREEZE_ERRORI.ACCESSO_NEGATO,
        errorMessage: ERRORI_API.ACCESSO_NEGATO,
        step: "admin_check",
      }
    );
  }

  const payload = await leggiPayload(request);

  if (!payload) {
    logSalFreezeCreateError({
      step: "input_validation",
      errorCode: SAL_FREEZE_ERRORI.INPUT_NON_VALIDO,
      errorMessage: ERRORI_API.INPUT_NON_VALIDO,
    });

    return jsonErrore(
      ERRORI_API.INPUT_NON_VALIDO,
      HTTP_STATUS.BAD_REQUEST,
      {
        errorCode: SAL_FREEZE_ERRORI.INPUT_NON_VALIDO,
        errorMessage: ERRORI_API.INPUT_NON_VALIDO,
        step: "input_validation",
      }
    );
  }

  console.error("[SAL_FREEZE] inizio createSalFreeze", {
    step: "create",
    cantiereId: payload.cantiereId,
    periodStart: payload.periodStart,
    periodEnd: payload.periodEnd,
    selectedPhotoIdsCount: payload.selectedPhotoIds.length,
    hasNote: Boolean(payload.note),
  });

  try {
    const freeze = await createSalFreeze({
      ...payload,
      userEmail: user.email,
      userId: user.id,
      supabaseClient: supabaseAdmin,
    });

    return jsonOk({
      freeze,
      freezeId: freeze.freezeId,
    });
  } catch (error: unknown) {
    const httpErrore = getErroreHttp(error);

    logSalFreezeCreateError(httpErrore);

    return jsonErrore(
      httpErrore.errorMessage,
      httpErrore.status,
      {
        errorCode: httpErrore.errorCode,
        errorMessage: httpErrore.errorMessage,
        step: httpErrore.step,
      }
    );
  }
}
