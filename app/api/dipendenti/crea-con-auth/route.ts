import {
  isAuthApiError,
  type User,
} from "@supabase/supabase-js";

import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { TIPO_CONTEGGIO_ORE } from "@/constants/tipoConteggioOre";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import type {
  Dipendente,
  DipendenteInput,
  RuoloDipendente,
  TipoConteggioOre,
} from "@/types/dipendenti";

const SELECT_DIPENDENTE =
  "id, nome, cognome, email, ruolo, attivo, tipo_conteggio_ore, auth_user_id, created_at, costo_orario, ral";


const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  PAYLOAD_NON_VALIDO: "Dati dipendente non validi",
  CAMPI_OBBLIGATORI:
    "Nome, cognome ed email sono obbligatori",
  DIPENDENTE_ESISTENTE:
    "Esiste gia un dipendente con questa email",
  AUTH_USER_NON_RECUPERATO:
    "Utente Auth esistente non recuperabile",
  CREAZIONE_AUTH_FALLITA:
    "Creazione utente Auth non riuscita",
  ERRORE_GENERICO:
    "Errore creazione dipendente",
} as const;

const AUTH_USER_ESISTENTE_CODES = [
  "email_exists",
  "user_already_exists",
  "conflict",
] as const;

const RUOLI_CONSENTITI: readonly RuoloDipendente[] =
  Object.values(RUOLI_DIPENDENTE);
const TIPI_CONTEGGIO_ORE_CONSENTITI: readonly TipoConteggioOre[] =
  Object.values(TIPO_CONTEGGIO_ORE);

type AuthUserCollegato = {
  userId: string;
  creatoOra: boolean;
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

function isRuoloDipendente(
  value: unknown
): value is RuoloDipendente {
  return (
    typeof value === "string" &&
    RUOLI_CONSENTITI.includes(
      value as RuoloDipendente
    )
  );
}

function isTipoConteggioOre(
  value: unknown
): value is TipoConteggioOre {
  return (
    typeof value === "string" &&
    TIPI_CONTEGGIO_ORE_CONSENTITI.includes(
      value as TipoConteggioOre
    )
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

async function leggiDipendenteInput(
  request: Request
): Promise<DipendenteInput | null> {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return null;
  }

  if (!isRecord(payload)) {
    return null;
  }

  const tipoConteggioOre =
    typeof payload.tipo_conteggio_ore ===
    "undefined"
      ? TIPO_CONTEGGIO_ORE.REALE
      : payload.tipo_conteggio_ore;

  if (
    typeof payload.nome !== "string" ||
    typeof payload.cognome !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.attivo !== "boolean" ||
    !isRuoloDipendente(payload.ruolo) ||
    !isTipoConteggioOre(tipoConteggioOre)
  ) {
    return null;
  }

  return {
    nome: payload.nome,
    cognome: payload.cognome,
    email: payload.email,
    ruolo: payload.ruolo,
    attivo: payload.attivo,
    tipo_conteggio_ore: tipoConteggioOre,
    costo_orario:
      typeof payload.costo_orario === "number" && payload.costo_orario >= 0
        ? payload.costo_orario
        : null,
    ral:
      typeof payload.ral === "number" && payload.ral >= 0
        ? payload.ral
        : null,
  };
}

function normalizzaDipendente(
  dipendente: DipendenteInput
): DipendenteInput {
  return {
    nome: dipendente.nome.trim(),
    cognome: dipendente.cognome.trim(),
    email: dipendente.email.trim().toLowerCase(),
    ruolo: dipendente.ruolo,
    attivo: dipendente.attivo,
    tipo_conteggio_ore:
      dipendente.tipo_conteggio_ore,
    costo_orario: dipendente.costo_orario,
    ral: dipendente.ral,
  };
}

function isAuthUserEsistente(
  error: unknown
): boolean {
  if (!isAuthApiError(error)) {
    return false;
  }

  if (
    error.code &&
    AUTH_USER_ESISTENTE_CODES.includes(
      error.code as (typeof AUTH_USER_ESISTENTE_CODES)[number]
    )
  ) {
    return true;
  }

  return error.message
    .toLowerCase()
    .includes("already");
}

async function trovaAuthUserPerEmail(
  email: string
): Promise<User | null> {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } =
      await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage,
      });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (utente) =>
        utente.email?.trim().toLowerCase() === email
    );

    if (user) {
      return user;
    }

    if (!data.nextPage) {
      return null;
    }

    page = data.nextPage;
  }
}

async function creaORecuperaAuthUser(
  email: string
): Promise<AuthUserCollegato> {
  const { data, error } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
    });

  if (!error && data.user) {
    return {
      userId: data.user.id,
      creatoOra: true,
    };
  }

  if (!isAuthUserEsistente(error)) {
    throw error ?? new Error(
      ERRORI_API.CREAZIONE_AUTH_FALLITA
    );
  }

  const authUserEsistente =
    await trovaAuthUserPerEmail(email);

  if (!authUserEsistente) {
    throw new Error(
      ERRORI_API.AUTH_USER_NON_RECUPERATO
    );
  }

  return {
    userId: authUserEsistente.id,
    creatoOra: false,
  };
}

async function eliminaAuthUserCreatoOra(
  authUser: AuthUserCollegato
) {
  if (!authUser.creatoOra) {
    return;
  }

  const { error } =
    await supabaseAdmin.auth.admin.deleteUser(
      authUser.userId
    );

  if (error) {
    console.error(
      "Cleanup utente Auth fallito",
      error
    );
  }
}

function isErroreDuplicatoDb(
  error: unknown
): boolean {
  return (
    isRecord(error) &&
    error.code === "23505"
  );
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

    const input =
      await leggiDipendenteInput(request);

    if (!input) {
      return jsonErrore(
        ERRORI_API.PAYLOAD_NON_VALIDO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const dipendente =
      normalizzaDipendente(input);

    if (
      !dipendente.nome ||
      !dipendente.cognome ||
      !dipendente.email
    ) {
      return jsonErrore(
        ERRORI_API.CAMPI_OBBLIGATORI,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const {
      data: dipendenteEsistente,
      error: dipendenteEsistenteError,
    } = await supabaseAdmin
      .from("dipendenti")
      .select("id")
      .ilike("email", dipendente.email)
      .limit(1)
      .maybeSingle();

    if (dipendenteEsistenteError) {
      throw dipendenteEsistenteError;
    }

    if (dipendenteEsistente) {
      return jsonErrore(
        ERRORI_API.DIPENDENTE_ESISTENTE,
        HTTP_STATUS.CONFLICT
      );
    }

    const aziendaId = await getAziendaIdFromAuthUser(
      supabaseAdmin,
      user.id
    );

    const authUser =
      await creaORecuperaAuthUser(
        dipendente.email
      );

    const {
      data: nuovoDipendente,
      error: creaDipendenteError,
    } = await supabaseAdmin
      .from("dipendenti")
      .insert({
        nome: dipendente.nome,
        cognome: dipendente.cognome,
        email: dipendente.email,
        ruolo: dipendente.ruolo,
        attivo: dipendente.attivo,
        tipo_conteggio_ore:
          dipendente.tipo_conteggio_ore,
        auth_user_id: authUser.userId,
        azienda_id: aziendaId,
        costo_orario: dipendente.costo_orario,
        ral: dipendente.ral,
      })
      .select(SELECT_DIPENDENTE)
      .single();

    if (creaDipendenteError) {
      await eliminaAuthUserCreatoOra(authUser);

      if (
        isErroreDuplicatoDb(
          creaDipendenteError
        )
      ) {
        return jsonErrore(
          ERRORI_API.DIPENDENTE_ESISTENTE,
          HTTP_STATUS.CONFLICT
        );
      }

      throw creaDipendenteError;
    }

    return Response.json(
      nuovoDipendente as Dipendente,
      {
        status: HTTP_STATUS.CREATED,
      }
    );
  } catch (error: unknown) {
    console.error(
      "Errore creazione dipendente con Auth",
      error
    );

    return jsonErrore(
      ERRORI_API.ERRORE_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
