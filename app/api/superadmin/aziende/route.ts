import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isSuperadmin } from "@/services/dipendenti/isSuperadmin";

// ─── Constants ────────────────────────────────────────────────────────────────

const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  ERRORE_GENERICO: "Errore caricamento aziende",
} as const;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const SELECT_AZIENDA =
  "id, nome, email, stato_abbonamento, piano, trial_scadenza, attiva, created_at";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE_HEADERS });
}

function estraiAccessToken(request: Request): string | null {
  const auth = request.headers.get(API_HEADERS.AUTHORIZATION);
  if (!auth?.startsWith(API_HEADERS.BEARER_PREFIX)) return null;
  return auth.slice(API_HEADERS.BEARER_PREFIX.length).trim() || null;
}

type AuthOk = { ok: true; userId: string; email: string };
type AuthFail = { ok: false; risposta: Response };

async function verificaSuperadmin(
  request: Request
): Promise<AuthOk | AuthFail> {
  const token = estraiAccessToken(request);
  if (!token)
    return {
      ok: false,
      risposta: jsonErrore(ERRORI_API.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED),
    };

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user?.email)
    return {
      ok: false,
      risposta: jsonErrore(ERRORI_API.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED),
    };

  const superadminOk = await isSuperadmin(user.email, supabaseAdmin);
  if (!superadminOk)
    return {
      ok: false,
      risposta: jsonErrore(ERRORI_API.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN),
    };

  return { ok: true, userId: user.id, email: user.email };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await verificaSuperadmin(request);
    if (!auth.ok) return auth.risposta;

    const { data, error } = await supabaseAdmin
      .from("aziende")
      .select(SELECT_AZIENDA)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return Response.json(data ?? [], { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    console.error("Errore GET superadmin aziende", error);
    return jsonErrore(ERRORI_API.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
