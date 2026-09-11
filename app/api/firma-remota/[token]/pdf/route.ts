import { HTTP_STATUS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadRapportoIntervento } from "@/services/rapportiIntervento/loadRapportoIntervento";
import { generaRapportoInterventoPdf } from "@/services/rapportiIntervento/pdf/generaPdfRapporto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

type TokenRow = {
  id: string;
  rapporto_intervento_id: string;
  stato: string;
  expires_at: string;
};

async function leggiToken(token: string): Promise<TokenRow | null> {
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("rapporti_firma_remota")
    .select("id, rapporto_intervento_id, stato, expires_at")
    .eq("id", token)
    .maybeSingle();
  return (data as TokenRow | null) || null;
}

function tokenNonValido(row: TokenRow | null): string | null {
  if (!row) return "Link non valido";
  if (row.stato === "annullato") return "Link non più valido";
  if (new Date(row.expires_at).getTime() < Date.now()) return "Link scaduto";
  return null;
}

// Anteprima del documento da firmare: stesso PDF che riceverebbe il
// cliente via email, generato al volo (non è la copia legale — quella
// si genera una sola volta al momento dell'invio finale).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await params;
  const row = await leggiToken(token);
  const errore = tokenNonValido(row);
  if (errore || !row) {
    return jsonErrore(errore || "Link non valido", HTTP_STATUS.NOT_FOUND);
  }

  const rapporto = await loadRapportoIntervento(
    row.rapporto_intervento_id,
    supabaseAdmin
  );
  if (!rapporto) {
    return jsonErrore("Rapporto non trovato", HTTP_STATUS.NOT_FOUND);
  }

  const pdfBytes = await generaRapportoInterventoPdf(rapporto, {
    mostraFatturazione: false,
  });
  const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
  new Uint8Array(pdfBuffer).set(pdfBytes);

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"rapporto-intervento.pdf\"",
      "Cache-Control": "no-store",
    },
  });
}
