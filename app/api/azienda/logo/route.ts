import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";

// ─── Constants ────────────────────────────────────────────────────────────────

const BUCKET = "loghi-aziende";
const MAX_SIZE = 2 * 1024 * 1024;
const TIPI_CONSENTITI = new Set(["image/png", "image/jpeg"]);
const ESTENSIONE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
};

const ERRORI_API = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  FILE_MANCANTE: "File logo mancante",
  FORMATO_NON_VALIDO: "Formato non supportato. Usa PNG o JPG.",
  FILE_TROPPO_GRANDE: "File troppo grande. Massimo 2MB.",
  ERRORE_GENERICO: "Errore operazione logo",
} as const;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE_HEADERS });
}

function estraiAccessToken(request: Request): string | null {
  const auth = request.headers.get(API_HEADERS.AUTHORIZATION);
  if (!auth?.startsWith(API_HEADERS.BEARER_PREFIX)) return null;
  return auth.slice(API_HEADERS.BEARER_PREFIX.length).trim() || null;
}

type AuthOk = { ok: true; userId: string };
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

  return { ok: true, userId: user.id };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await verificaAdmin(request);
    if (!auth.ok) return auth.risposta;

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, auth.userId);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonErrore(ERRORI_API.FILE_MANCANTE, HTTP_STATUS.BAD_REQUEST);
    }

    const file = formData.get("logo");
    if (!(file instanceof File))
      return jsonErrore(ERRORI_API.FILE_MANCANTE, HTTP_STATUS.BAD_REQUEST);

    if (!TIPI_CONSENTITI.has(file.type))
      return jsonErrore(ERRORI_API.FORMATO_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);

    if (file.size > MAX_SIZE)
      return jsonErrore(ERRORI_API.FILE_TROPPO_GRANDE, HTTP_STATUS.BAD_REQUEST);

    const estensione = ESTENSIONE[file.type] ?? "jpg";
    const storagePath = `${aziendaId}/logo.${estensione}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET)
      .getPublicUrl(storagePath);

    const logoUrl = urlData.publicUrl;

    const { error: updateError } = await supabaseAdmin
      .from("aziende")
      .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq("id", aziendaId);

    if (updateError) throw updateError;

    return Response.json({ logo_url: logoUrl }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    console.error("Errore upload logo", error);
    return jsonErrore(ERRORI_API.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const auth = await verificaAdmin(request);
    if (!auth.ok) return auth.risposta;

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, auth.userId);

    const { data: azienda, error: fetchError } = await supabaseAdmin
      .from("aziende")
      .select("logo_url")
      .eq("id", aziendaId)
      .single();

    if (fetchError || !azienda)
      throw fetchError ?? new Error("Azienda non trovata");

    if (azienda.logo_url) {
      // Estrae il path relativo dall'URL pubblico Supabase Storage
      const parsed = new URL(azienda.logo_url as string);
      const marker = `/${BUCKET}/`;
      const idx = parsed.pathname.indexOf(marker);
      if (idx !== -1) {
        const storagePath = parsed.pathname.slice(idx + marker.length);
        const { error: deleteError } = await supabaseAdmin.storage
          .from(BUCKET)
          .remove([storagePath]);
        if (deleteError) console.error("Rimozione file storage fallita", deleteError);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("aziende")
      .update({ logo_url: null, updated_at: new Date().toISOString() })
      .eq("id", aziendaId);

    if (updateError) throw updateError;

    return Response.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    console.error("Errore rimozione logo", error);
    return jsonErrore(ERRORI_API.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
