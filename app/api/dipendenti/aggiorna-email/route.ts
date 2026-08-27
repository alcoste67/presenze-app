import { isAuthApiError } from "@supabase/supabase-js";

import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { isAdmin } from "@/services/dipendenti/isAdmin";

export const dynamic = "force-dynamic";

// Cambia l'email di un dipendente sincronizzando SIA la tabella dipendenti SIA
// l'utente Auth collegato (auth.users). Senza questa sync l'accesso resta legato
// alla vecchia email. Richiede privilegi admin.

const ERRORI = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  PAYLOAD_NON_VALIDO: "Dati non validi",
  NON_TROVATO: "Dipendente non trovato",
  EMAIL_IN_USO: "Email già usata da un altro utente",
  ERRORE_GENERICO: "Errore aggiornamento email",
} as const;

const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErr(msg: string, status: number) {
  return Response.json({ errore: msg }, { status, headers: NO_STORE });
}

function estraiToken(request: Request): string | null {
  const auth = request.headers.get(API_HEADERS.AUTHORIZATION);
  if (!auth?.startsWith(API_HEADERS.BEARER_PREFIX)) return null;
  return auth.slice(API_HEADERS.BEARER_PREFIX.length).trim() || null;
}

function isEmailInUso(error: unknown): boolean {
  if (!isAuthApiError(error)) return false;
  if (error.code === "email_exists") return true;
  return error.message.toLowerCase().includes("already");
}

export async function POST(request: Request): Promise<Response> {
  try {
    const token = estraiToken(request);
    if (!token) return jsonErr(ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user?.email)
      return jsonErr(ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);

    if (!(await isAdmin(user.email, supabaseAdmin)))
      return jsonErr(ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErr(ERRORI.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
    }

    if (
      !isRecord(body) ||
      typeof body.dipendenteId !== "string" ||
      !body.dipendenteId ||
      typeof body.email !== "string" ||
      !body.email.trim()
    ) {
      return jsonErr(ERRORI.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
    }

    const dipendenteId = body.dipendenteId;
    const email = body.email.trim().toLowerCase();
    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, user.id);

    // Il dipendente deve appartenere all'azienda dell'admin (multi-tenant).
    const { data: dipendente, error: errDip } = await supabaseAdmin
      .from("dipendenti")
      .select("id, auth_user_id")
      .eq("id", dipendenteId)
      .eq("azienda_id", aziendaId)
      .maybeSingle();

    if (errDip) throw errDip;
    if (!dipendente) return jsonErr(ERRORI.NON_TROVATO, HTTP_STATUS.NOT_FOUND);

    // 1) Sincronizza l'utente Auth (se il dipendente ha un accesso).
    if (dipendente.auth_user_id) {
      const { error: errAuth } =
        await supabaseAdmin.auth.admin.updateUserById(
          dipendente.auth_user_id as string,
          { email, email_confirm: true }
        );
      if (errAuth) {
        if (isEmailInUso(errAuth))
          return jsonErr(ERRORI.EMAIL_IN_USO, HTTP_STATUS.CONFLICT);
        throw errAuth;
      }
    }

    // 2) Allinea la tabella dipendenti.
    const { error: errUpd } = await supabaseAdmin
      .from("dipendenti")
      .update({ email })
      .eq("id", dipendenteId)
      .eq("azienda_id", aziendaId);
    if (errUpd) throw errUpd;

    return Response.json(
      { sincronizzato: Boolean(dipendente.auth_user_id) },
      { headers: NO_STORE }
    );
  } catch (error: unknown) {
    console.error("Errore aggiorna-email dipendente", error);
    return jsonErr(ERRORI.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
