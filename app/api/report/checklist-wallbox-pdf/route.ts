import type { NextRequest } from "next/server";

import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import { CHECKLIST_WALLBOX_TESTI } from "@/constants/checklistWallbox";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadChecklistWallbox } from "@/services/checklistWallbox/loadChecklistiWallbox";
import {
  generaPdfChecklistWallboxA2C,
  getNomeFileChecklistWallboxA2C,
} from "@/services/checklistWallbox/pdf/generaPdfChecklistWallboxA2C";
import {
  generaPdfChecklistWallboxEdison,
  getNomeFileChecklistWallboxEdison,
} from "@/services/checklistWallbox/pdf/generaPdfChecklistWallboxEdison";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonErrore(error: string, status: number) {
  return Response.json({ error }, { status, headers: NO_STORE_HEADERS });
}

export async function GET(request: NextRequest) {
  const checklistWallboxId =
    request.nextUrl.searchParams.get("checklistWallboxId") || "";
  const formato =
    request.nextUrl.searchParams.get("formato") === "A2C" ? "A2C" : "EDISON";

  try {
    if (!checklistWallboxId) {
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.CHECKLIST_NON_TROVATA,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.TOKEN_NON_VALIDO,
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
        CHECKLIST_WALLBOX_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const checklist = await loadChecklistWallbox(
      checklistWallboxId,
      supabaseAdmin
    );

    if (!checklist || checklist.azienda_id !== dipendente.azienda_id) {
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.CHECKLIST_NON_TROVATA,
        HTTP_STATUS.NOT_FOUND
      );
    }

    const pdfBytes =
      formato === "A2C"
        ? await generaPdfChecklistWallboxA2C(checklist)
        : await generaPdfChecklistWallboxEdison(checklist);
    const fileName =
      formato === "A2C"
        ? getNomeFileChecklistWallboxA2C(checklist)
        : getNomeFileChecklistWallboxEdison(checklist);
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
    console.error("Errore generazione PDF checklist wallbox", {
      checklistWallboxId,
      message: error instanceof Error ? error.message : String(error),
      error,
    });

    return jsonErrore(
      CHECKLIST_WALLBOX_TESTI.ERRORI.PDF_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
