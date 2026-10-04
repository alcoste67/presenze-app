import type { NextRequest } from "next/server";

import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import { ORDINI_LAVORO_TESTI } from "@/constants/ordiniLavoro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAziendaAutorizzataWallbox } from "@/lib/wallboxAccess";
import { loadOrdineLavoro } from "@/services/ordiniLavoro/loadOrdiniLavoro";
import {
  generaPdfOrdineLavoroEdison,
  getNomeFileOrdineLavoroEdison,
} from "@/services/ordiniLavoro/pdf/generaPdfOrdineLavoroEdison";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonErrore(error: string, status: number) {
  return Response.json({ error }, { status, headers: NO_STORE_HEADERS });
}

export async function GET(request: NextRequest) {
  const ordineLavoroId = request.nextUrl.searchParams.get("ordineLavoroId") || "";

  try {
    if (!ordineLavoroId) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.ORDINE_NON_TROVATO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.SESSIONE_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.SESSIONE_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const { data: dipendente } = await supabaseAdmin
      .from("dipendenti")
      .select("azienda_id, attivo")
      .eq("auth_user_id", user.id)
      .eq("attivo", true)
      .maybeSingle();

    if (!dipendente) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (!isAziendaAutorizzataWallbox(dipendente.azienda_id as string)) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const ordine = await loadOrdineLavoro(ordineLavoroId, supabaseAdmin);

    if (!ordine || ordine.azienda_id !== dipendente.azienda_id) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.ORDINE_NON_TROVATO,
        HTTP_STATUS.NOT_FOUND
      );
    }

    const pdfBytes = await generaPdfOrdineLavoroEdison(ordine);
    const fileName = getNomeFileOrdineLavoroEdison(ordine);
    const pdfBuffer = new ArrayBuffer(pdfBytes.byteLength);
    new Uint8Array(pdfBuffer).set(pdfBytes);

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("Errore generazione PDF ordine di lavoro", {
      ordineLavoroId,
      message: error instanceof Error ? error.message : String(error),
      error,
    });

    return jsonErrore(
      ORDINI_LAVORO_TESTI.ERRORI.PDF_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
