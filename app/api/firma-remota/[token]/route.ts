import { RAPPORTI_INTERVENTO_STATI } from "@/constants/rapportiIntervento";
import { HTTP_STATUS } from "@/constants/api";
import { RAPPORTI_INTERVENTO_LIMITI } from "@/constants/rapportiIntervento";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRecord } from "@/lib/typeGuards";

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
  if (row.stato === "firmato") return "Rapporto già firmato";
  if (row.stato === "annullato") return "Link non più valido";
  if (new Date(row.expires_at).getTime() < Date.now()) return "Link scaduto";
  return null;
}

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

  const { data: rapporto } = await supabaseAdmin
    .from("rapporti_intervento")
    .select(
      "id, cliente_committente, cantiere_nome_snapshot, cantiere_indirizzo_snapshot, data_intervento, responsabile_nome, note, stato"
    )
    .eq("id", row.rapporto_intervento_id)
    .maybeSingle();

  if (!rapporto || rapporto.stato !== RAPPORTI_INTERVENTO_STATI.BOZZA) {
    return jsonErrore("Rapporto non disponibile", HTTP_STATUS.NOT_FOUND);
  }

  const { data: lavorazioni } = await supabaseAdmin
    .from("rapporti_intervento_lavorazioni")
    .select("descrizione")
    .eq("rapporto_intervento_id", row.rapporto_intervento_id);

  return Response.json(
    {
      cliente: rapporto.cliente_committente,
      cantiere: rapporto.cantiere_nome_snapshot,
      indirizzo: rapporto.cantiere_indirizzo_snapshot,
      data_intervento: rapporto.data_intervento,
      responsabile: rapporto.responsabile_nome,
      note: rapporto.note,
      lavorazioni: (lavorazioni || []).map((l) => l.descrizione),
    },
    { status: 200, headers: NO_STORE }
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
): Promise<Response> {
  const { token } = await params;
  const row = await leggiToken(token);
  const errore = tokenNonValido(row);
  if (errore || !row) {
    return jsonErrore(errore || "Link non valido", HTTP_STATUS.NOT_FOUND);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErrore("Input non valido", HTTP_STATUS.BAD_REQUEST);
  }
  if (
    !isRecord(body) ||
    typeof body.firmaDataUrl !== "string" ||
    !body.firmaDataUrl.startsWith("data:image/")
  ) {
    return jsonErrore("Firma mancante", HTTP_STATUS.BAD_REQUEST);
  }
  const firmaDataUrl = body.firmaDataUrl;
  if (firmaDataUrl.length > RAPPORTI_INTERVENTO_LIMITI.FIRMA_MAX_DATA_URL_CARATTERI) {
    return jsonErrore("Firma troppo grande", HTTP_STATUS.BAD_REQUEST);
  }
  const nome =
    typeof body.nome === "string" && body.nome.trim() ? body.nome.trim() : null;

  const adesso = new Date().toISOString();

  // Applica la firma cliente e porta a FIRMATO (la firma responsabile è già
  // presente). Il trigger di lock consente BOZZA -> FIRMATO.
  const { data: aggiornato, error: firmaError } = await supabaseAdmin
    .from("rapporti_intervento")
    .update({
      firma_cliente_data_url: firmaDataUrl,
      firma_cliente_nome: nome,
      firma_cliente_at: adesso,
      stato: RAPPORTI_INTERVENTO_STATI.FIRMATO,
      updated_at: adesso,
    })
    .eq("id", row.rapporto_intervento_id)
    .eq("stato", RAPPORTI_INTERVENTO_STATI.BOZZA)
    .select("id")
    .maybeSingle();

  if (firmaError || !aggiornato) {
    return jsonErrore(
      "Firma non riuscita: il rapporto potrebbe essere già stato firmato",
      HTTP_STATUS.CONFLICT
    );
  }

  await supabaseAdmin
    .from("rapporti_firma_remota")
    .update({ stato: "firmato", firmato_at: adesso })
    .eq("id", row.id);

  return Response.json({ firmato: true }, { status: 200, headers: NO_STORE });
}
