import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { isAdmin } from "@/services/dipendenti/isAdmin";

// ─────────────────────────────────────────────────────────────────────────────
// Autorizzazione costi/DDT di commessa.
// Un utente può leggere/scrivere i costi materiali di un cantiere se:
//   - è ADMIN dell'azienda, OPPURE
//   - è il responsabile commessa di QUEL cantiere
//     (cantieri.responsabile_commessa_user_id = utente, stessa azienda).
// La verifica gira SEMPRE lato server con service role.
// ─────────────────────────────────────────────────────────────────────────────

const ERRORI = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  CANTIERE_MANCANTE: "cantiereId obbligatorio",
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

export type AccessoCommessaOk = {
  ok: true;
  userId: string;
  aziendaId: string;
  isAdmin: boolean;
};
export type AccessoCommessaFail = { ok: false; risposta: Response };

/**
 * Verifica l'accesso ai costi/DDT di uno specifico cantiere.
 * Gli ADMIN passano sempre; i non-admin devono essere responsabili di quel
 * cantiere. Per i non-admin `cantiereId` è obbligatorio.
 */
export async function verificaAccessoCommessa(
  request: Request,
  cantiereId: string | null
): Promise<AccessoCommessaOk | AccessoCommessaFail> {
  const token = estraiToken(request);
  if (!token)
    return {
      ok: false,
      risposta: jsonErr(ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED),
    };

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user?.email)
    return {
      ok: false,
      risposta: jsonErr(ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED),
    };

  const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, user.id);

  const adminOk = await isAdmin(user.email, supabaseAdmin);
  if (adminOk) {
    return { ok: true, userId: user.id, aziendaId, isAdmin: true };
  }

  // Non admin: deve essere responsabile del cantiere indicato.
  if (!cantiereId)
    return {
      ok: false,
      risposta: jsonErr(ERRORI.CANTIERE_MANCANTE, HTTP_STATUS.BAD_REQUEST),
    };

  const { data: cantiere, error: errCantiere } = await supabaseAdmin
    .from("cantieri")
    .select("id")
    .eq("id", cantiereId)
    .eq("azienda_id", aziendaId)
    .eq("responsabile_commessa_user_id", user.id)
    .maybeSingle();

  if (errCantiere || !cantiere)
    return {
      ok: false,
      risposta: jsonErr(ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN),
    };

  return { ok: true, userId: user.id, aziendaId, isAdmin: false };
}
