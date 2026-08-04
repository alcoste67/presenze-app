import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";

export const dynamic = "force-dynamic";

// Elenca i cantieri di cui l'utente loggato è responsabile commessa.
// Serve alla Home per mostrare la sezione "Costi commessa" solo a chi ne ha.

const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErr(msg: string, status: number) {
  return Response.json({ errore: msg }, { status, headers: NO_STORE });
}

function estraiToken(request: Request): string | null {
  const auth = request.headers.get(API_HEADERS.AUTHORIZATION);
  if (!auth?.startsWith(API_HEADERS.BEARER_PREFIX)) return null;
  return auth.slice(API_HEADERS.BEARER_PREFIX.length).trim() || null;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const token = estraiToken(request);
    if (!token)
      return jsonErr("Token autenticazione mancante", HTTP_STATUS.UNAUTHORIZED);

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);
    if (error || !user)
      return jsonErr("Token autenticazione non valido", HTTP_STATUS.UNAUTHORIZED);

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, user.id);

    const { data, error: errCantieri } = await supabaseAdmin
      .from("cantieri")
      .select("id, nome")
      .eq("azienda_id", aziendaId)
      .eq("responsabile_commessa_user_id", user.id)
      .eq("attivo", true)
      .order("nome", { ascending: true });

    if (errCantieri) throw errCantieri;

    return Response.json(data ?? [], { headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Errore GET commessa/cantieri", error);
    return jsonErr("Errore caricamento cantieri", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
