import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";


const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  PAYLOAD_NON_VALIDO: "Dati cantiere non validi",
  CANTIERE_NON_TROVATO: "Cantiere non trovato",
  CANTIERE_ATTIVO:
    "Disattiva il cantiere prima di eliminarlo",
  CANTIERE_USATO:
    "Cantiere gia utilizzato da timbrature. Eliminazione bloccata.",
  CANTIERE_NON_ELIMINATO:
    "Cantiere non eliminato",
  ERRORE_GENERICO: "Errore eliminazione cantiere",
} as const;

type CantiereEliminabile = {
  id: string;
  attivo: boolean;
};

function jsonErrore(
  errore: string,
  status: number
) {
  return Response.json(
    {
      errore,
    },
    {
      status,
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

async function leggiCantiereId(
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
    typeof payload.cantiereId !== "string"
  ) {
    return null;
  }

  const cantiereId = payload.cantiereId.trim();

  return cantiereId || null;
}

export async function POST(
  request: Request
): Promise<Response> {
  try {
    const accessToken =
      estraiAccessToken(request);

    if (!accessToken) {
      return jsonErrore(
        ERRORI_API.TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

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

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, user.id);

    const cantiereId =
      await leggiCantiereId(request);

    if (!cantiereId) {
      return jsonErrore(
        ERRORI_API.PAYLOAD_NON_VALIDO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const {
      data: cantiere,
      error: cantiereError,
    } = await supabaseAdmin
      .from("cantieri")
      .select("id, attivo")
      .eq("id", cantiereId)
      .eq("azienda_id", aziendaId)
      .maybeSingle();

    if (cantiereError) {
      throw cantiereError;
    }

    if (!cantiere) {
      return jsonErrore(
        ERRORI_API.CANTIERE_NON_TROVATO,
        HTTP_STATUS.NOT_FOUND
      );
    }

    const cantiereEliminabile =
      cantiere as CantiereEliminabile;

    if (cantiereEliminabile.attivo) {
      return jsonErrore(
        ERRORI_API.CANTIERE_ATTIVO,
        HTTP_STATUS.CONFLICT
      );
    }

    const {
      count: numeroTimbrature,
      error: timbratureError,
    } = await supabaseAdmin
      .from("timbrature")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("cantiere_id", cantiereId)
      .eq("azienda_id", aziendaId);

    if (timbratureError) {
      throw timbratureError;
    }

    if ((numeroTimbrature || 0) > 0) {
      return jsonErrore(
        ERRORI_API.CANTIERE_USATO,
        HTTP_STATUS.CONFLICT
      );
    }

    const {
      data: cantiereEliminato,
      error: deleteError,
    } = await supabaseAdmin
      .from("cantieri")
      .delete()
      .eq("id", cantiereId)
      .eq("azienda_id", aziendaId)
      .select("id")
      .single();

    if (deleteError?.code === "23503") {
      return jsonErrore(
        ERRORI_API.CANTIERE_USATO,
        HTTP_STATUS.CONFLICT
      );
    }

    if (!cantiereEliminato) {
      return jsonErrore(
        ERRORI_API.CANTIERE_NON_ELIMINATO,
        HTTP_STATUS.CONFLICT
      );
    }

    if (deleteError) {
      throw deleteError;
    }

    return Response.json(
      {
        id: cantiereId,
      },
      {
        status: HTTP_STATUS.OK,
      }
    );
  } catch (error: unknown) {
    console.error(
      "Errore eliminazione cantiere",
      error
    );

    return jsonErrore(
      ERRORI_API.ERRORE_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
