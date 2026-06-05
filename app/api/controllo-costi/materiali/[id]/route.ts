import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const ERRORI = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  NON_TROVATO: "Materiale non trovato",
  ERRORE_GENERICO: "Errore eliminazione materiale",
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

// ─── Route ────────────────────────────────────────────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const auth = await verificaAdmin(request);
    if (!auth.ok) return auth.risposta;

    const { id } = await params;
    if (!id) return jsonErr(ERRORI.NON_TROVATO, HTTP_STATUS.NOT_FOUND);

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, auth.userId);

    const { error, count } = await supabaseAdmin
      .from("costi_materiali_cantiere")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("azienda_id", aziendaId);

    if (error) throw error;
    if (!count) return jsonErr(ERRORI.NON_TROVATO, HTTP_STATUS.NOT_FOUND);

    return new Response(null, { status: 204 });
  } catch (error: unknown) {
    console.error("Errore DELETE materiale", error);
    return jsonErr(ERRORI.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
