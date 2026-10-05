import type { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";

import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import { CHECKLIST_WALLBOX_TESTI } from "@/constants/checklistWallbox";
import { ORDINI_LAVORO_STATI } from "@/constants/ordiniLavoro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAziendaAutorizzataWallbox } from "@/lib/wallboxAccess";
import { loadChecklistWallbox } from "@/services/checklistWallbox/loadChecklistiWallbox";
import {
  generaPdfChecklistWallboxA2C,
  getNomeFileChecklistWallboxA2C,
} from "@/services/checklistWallbox/pdf/generaPdfChecklistWallboxA2C";
import {
  generaPdfChecklistWallboxEdison,
  getNomeFileChecklistWallboxEdison,
} from "@/services/checklistWallbox/pdf/generaPdfChecklistWallboxEdison";
import { loadOrdineLavoro } from "@/services/ordiniLavoro/loadOrdiniLavoro";
import { generaPdfOrdineLavoroEdison } from "@/services/ordiniLavoro/pdf/generaPdfOrdineLavoroEdison";

export const runtime = "nodejs";

/** Se la checklist (EDISON) ha un ordine di lavoro collegato e firmato,
 * ne appende le pagine al PDF scaricato, così il download resta un
 * unico file (stesso principio dell'allegato email in invia/route.ts). */
async function aggiungiOrdineLavoroCollegato(
  pdfBytes: Uint8Array,
  checklistWallboxId: string,
  aziendaId: string,
  formato: string
) {
  if (formato !== "EDISON") return pdfBytes;

  const { data: ordineRow } = await supabaseAdmin
    .from("ordini_lavoro_edison")
    .select("id")
    .eq("checklist_wallbox_id", checklistWallboxId)
    .eq("azienda_id", aziendaId)
    .in("stato", [ORDINI_LAVORO_STATI.FIRMATO, ORDINI_LAVORO_STATI.INVIATO])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ordineRow?.id) return pdfBytes;

  const ordine = await loadOrdineLavoro(ordineRow.id as string, supabaseAdmin);
  if (!ordine) return pdfBytes;

  const ordinePdfBytes = await generaPdfOrdineLavoroEdison(ordine);

  const docFinale = await PDFDocument.load(pdfBytes);
  const docOrdine = await PDFDocument.load(ordinePdfBytes);
  const pagineOrdine = await docFinale.copyPages(docOrdine, docOrdine.getPageIndices());
  pagineOrdine.forEach((pagina) => docFinale.addPage(pagina));

  return docFinale.save();
}

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

    if (!isAziendaAutorizzataWallbox(dipendente.azienda_id as string)) {
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

    const pdfBytesChecklist =
      formato === "A2C"
        ? await generaPdfChecklistWallboxA2C(checklist)
        : await generaPdfChecklistWallboxEdison(checklist);
    const pdfBytes = await aggiungiOrdineLavoroCollegato(
      pdfBytesChecklist,
      checklistWallboxId,
      dipendente.azienda_id as string,
      formato
    );
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
