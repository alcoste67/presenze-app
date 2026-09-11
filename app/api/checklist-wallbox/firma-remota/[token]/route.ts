import { CHECKLIST_WALLBOX_LIMITI, CHECKLIST_WALLBOX_STATI } from "@/constants/checklistWallbox";
import { HTTP_STATUS } from "@/constants/api";
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
  checklist_wallbox_id: string;
  stato: string;
  expires_at: string;
};

async function leggiToken(token: string): Promise<TokenRow | null> {
  if (!token) return null;
  const { data } = await supabaseAdmin
    .from("checklist_wallbox_firma_remota")
    .select("id, checklist_wallbox_id, stato, expires_at")
    .eq("id", token)
    .maybeSingle();
  return (data as TokenRow | null) || null;
}

function tokenNonValido(row: TokenRow | null): string | null {
  if (!row) return "Link non valido";
  if (row.stato === "firmato") return "Checklist già firmata";
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

  const { data: checklist } = await supabaseAdmin
    .from("checklist_wallbox")
    .select(
      "id, ragione_sociale, nome, cognome, comune, via, posizionamento, installazione_possibile, note, firma_tecnico_nome, stato"
    )
    .eq("id", row.checklist_wallbox_id)
    .maybeSingle();

  if (!checklist || checklist.stato !== CHECKLIST_WALLBOX_STATI.BOZZA) {
    return jsonErrore("Checklist non disponibile", HTTP_STATUS.NOT_FOUND);
  }

  return Response.json(
    {
      cliente:
        checklist.ragione_sociale?.trim() ||
        `${checklist.nome} ${checklist.cognome}`.trim(),
      comune: checklist.comune,
      indirizzo: checklist.via,
      posizionamento: checklist.posizionamento,
      installazione_possibile: checklist.installazione_possibile,
      note: checklist.note,
      tecnico: checklist.firma_tecnico_nome,
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
  if (firmaDataUrl.length > CHECKLIST_WALLBOX_LIMITI.FIRMA_MAX_DATA_URL_CARATTERI) {
    return jsonErrore("Firma troppo grande", HTTP_STATUS.BAD_REQUEST);
  }
  if (typeof body.nome !== "string" || !body.nome.trim()) {
    return jsonErrore(
      "Inserisci nome e cognome di chi firma",
      HTTP_STATUS.BAD_REQUEST
    );
  }
  const nome = body.nome.trim();

  const adesso = new Date().toISOString();

  // Applica la firma cliente e porta a FIRMATO (la firma tecnico è già
  // presente). Il trigger di lock consente BOZZA -> FIRMATO.
  const { data: aggiornato, error: firmaError } = await supabaseAdmin
    .from("checklist_wallbox")
    .update({
      firma_cliente_data_url: firmaDataUrl,
      firma_cliente_nome: nome,
      firma_cliente_at: adesso,
      stato: CHECKLIST_WALLBOX_STATI.FIRMATO,
      updated_at: adesso,
    })
    .eq("id", row.checklist_wallbox_id)
    .eq("stato", CHECKLIST_WALLBOX_STATI.BOZZA)
    .select("id")
    .maybeSingle();

  if (firmaError || !aggiornato) {
    return jsonErrore(
      "Firma non riuscita: la checklist potrebbe essere già stata firmata",
      HTTP_STATUS.CONFLICT
    );
  }

  await supabaseAdmin
    .from("checklist_wallbox_firma_remota")
    .update({ stato: "firmato", firmato_at: adesso })
    .eq("id", row.id);

  return Response.json({ firmato: true }, { status: 200, headers: NO_STORE });
}
