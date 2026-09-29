import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { MODULI_BACKOFFICE, PIANI_ABBONAMENTO } from "@/constants/moduliBackoffice";
import { isRecord } from "@/lib/typeGuards";
import { isPlatformAdminEmail } from "@/lib/platformAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ─── Constants ────────────────────────────────────────────────────────────────

const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  PAYLOAD_NON_VALIDO: "Dati non validi",
  ERRORE_GENERICO: "Errore operazione piano moduli",
} as const;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const MODULI_VALIDI = new Set<string>(Object.values(MODULI_BACKOFFICE));
const PIANI_VALIDI = new Set<string>(PIANI_ABBONAMENTO);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE_HEADERS });
}

function estraiAccessToken(request: Request): string | null {
  const auth = request.headers.get(API_HEADERS.AUTHORIZATION);
  if (!auth?.startsWith(API_HEADERS.BEARER_PREFIX)) return null;
  return auth.slice(API_HEADERS.BEARER_PREFIX.length).trim() || null;
}

type AuthOk = { ok: true };
type AuthFail = { ok: false; risposta: Response };

async function verificaSuperadmin(request: Request): Promise<AuthOk | AuthFail> {
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

  if (!isPlatformAdminEmail(user.email))
    return {
      ok: false,
      risposta: jsonErrore(ERRORI_API.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN),
    };

  return { ok: true };
}

function leggiPatchPayload(
  body: unknown
): { piano: string; modulo: string; abilitato: boolean } | null {
  if (!isRecord(body)) return null;
  if (typeof body.piano !== "string" || !PIANI_VALIDI.has(body.piano)) return null;
  if (typeof body.modulo !== "string" || !MODULI_VALIDI.has(body.modulo)) return null;
  if (typeof body.abilitato !== "boolean") return null;

  return { piano: body.piano, modulo: body.modulo, abilitato: body.abilitato };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await verificaSuperadmin(request);
    if (!auth.ok) return auth.risposta;

    const { data, error } = await supabaseAdmin
      .from("piano_moduli")
      .select("piano, modulo, abilitato");

    if (error) throw error;

    return Response.json(data ?? [], { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    console.error("Errore GET superadmin piano-moduli", error);
    return jsonErrore(ERRORI_API.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const auth = await verificaSuperadmin(request);
    if (!auth.ok) return auth.risposta;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
    }

    const payload = leggiPatchPayload(body);
    if (!payload)
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);

    const { error } = await supabaseAdmin
      .from("piano_moduli")
      .upsert(
        { ...payload, updated_at: new Date().toISOString() },
        { onConflict: "piano,modulo" }
      );

    if (error) throw error;

    return Response.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    console.error("Errore PATCH superadmin piano-moduli", error);
    return jsonErrore(ERRORI_API.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
