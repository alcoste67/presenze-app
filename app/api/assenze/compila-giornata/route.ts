import { HTTP_STATUS } from "@/constants/api";
import { ASSENZE_TESTI, RUOLI_APPROVA_ASSENZE, TIPO_ASSENZA } from "@/constants/assenze";
import { estraiBearerToken } from "@/lib/auth";
import { isRecord } from "@/lib/typeGuards";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { compilaGiornataVuota, GiornataVuotaError } from "@/services/assenze/compilaGiornataVuota";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const DATA_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIPI_VALIDI = new Set(Object.values(TIPO_ASSENZA));

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const { data: dipendenteChiamante } = await supabaseAdmin
      .from("dipendenti")
      .select("id, azienda_id, ruolo")
      .eq("auth_user_id", user.id)
      .eq("attivo", true)
      .maybeSingle();

    if (
      !dipendenteChiamante ||
      !(RUOLI_APPROVA_ASSENZE as readonly string[]).includes(dipendenteChiamante.ruolo)
    ) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
    }

    const body = await request.json().catch(() => null);
    if (
      !isRecord(body) ||
      typeof body.dipendenteId !== "string" ||
      !body.dipendenteId ||
      typeof body.data !== "string" ||
      !DATA_PATTERN.test(body.data) ||
      typeof body.tipo !== "string" ||
      !TIPI_VALIDI.has(body.tipo as never)
    ) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.GENERICO, HTTP_STATUS.BAD_REQUEST);
    }

    const nota = typeof body.nota === "string" ? body.nota : "";

    const id = await compilaGiornataVuota({
      aziendaId: dipendenteChiamante.azienda_id,
      dipendenteId: body.dipendenteId,
      compilataDa: dipendenteChiamante.id,
      data: body.data,
      tipo: body.tipo as "FERIE" | "PERMESSO" | "ALTRO",
      nota,
      supabaseClient: supabaseAdmin,
    });

    return Response.json({ ok: true, id }, { headers: NO_STORE });
  } catch (error: unknown) {
    if (error instanceof GiornataVuotaError) {
      return jsonErrore(error.message, HTTP_STATUS.CONFLICT);
    }
    console.error("Errore compilazione giornata vuota", error);
    return jsonErrore(ASSENZE_TESTI.ERRORI.SALVATAGGIO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
