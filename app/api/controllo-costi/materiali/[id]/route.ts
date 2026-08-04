import { HTTP_STATUS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verificaAccessoCommessa } from "@/lib/authCommessa";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const ERRORI = {
  NON_TROVATO: "Materiale non trovato",
  ERRORE_GENERICO: "Errore eliminazione materiale",
} as const;

const NO_STORE = { "Cache-Control": "no-store" } as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonErr(msg: string, status: number) {
  return Response.json({ errore: msg }, { status, headers: NO_STORE });
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    if (!id) return jsonErr(ERRORI.NON_TROVATO, HTTP_STATUS.NOT_FOUND);

    // Recupera il cantiere del materiale per autorizzare admin o responsabile.
    const { data: materiale } = await supabaseAdmin
      .from("costi_materiali_cantiere")
      .select("cantiere_id, azienda_id")
      .eq("id", id)
      .maybeSingle();

    if (!materiale)
      return jsonErr(ERRORI.NON_TROVATO, HTTP_STATUS.NOT_FOUND);

    const auth = await verificaAccessoCommessa(
      request,
      materiale.cantiere_id as string
    );
    if (!auth.ok) return auth.risposta;

    // Difesa multi-tenant: il materiale deve appartenere all'azienda dell'utente.
    if (materiale.azienda_id !== auth.aziendaId)
      return jsonErr(ERRORI.NON_TROVATO, HTTP_STATUS.NOT_FOUND);

    const { error, count } = await supabaseAdmin
      .from("costi_materiali_cantiere")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("azienda_id", auth.aziendaId);

    if (error) throw error;
    if (!count) return jsonErr(ERRORI.NON_TROVATO, HTTP_STATUS.NOT_FOUND);

    return new Response(null, { status: 204 });
  } catch (error: unknown) {
    console.error("Errore DELETE materiale", error);
    return jsonErr(ERRORI.ERRORE_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
