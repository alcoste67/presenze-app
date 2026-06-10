import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { isRecord } from "@/lib/typeGuards";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";

// ─── Constants ────────────────────────────────────────────────────────────────

const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  PAYLOAD_NON_VALIDO: "Dati non validi",
  AZIENDA_NON_TROVATA: "Azienda non trovata",
  ERRORE_GENERICO: "Errore operazione azienda",
} as const;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const SELECT_AZIENDA =
  "nome, partita_iva, codice_fiscale, indirizzo, email, telefono, sito_web, logo_url, pec, codice_sdi, forma_societaria, sede_legale_via, sede_legale_citta, sede_legale_cap, sede_legale_provincia";

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

async function verificaAdmin(
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

  const adminOk = await isAdmin(user.email, supabaseAdmin);
  if (!adminOk)
    return {
      ok: false,
      risposta: jsonErrore(ERRORI_API.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN),
    };

  return { ok: true, userId: user.id, email: user.email };
}

// ─── PATCH payload ────────────────────────────────────────────────────────────

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function leggiPatchPayload(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) return null;
  if ("nome" in body && (typeof body.nome !== "string" || !body.nome.trim()))
    return null;

  const p: Record<string, unknown> = {};
  if (typeof body.nome === "string" && body.nome.trim()) p.nome = body.nome.trim();
  if ("partita_iva" in body)    p.partita_iva    = strOrNull(body.partita_iva);
  if ("codice_fiscale" in body) p.codice_fiscale = strOrNull(body.codice_fiscale);
  if ("indirizzo" in body)      p.indirizzo      = strOrNull(body.indirizzo);
  if ("email" in body)          p.email          = strOrNull(body.email);
  if ("telefono" in body)       p.telefono       = strOrNull(body.telefono);
  if ("sito_web" in body)       p.sito_web       = strOrNull(body.sito_web);
  if ("pec" in body)              p.pec              = strOrNull(body.pec);
  if ("codice_sdi" in body)       p.codice_sdi       = strOrNull(body.codice_sdi);
  if ("forma_societaria" in body) p.forma_societaria = strOrNull(body.forma_societaria);
  if ("sede_legale_via" in body)       p.sede_legale_via       = strOrNull(body.sede_legale_via);
  if ("sede_legale_citta" in body)     p.sede_legale_citta     = strOrNull(body.sede_legale_citta);
  if ("sede_legale_cap" in body)       p.sede_legale_cap       = strOrNull(body.sede_legale_cap);
  if ("sede_legale_provincia" in body) p.sede_legale_provincia = strOrNull(body.sede_legale_provincia);

  return Object.keys(p).length > 0 ? p : null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await verificaAdmin(request);
    if (!auth.ok) return auth.risposta;

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, auth.userId);

    const { data, error } = await supabaseAdmin
      .from("aziende")
      .select(SELECT_AZIENDA)
      .eq("id", aziendaId)
      .single();

    if (error || !data)
      return jsonErrore(ERRORI_API.AZIENDA_NON_TROVATA, HTTP_STATUS.NOT_FOUND);

    return Response.json(data, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    console.error("Errore GET impostazioni azienda", error);
    return jsonErrore(ERRORI_API.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const auth = await verificaAdmin(request);
    if (!auth.ok) return auth.risposta;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
    }

    const aggiornamenti = leggiPatchPayload(body);
    if (!aggiornamenti)
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, auth.userId);

    const { data, error } = await supabaseAdmin
      .from("aziende")
      .update({ ...aggiornamenti, updated_at: new Date().toISOString() })
      .eq("id", aziendaId)
      .select(SELECT_AZIENDA)
      .single();

    if (error || !data)
      throw error ?? new Error("Aggiornamento azienda fallito");

    return Response.json(data, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    console.error("Errore PATCH impostazioni azienda", error);
    return jsonErrore(ERRORI_API.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
