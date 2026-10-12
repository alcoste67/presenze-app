import { isRecord } from "@/lib/typeGuards";
import { HTTP_STATUS } from "@/constants/api";
import { NOTE_SPESE_LIMITI, NOTE_SPESE_TESTI } from "@/constants/noteSpese";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const DATA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

type DipendenteChiamante = {
  id: string;
  azienda_id: string;
  usa_auto_propria: boolean;
};

async function getDipendenteChiamante(accessToken: string): Promise<DipendenteChiamante | null> {
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) return null;

  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("id, azienda_id, usa_auto_propria")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  return (dipendente as DipendenteChiamante | null) || null;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const dipendente = await getDipendenteChiamante(accessToken);
    if (!dipendente) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const { searchParams } = new URL(request.url);
    const dataInizio = searchParams.get("dataInizio");
    const dataFine = searchParams.get("dataFine");

    let query = supabaseAdmin
      .from("note_chilometri")
      .select("id, data, km")
      .eq("dipendente_id", dipendente.id)
      .order("data", { ascending: false });

    if (dataInizio && dataFine) {
      query = query.gte("data", dataInizio).lte("data", dataFine);
    }

    const { data: righe, error } = await query;
    if (error) throw error;

    return Response.json(
      {
        usaAutoPropria: dipendente.usa_auto_propria,
        note: (righe || []).map((r) => ({ id: r.id, data: r.data, km: r.km })),
      },
      { headers: NO_STORE }
    );
  } catch (error: unknown) {
    console.error("Errore caricamento note chilometri", error);
    return jsonErrore(NOTE_SPESE_TESTI.ERRORI.CARICAMENTO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const dipendente = await getDipendenteChiamante(accessToken);
    if (!dipendente) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    if (!dipendente.usa_auto_propria) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.AUTO_PROPRIA_NON_ABILITATA, HTTP_STATUS.FORBIDDEN);
    }

    const body = await request.json().catch(() => null);
    if (
      !isRecord(body) ||
      typeof body.data !== "string" ||
      !DATA_PATTERN.test(body.data) ||
      typeof body.km !== "number" ||
      !Number.isFinite(body.km) ||
      body.km < 0 ||
      body.km > NOTE_SPESE_LIMITI.KM_MASSIMI_GIORNO
    ) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.KM_NON_VALIDI, HTTP_STATUS.BAD_REQUEST);
    }

    const { error } = await supabaseAdmin.from("note_chilometri").upsert(
      {
        azienda_id: dipendente.azienda_id,
        dipendente_id: dipendente.id,
        data: body.data,
        km: body.km,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "dipendente_id,data" }
    );

    if (error) throw error;

    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Errore salvataggio note chilometri", error);
    return jsonErrore(NOTE_SPESE_TESTI.ERRORI.SALVATAGGIO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
