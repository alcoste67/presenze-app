import { createClient } from "@supabase/supabase-js";

import { API_HEADERS } from "@/constants/api";
import { SAL_FREEZE_ERRORI, SalFreezeError } from "@/services/salFreeze/createSalFreeze";
import { createSalFreeze } from "@/services/salFreeze/createSalFreeze";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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
  ERRORE_GENERICO: "Creazione freeze SAL fallita",
} as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonErrore(
  errore: string,
  status: number
) {
  return Response.json(
    {
      success: false,
      errore,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  );
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
  errore: string;
} {
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
      case SAL_FREEZE_ERRORI.FREEZE_ESISTENTE:
        return {
          status: HTTP_STATUS.CONFLICT,
          errore: ERRORI_API.FREEZE_ESISTENTE,
        };
      case SAL_FREEZE_ERRORI.NESSUNA_LAVORAZIONE:
        return {
          status: HTTP_STATUS.NOT_FOUND,
          errore: ERRORI_API.NESSUNA_LAVORAZIONE,
        };
      case SAL_FREEZE_ERRORI.FOTO_NON_TROVATA:
        return {
          status: HTTP_STATUS.NOT_FOUND,
          errore: ERRORI_API.FOTO_NON_TROVATA,
        };
      case SAL_FREEZE_ERRORI.COPIA_FOTO_FALLITA:
        return {
          status: HTTP_STATUS.INTERNAL_SERVER_ERROR,
          errore: ERRORI_API.COPIA_FOTO_FALLITA,
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

export async function POST(
  request: Request
): Promise<Response> {
  const accessToken = estraiAccessToken(request);

  if (!accessToken) {
    return jsonErrore(
      ERRORI_API.TOKEN_MANCANTE,
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user?.email) {
    return jsonErrore(
      ERRORI_API.TOKEN_NON_VALIDO,
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const payload = await leggiPayload(request);

  if (!payload) {
    return jsonErrore(
      ERRORI_API.INPUT_NON_VALIDO,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonErrore(
      ERRORI_API.ERRORE_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  const supabaseUser = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
        },
      },
    }
  );

  try {
    const freeze = await createSalFreeze({
      ...payload,
      accessToken,
      supabaseClient: supabaseUser,
    });

    return jsonOk({
      freeze,
    });
  } catch (error: unknown) {
    const httpErrore = getErroreHttp(error);

    return jsonErrore(
      httpErrore.errore,
      httpErrore.status
    );
  }
}
