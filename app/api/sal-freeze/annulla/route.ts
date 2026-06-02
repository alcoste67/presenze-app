import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import {
  SAL_FREEZE_ERRORI,
  SalFreezeError,
} from "@/services/salFreeze/createSalFreeze";
import { annullaSalFreeze } from "@/services/salFreeze/annullaSalFreeze";
import { isRecord } from "@/lib/typeGuards";


const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  INPUT_NON_VALIDO: "Input non valido",
  FREEZE_NON_TROVATO: "Freeze SAL non trovato",
  FREEZE_GIA_ANNULLATO: "Freeze SAL gia annullato",
  ERRORE_GENERICO: "Annullamento freeze SAL fallito",
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

async function leggiFreezeId(
  request: Request
): Promise<string | null> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return null;
  }

  if (
    !isRecord(payload) ||
    typeof payload.freezeId !== "string"
  ) {
    return null;
  }

  const freezeId = payload.freezeId.trim();

  return freezeId || null;
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

  const utenteAdmin = await isAdmin(
    user.email,
    supabaseAdmin
  );

  if (!utenteAdmin) {
    return jsonErrore(
      ERRORI_API.ACCESSO_NEGATO,
      HTTP_STATUS.FORBIDDEN
    );
  }

  const freezeId = await leggiFreezeId(request);

  if (!freezeId) {
    return jsonErrore(
      ERRORI_API.INPUT_NON_VALIDO,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  try {
    const freezeAnnullato = await annullaSalFreeze({
      freezeId,
      userEmail: user.email,
      userId: user.id,
      supabaseClient: supabaseAdmin,
    });

    return jsonOk({
      freeze: freezeAnnullato,
    });
  } catch (error: unknown) {
    const httpErrore = getErroreHttp(error);

    return jsonErrore(
      httpErrore.errore,
      httpErrore.status
    );
  }
}
