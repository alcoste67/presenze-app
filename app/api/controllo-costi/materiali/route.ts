import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { isRecord } from "@/lib/typeGuards";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const ERRORI = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  CANTIERE_MANCANTE: "cantiereId obbligatorio",
  PAYLOAD_NON_VALIDO: "Dati non validi",
  ERRORE_GENERICO: "Errore operazione materiali",
} as const;

const NO_STORE = { "Cache-Control": "no-store" } as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonErr(msg: string, status: number) {
  return Response.json({ errore: msg }, { status, headers: NO_STORE });
}

function estraiToken(request: Request): string | null {
  const auth = request.headers.get(API_HEADERS.AUTHORIZATION);
  if (!auth?.startsWith(API_HEADERS.BEARER_PREFIX)) return null;
  return auth.slice(API_HEADERS.BEARER_PREFIX.length).trim() || null;
}

type AuthOk = { ok: true; userId: string };
type AuthFail = { ok: false; risposta: Response };

async function verificaAdmin(request: Request): Promise<AuthOk | AuthFail> {
  const token = estraiToken(request);
  if (!token)
    return { ok: false, risposta: jsonErr(ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED) };

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user?.email)
    return { ok: false, risposta: jsonErr(ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED) };

  const adminOk = await isAdmin(user.email, supabaseAdmin);
  if (!adminOk)
    return { ok: false, risposta: jsonErr(ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN) };

  return { ok: true, userId: user.id };
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await verificaAdmin(request);
    if (!auth.ok) return auth.risposta;

    const { searchParams } = new URL(request.url);
    const cantiereId = searchParams.get("cantiereId");
    if (!cantiereId)
      return jsonErr(ERRORI.CANTIERE_MANCANTE, HTTP_STATUS.BAD_REQUEST);

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, auth.userId);

    const { data, error } = await supabaseAdmin
      .from("costi_materiali_cantiere")
      .select("*")
      .eq("cantiere_id", cantiereId)
      .eq("azienda_id", aziendaId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return Response.json(data ?? [], { headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Errore GET materiali", error);
    return jsonErr(ERRORI.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await verificaAdmin(request);
    if (!auth.ok) return auth.risposta;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErr(ERRORI.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
    }

    if (
      !isRecord(body) ||
      typeof body.cantiere_id !== "string" ||
      !body.cantiere_id ||
      typeof body.descrizione !== "string" ||
      !body.descrizione.trim()
    ) {
      return jsonErr(ERRORI.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
    }

    const prezzoUnitario = numOrNull(body.prezzo_unitario);
    if (prezzoUnitario === null)
      return jsonErr(ERRORI.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, auth.userId);

    const { data, error } = await supabaseAdmin
      .from("costi_materiali_cantiere")
      .insert({
        cantiere_id: body.cantiere_id as string,
        azienda_id: aziendaId,
        descrizione: (body.descrizione as string).trim(),
        fornitore: strOrNull(body.fornitore),
        quantita: numOrNull(body.quantita) ?? 1,
        prezzo_unitario: prezzoUnitario,
        data_acquisto: strOrNull(body.data_acquisto),
        numero_ddt: strOrNull(body.numero_ddt),
      })
      .select("*")
      .single();

    if (error || !data) throw error ?? new Error("Insert materiale fallito");

    return Response.json(data, { status: HTTP_STATUS.CREATED, headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Errore POST materiale", error);
    return jsonErr(ERRORI.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
