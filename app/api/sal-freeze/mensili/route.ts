import type { NextRequest } from "next/server";

import { API_HEADERS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import type { SalFreezeMensile } from "@/types/salFreeze";

export const runtime = "nodejs";

const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const SELECT_SAL_FREEZE_MENSILI =
  "id, cantiere_id, period_start, period_end, freeze_at, created_by, note, metadata, annullato_at, annullato_by";

function jsonErrore(errorMessage: string, status: number) {
  return Response.json(
    { success: false, errorMessage },
    { status, headers: NO_STORE_HEADERS }
  );
}

function estraiBearerToken(request: NextRequest) {
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

  const token = authorization
    .slice(API_HEADERS.BEARER_PREFIX.length)
    .trim();

  return token || null;
}

function leggiCantiereId(request: NextRequest) {
  const cantiereId = request.nextUrl.searchParams.get(
    "cantiereId"
  );

  if (!cantiereId?.trim()) {
    return null;
  }

  return cantiereId.trim();
}

export async function GET(request: NextRequest) {
  const accessToken = estraiBearerToken(request);

  if (!accessToken) {
    return jsonErrore(
      "Token autenticazione mancante",
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user?.email) {
    return jsonErrore(
      "Token autenticazione non valido",
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const utenteAdmin = await isAdmin(
    user.email,
    supabaseAdmin
  );
  const utenteResponsabile = utenteAdmin
    ? true
    : await isResponsabile(user.email, supabaseAdmin);

  if (!utenteAdmin && !utenteResponsabile) {
    return jsonErrore(
      "Accesso non autorizzato",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const cantiereId = leggiCantiereId(request);

  if (!cantiereId) {
    return jsonErrore(
      "Cantiere obbligatorio",
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const { data, error } = await supabaseAdmin
    .from("sal_freeze_mensili")
    .select(SELECT_SAL_FREEZE_MENSILI)
    .eq("cantiere_id", cantiereId)
    .order("freeze_at", { ascending: false })
    .order("period_start", { ascending: false });

  if (error) {
    console.error("[sal-freeze-list-error]", {
      cantiereId,
      errorMessage: error.message,
    });

    return jsonErrore(
      "Errore lettura SAL periodo",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  const freezeList =
    (data || []) as SalFreezeMensile[];

  return Response.json(
    {
      success: true,
      freeze: freezeList,
    },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    }
  );
}
