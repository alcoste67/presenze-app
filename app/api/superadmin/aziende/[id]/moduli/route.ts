import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { MODULI_BACKOFFICE } from "@/constants/moduliBackoffice";
import { isRecord } from "@/lib/typeGuards";
import { isPlatformAdminEmail } from "@/lib/platformAdmin";
import { risolviModuliAbilitati } from "@/lib/moduliAbilitatiServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ─── Constants ────────────────────────────────────────────────────────────────

const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  PAYLOAD_NON_VALIDO: "Dati non validi",
  AZIENDA_NON_TROVATA: "Azienda non trovata",
  ERRORE_GENERICO: "Errore operazione moduli azienda",
} as const;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const MODULI_VALIDI = new Set<string>(Object.values(MODULI_BACKOFFICE));

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

// ─── Routes ───────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const auth = await verificaSuperadmin(request);
    if (!auth.ok) return auth.risposta;

    const { id } = await params;
    if (!id?.trim())
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);

    const { data: azienda } = await supabaseAdmin
      .from("aziende")
      .select("id, piano")
      .eq("id", id)
      .maybeSingle();

    if (!azienda)
      return jsonErrore(ERRORI_API.AZIENDA_NON_TROVATA, HTTP_STATUS.NOT_FOUND);

    const { data: override, error: overrideError } = await supabaseAdmin
      .from("azienda_moduli_override")
      .select("modulo, abilitato")
      .eq("azienda_id", id);

    if (overrideError) throw overrideError;

    const effettivi = await risolviModuliAbilitati(
      id,
      (azienda.piano as string | null) ?? null
    );

    return Response.json(
      { piano: azienda.piano, override: override ?? [], effettivi },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    console.error("Errore GET superadmin azienda moduli", error);
    return jsonErrore(ERRORI_API.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

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

    if (!isRecord(body) || typeof body.modulo !== "string" || !MODULI_VALIDI.has(body.modulo))
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);

    // abilitato === null: rimuove l'override, torna al default del piano
    if (body.abilitato === null) {
      const { error } = await supabaseAdmin
        .from("azienda_moduli_override")
        .delete()
        .eq("azienda_id", id)
        .eq("modulo", body.modulo);

      if (error) throw error;
      return Response.json({ success: true }, { headers: NO_STORE_HEADERS });
    }

    if (typeof body.abilitato !== "boolean")
      return jsonErrore(ERRORI_API.PAYLOAD_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);

    const { error } = await supabaseAdmin.from("azienda_moduli_override").upsert(
      {
        azienda_id: id,
        modulo: body.modulo,
        abilitato: body.abilitato,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "azienda_id,modulo" }
    );

    if (error) throw error;

    return Response.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    console.error("Errore PATCH superadmin azienda moduli", error);
    return jsonErrore(ERRORI_API.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
