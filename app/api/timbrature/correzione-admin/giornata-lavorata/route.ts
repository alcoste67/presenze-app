import type { NextRequest } from "next/server";

import { ASSENZE_TESTI, RUOLI_APPROVA_ASSENZE } from "@/constants/assenze";
import { ATTIVITA } from "@/constants/attivita";
import { HTTP_STATUS } from "@/constants/api";
import { TIMBRATURE_TESTI } from "@/constants/stati";
import { estraiBearerToken } from "@/lib/auth";
import { isRecord } from "@/lib/typeGuards";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { creaGiornataLavorata, GiornataLavorataError } from "@/services/timbrature/creaGiornataLavorata";
import { validaDestinazioneTimbratura } from "@/services/timbrature/validaDestinazioneTimbratura";
import type { TipoAttivita } from "@/types/attivita";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const DATA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_ORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TIPI_ATTIVITA_VALIDI: readonly string[] = Object.values(ATTIVITA).filter(
  (tipo) => tipo !== ATTIVITA.CANTIERE_NUOVO
);

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest): Promise<Response> {
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

    const { data: richiedente } = await supabaseAdmin
      .from("dipendenti")
      .select("id, azienda_id, ruolo")
      .eq("auth_user_id", user.id)
      .eq("attivo", true)
      .maybeSingle();

    if (!richiedente || !(RUOLI_APPROVA_ASSENZE as readonly string[]).includes(richiedente.ruolo)) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
    }

    const body = await request.json().catch(() => null);
    if (
      !isRecord(body) ||
      typeof body.dipendenteId !== "string" ||
      !body.dipendenteId ||
      typeof body.data !== "string" ||
      !DATA_PATTERN.test(body.data) ||
      typeof body.oraIngresso !== "string" ||
      !REGEX_ORARIO.test(body.oraIngresso) ||
      typeof body.oraUscita !== "string" ||
      !REGEX_ORARIO.test(body.oraUscita)
    ) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.GENERICO, HTTP_STATUS.BAD_REQUEST);
    }

    const cantiereId = typeof body.cantiereId === "string" && body.cantiereId ? body.cantiereId : null;
    const attivitaTipo =
      typeof body.attivitaTipo === "string" && TIPI_ATTIVITA_VALIDI.includes(body.attivitaTipo)
        ? (body.attivitaTipo as TipoAttivita)
        : null;

    const validazioneDestinazione = validaDestinazioneTimbratura({ cantiereId, attivitaTipo });
    if (!validazioneDestinazione.valida) {
      return jsonErrore(
        validazioneDestinazione.errore || TIMBRATURE_TESTI.ERRORI.DESTINAZIONE_OBBLIGATORIA,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    if (cantiereId) {
      const { data: cantiere } = await supabaseAdmin
        .from("cantieri")
        .select("azienda_id")
        .eq("id", cantiereId)
        .maybeSingle();

      if (!cantiere || cantiere.azienda_id !== richiedente.azienda_id) {
        return jsonErrore(TIMBRATURE_TESTI.ERRORI.CANTIERE_NON_DISPONIBILE, HTTP_STATUS.BAD_REQUEST);
      }
    }

    const { entrataId, uscitaId } = await creaGiornataLavorata({
      aziendaId: richiedente.azienda_id,
      dipendenteId: body.dipendenteId,
      data: body.data,
      oraIngresso: body.oraIngresso,
      oraUscita: body.oraUscita,
      cantiereId,
      attivitaTipo,
      supabaseClient: supabaseAdmin,
    });

    return Response.json({ ok: true, entrataId, uscitaId }, { headers: NO_STORE });
  } catch (error: unknown) {
    if (error instanceof GiornataLavorataError) {
      return jsonErrore(error.message, HTTP_STATUS.CONFLICT);
    }
    console.error("Errore creazione giornata lavorata", error);
    return jsonErrore(ASSENZE_TESTI.ERRORI.SALVATAGGIO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
