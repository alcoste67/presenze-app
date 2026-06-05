import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { TIMBRATURE } from "@/constants/stati";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const ERRORI = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  CANTIERE_MANCANTE: "cantiereId obbligatorio",
  ERRORE_GENERICO: "Errore calcolo dashboard costi",
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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// ─── Manodopera ───────────────────────────────────────────────────────────────

type TimbraturaRow = { user_id: string; tipo: string; created_at: string };

function calcolaMinutiPerUtente(rows: TimbraturaRow[]): Map<string, number> {
  const byUser = new Map<string, TimbraturaRow[]>();
  for (const t of rows) {
    const lista = byUser.get(t.user_id) ?? [];
    lista.push(t);
    byUser.set(t.user_id, lista);
  }

  const result = new Map<string, number>();
  for (const [userId, utente] of byUser) {
    utente.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    let inizioMs: number | null = null;
    let totalMs = 0;

    for (const t of utente) {
      const ts = new Date(t.created_at).getTime();
      if (t.tipo === TIMBRATURE.ENTRATA || t.tipo === TIMBRATURE.RIENTRO) {
        if (inizioMs === null) inizioMs = ts;
      } else if (t.tipo === TIMBRATURE.PAUSA || t.tipo === TIMBRATURE.USCITA) {
        if (inizioMs !== null) {
          totalMs += Math.max(0, ts - inizioMs);
          inizioMs = null;
        }
      }
    }

    const minuti = Math.floor(totalMs / 60000);
    if (minuti > 0) result.set(userId, minuti);
  }
  return result;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<Response> {
  try {
    const auth = await verificaAdmin(request);
    if (!auth.ok) return auth.risposta;

    const { searchParams } = new URL(request.url);
    const cantiereId = searchParams.get("cantiereId");
    if (!cantiereId)
      return jsonErr(ERRORI.CANTIERE_MANCANTE, HTTP_STATUS.BAD_REQUEST);

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, auth.userId);

    const [contrattoRes, macchinariRes, materialiRes, timbratureRes] =
      await Promise.all([
        supabaseAdmin
          .from("contratti_cantiere")
          .select("importo_contratto, importo_extra_lavori")
          .eq("cantiere_id", cantiereId)
          .eq("azienda_id", aziendaId)
          .maybeSingle(),
        supabaseAdmin
          .from("costi_macchinari_commessa")
          .select("costo_totale")
          .eq("cantiere_id", cantiereId)
          .eq("azienda_id", aziendaId),
        supabaseAdmin
          .from("costi_materiali_cantiere")
          .select("quantita, prezzo_unitario")
          .eq("cantiere_id", cantiereId)
          .eq("azienda_id", aziendaId),
        supabaseAdmin
          .from("timbrature")
          .select("user_id, tipo, created_at")
          .eq("cantiere_id", cantiereId)
          .eq("azienda_id", aziendaId),
      ]);

    const costoMacchinari = round2(
      (macchinariRes.data ?? []).reduce(
        (acc, r) => acc + (r.costo_totale ?? 0),
        0
      )
    );

    const costoMateriali = round2(
      (materialiRes.data ?? []).reduce(
        (acc, r) => acc + (r.quantita ?? 1) * r.prezzo_unitario,
        0
      )
    );

    const minutiPerUtente = calcolaMinutiPerUtente(timbratureRes.data ?? []);
    let costoManodopera = 0;

    if (minutiPerUtente.size > 0) {
      const { data: dipendenti } = await supabaseAdmin
        .from("dipendenti")
        .select("auth_user_id, costo_orario")
        .in("auth_user_id", Array.from(minutiPerUtente.keys()))
        .eq("azienda_id", aziendaId);

      for (const d of dipendenti ?? []) {
        const minuti = minutiPerUtente.get(d.auth_user_id) ?? 0;
        costoManodopera += (minuti / 60) * (d.costo_orario ?? 0);
      }
    }
    costoManodopera = round2(costoManodopera);

    const importoContratto = contrattoRes.data?.importo_contratto ?? 0;
    const importoExtra = contrattoRes.data?.importo_extra_lavori ?? 0;
    const totaleRicavi = round2(importoContratto + importoExtra);
    const totaleCosti = round2(costoManodopera + costoMacchinari + costoMateriali);
    const margine = round2(totaleRicavi - totaleCosti);
    const marginePercentuale =
      totaleRicavi > 0
        ? Math.round((margine / totaleRicavi) * 1000) / 10
        : null;

    return Response.json(
      {
        ricavi: {
          importo_contratto: importoContratto,
          importo_extra_lavori: importoExtra,
          totale: totaleRicavi,
        },
        costi: {
          manodopera: costoManodopera,
          macchinari: costoMacchinari,
          materiali: costoMateriali,
          totale: totaleCosti,
        },
        margine,
        margine_percentuale: marginePercentuale,
      },
      { headers: NO_STORE }
    );
  } catch (error: unknown) {
    console.error("Errore GET dashboard costi", error);
    return jsonErr(ERRORI.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
