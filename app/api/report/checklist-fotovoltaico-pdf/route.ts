import type { NextRequest } from "next/server";

import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import { CHECKLIST_FOTOVOLTAICO_TESTI } from "@/constants/checklistFotovoltaico";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAziendaAutorizzataFotovoltaico } from "@/lib/fotovoltaicoAccess";
import { caricaAziendaBrandingFotovoltaico } from "@/services/checklistFotovoltaico/caricaAziendaBrandingFotovoltaico";
import { loadChecklistFotovoltaico } from "@/services/checklistFotovoltaico/loadChecklistiFotovoltaico";
import {
  generaPdfChecklistFotovoltaico,
  getNomeFileChecklistFotovoltaico,
} from "@/services/checklistFotovoltaico/pdf/generaPdfChecklistFotovoltaico";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonErrore(error: string, status: number) {
  return Response.json({ error }, { status, headers: NO_STORE_HEADERS });
}

export async function GET(request: NextRequest) {
  const checklistFotovoltaicoId = request.nextUrl.searchParams.get("checklistFotovoltaicoId") || "";

  try {
    if (!checklistFotovoltaicoId) {
      return jsonErrore(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.CHECKLIST_NON_TROVATA, HTTP_STATUS.BAD_REQUEST);
    }

    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const { data: dipendente } = await supabaseAdmin
      .from("dipendenti")
      .select("azienda_id, attivo")
      .eq("auth_user_id", user.id)
      .eq("attivo", true)
      .maybeSingle();

    if (!dipendente) {
      return jsonErrore(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
    }

    if (!isAziendaAutorizzataFotovoltaico(dipendente.azienda_id as string)) {
      return jsonErrore(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
    }

    const checklist = await loadChecklistFotovoltaico(checklistFotovoltaicoId, supabaseAdmin);

    if (!checklist || checklist.azienda_id !== dipendente.azienda_id) {
      return jsonErrore(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.CHECKLIST_NON_TROVATA, HTTP_STATUS.NOT_FOUND);
    }

    const azienda = await caricaAziendaBrandingFotovoltaico(dipendente.azienda_id as string, supabaseAdmin);
    const pdfBytes = await generaPdfChecklistFotovoltaico(checklist, azienda);
    const fileName = getNomeFileChecklistFotovoltaico(checklist);
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
    console.error("Errore generazione PDF checklist fotovoltaico", {
      checklistFotovoltaicoId,
      message: error instanceof Error ? error.message : String(error),
      error,
    });

    return jsonErrore(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.PDF_GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
