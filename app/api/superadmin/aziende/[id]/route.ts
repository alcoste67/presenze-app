import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { isRecord } from "@/lib/typeGuards";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isSuperadmin } from "@/services/dipendenti/isSuperadmin";

// ─── Constants ────────────────────────────────────────────────────────────────

const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  PAYLOAD_NON_VALIDO: "Dati non validi",
  AZIENDA_NON_TROVATA: "Azienda non trovata",
  ERRORE_GENERICO: "Errore aggiornamento azienda",
  ERRORE_ELIMINAZIONE: "Errore eliminazione azienda",
} as const;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const SELECT_AZIENDA =
  "id, nome, email, stato_abbonamento, piano, trial_scadenza, attiva, created_at";

const STATI_ABBONAMENTO = new Set(["trial", "attivo", "sospeso", "scaduto"]);
const PIANI = new Set(["base", "pro", "enterprise"]);

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

  return { ok: true };
}

function leggiPatchPayload(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) return null;

  const p: Record<string, unknown> = {};

  if ("attiva" in body) {
    if (typeof body.attiva !== "boolean") return null;
    p.attiva = body.attiva;
  }
  if ("stato_abbonamento" in body) {
    if (typeof body.stato_abbonamento !== "string") return null;
    if (!STATI_ABBONAMENTO.has(body.stato_abbonamento)) return null;
    p.stato_abbonamento = body.stato_abbonamento;
  }
  if ("piano" in body) {
    if (typeof body.piano !== "string") return null;
    if (!PIANI.has(body.piano)) return null;
    p.piano = body.piano;
  }

  return Object.keys(p).length > 0 ? p : null;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const auth = await verificaSuperadmin(request);
    if (!auth.ok) return auth.risposta;

    const { id } = await params;
    if (!id?.trim())
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
    }

    const aggiornamenti = leggiPatchPayload(body);
    if (!aggiornamenti)
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);

    const { data, error } = await supabaseAdmin
      .from("aziende")
      .update({ ...aggiornamenti, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(SELECT_AZIENDA)
      .single();

    if (error) throw error;
    if (!data)
      return jsonErrore(ERRORI_API.AZIENDA_NON_TROVATA, HTTP_STATUS.NOT_FOUND);

    return Response.json(data, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    console.error("Errore PATCH superadmin azienda", error);
    return jsonErrore(ERRORI_API.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const auth = await verificaSuperadmin(request);
    if (!auth.ok) return auth.risposta;

    const { id } = await params;
    if (!id?.trim())
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);

    // Read auth_user_ids before deletion so we can clean up auth accounts
    const { data: dipendenti, error: dipendentiReadError } = await supabaseAdmin
      .from("dipendenti")
      .select("auth_user_id")
      .eq("azienda_id", id)
      .not("auth_user_id", "is", null);

    if (dipendentiReadError) throw dipendentiReadError;

    // Delete in FK-safe order
    const tabelleLeaf = [
      "timbrature_lavorazioni",
      "sal_lavorazioni_foto",
      "costi_macchinari_commessa",
      "contratti_cantiere",
      "costi_materiali_cantiere",
      "sal_freeze_lavorazioni",
      "sal_freeze_foto",
      "sal_freeze_macchinari",
    ];

    for (const tabella of tabelleLeaf) {
      const { error } = await supabaseAdmin
        .from(tabella)
        .delete()
        .eq("azienda_id", id);
      if (error) throw error;
    }

    // rapporti_intervento deletion cascades to all rapporti_intervento_* children
    const tabelleParent = [
      "sal_freeze_mensili",
      "rapporti_intervento",
      "lavorazioni_cantiere",
      "timbrature",
      "macchinari",
      "cantieri",
    ];

    for (const tabella of tabelleParent) {
      const { error } = await supabaseAdmin
        .from(tabella)
        .delete()
        .eq("azienda_id", id);
      if (error) throw error;
    }

    // Delete Supabase auth accounts for each dipendente
    const authUserIds = (dipendenti ?? [])
      .map((d) => d.auth_user_id as string)
      .filter(Boolean);

    for (const userId of authUserIds) {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) console.error(`Errore eliminazione auth user ${userId}:`, error);
    }

    // Delete dipendenti and the azienda record
    const { error: dipendentiDelError } = await supabaseAdmin
      .from("dipendenti")
      .delete()
      .eq("azienda_id", id);
    if (dipendentiDelError) throw dipendentiDelError;

    const { error: aziendaError } = await supabaseAdmin
      .from("aziende")
      .delete()
      .eq("id", id);
    if (aziendaError) throw aziendaError;

    return Response.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    console.error("Errore DELETE superadmin azienda", error);
    return jsonErrore(ERRORI_API.ERRORE_ELIMINAZIONE, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
