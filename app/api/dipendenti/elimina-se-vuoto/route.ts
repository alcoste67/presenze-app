import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import type { RuoloDipendente } from "@/types/dipendenti";


const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  PAYLOAD_NON_VALIDO: "Dati dipendente non validi",
  DIPENDENTE_NON_TROVATO: "Dipendente non trovato",
  DIPENDENTE_ATTIVO:
    "Disattiva il dipendente prima di eliminarlo",
  ADMIN_CORRENTE:
    "Non puoi eliminare l'admin con cui hai effettuato l'accesso",
  ULTIMO_ADMIN:
    "Impossibile eliminare l'ultimo admin attivo",
  DIPENDENTE_USATO:
    "Dipendente gia utilizzato da timbrature. Eliminazione bloccata.",
  AUTH_DELETE_FALLITO:
    "Eliminazione utente Auth non riuscita",
  ERRORE_GENERICO:
    "Errore eliminazione dipendente",
} as const;

type DipendenteEliminabile = {
  id: string;
  email: string;
  ruolo: RuoloDipendente;
  attivo: boolean;
  auth_user_id: string | null;
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

async function leggiDipendenteId(
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
    typeof payload.dipendenteId !== "string"
  ) {
    return null;
  }

  const dipendenteId =
    payload.dipendenteId.trim();

  return dipendenteId || null;
}

function emailNormalizzata(email: string) {
  return email.trim().toLowerCase();
}

function isAdminCorrente(
  dipendente: DipendenteEliminabile,
  userId: string,
  email: string
) {
  return (
    dipendente.auth_user_id === userId ||
    emailNormalizzata(dipendente.email) ===
      emailNormalizzata(email)
  );
}

async function verificaAdminResidui(
  dipendente: DipendenteEliminabile,
  aziendaId: string
): Promise<boolean> {
  if (
    dipendente.ruolo !== RUOLI_DIPENDENTE.ADMIN &&
    dipendente.ruolo !== RUOLI_DIPENDENTE.SUPERADMIN
  ) {
    return true;
  }

  const { count, error } = await supabaseAdmin
    .from("dipendenti")
    .select("id", {
      count: "exact",
      head: true,
    })
    .in("ruolo", [RUOLI_DIPENDENTE.ADMIN, RUOLI_DIPENDENTE.SUPERADMIN])
    .eq("attivo", true)
    .eq("azienda_id", aziendaId)
    .neq("id", dipendente.id);

  if (error) {
    throw error;
  }

  return (count || 0) > 0;
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

    const dipendenteId =
      await leggiDipendenteId(request);

    if (!dipendenteId) {
      return jsonErrore(
        ERRORI_API.PAYLOAD_NON_VALIDO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const {
      data: dipendente,
      error: dipendenteError,
    } = await supabaseAdmin
      .from("dipendenti")
      .select(
        "id, email, ruolo, attivo, auth_user_id"
      )
      .eq("id", dipendenteId)
      .eq("azienda_id", aziendaId)
      .maybeSingle();

    if (dipendenteError) {
      throw dipendenteError;
    }

    if (!dipendente) {
      return jsonErrore(
        ERRORI_API.DIPENDENTE_NON_TROVATO,
        HTTP_STATUS.NOT_FOUND
      );
    }

    const dipendenteEliminabile =
      dipendente as DipendenteEliminabile;

    if (dipendenteEliminabile.attivo) {
      return jsonErrore(
        ERRORI_API.DIPENDENTE_ATTIVO,
        HTTP_STATUS.CONFLICT
      );
    }

    if (
      isAdminCorrente(
        dipendenteEliminabile,
        user.id,
        user.email
      )
    ) {
      return jsonErrore(
        ERRORI_API.ADMIN_CORRENTE,
        HTTP_STATUS.CONFLICT
      );
    }

    const adminResidui =
      await verificaAdminResidui(
        dipendenteEliminabile,
        aziendaId
      );

    if (!adminResidui) {
      return jsonErrore(
        ERRORI_API.ULTIMO_ADMIN,
        HTTP_STATUS.CONFLICT
      );
    }

    if (dipendenteEliminabile.auth_user_id) {
      const {
        count: numeroTimbrature,
        error: timbratureError,
      } = await supabaseAdmin
        .from("timbrature")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq(
          "user_id",
          dipendenteEliminabile.auth_user_id
        )
        .eq("azienda_id", aziendaId);

      if (timbratureError) {
        throw timbratureError;
      }

      if ((numeroTimbrature || 0) > 0) {
        return jsonErrore(
          ERRORI_API.DIPENDENTE_USATO,
          HTTP_STATUS.CONFLICT
        );
      }

      const { error: authDeleteError } =
        await supabaseAdmin.auth.admin.deleteUser(
          dipendenteEliminabile.auth_user_id
        );

      if (authDeleteError) {
        console.error(
          "Eliminazione utente Auth fallita",
          authDeleteError
        );

        return jsonErrore(
          ERRORI_API.AUTH_DELETE_FALLITO,
          HTTP_STATUS.CONFLICT
        );
      }
    }

    const { error: deleteError } =
      await supabaseAdmin
        .from("dipendenti")
        .delete()
        .eq("id", dipendenteId)
        .eq("azienda_id", aziendaId);

    if (deleteError) {
      throw deleteError;
    }

    return Response.json(
      {
        id: dipendenteId,
      },
      {
        status: HTTP_STATUS.OK,
      }
    );
  } catch (error: unknown) {
    console.error(
      "Errore eliminazione dipendente",
      error
    );

    return jsonErrore(
      ERRORI_API.ERRORE_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
