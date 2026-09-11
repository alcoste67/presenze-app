import type { NextRequest } from "next/server";
import { Resend } from "resend";

import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import {
  CHECKLIST_WALLBOX_STATI,
  CHECKLIST_WALLBOX_TESTI,
} from "@/constants/checklistWallbox";
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
import type { ChecklistWallbox } from "@/types/checklistWallbox";

type FormatoChecklistWallbox = "EDISON" | "A2C";

function normalizzaFormato(value: unknown): FormatoChecklistWallbox {
  return value === "A2C" ? "A2C" : "EDISON";
}

async function generaPdfPerFormato(
  checklist: ChecklistWallbox,
  formato: FormatoChecklistWallbox
) {
  return formato === "A2C"
    ? generaPdfChecklistWallboxA2C(checklist)
    : generaPdfChecklistWallboxEdison(checklist);
}

function getNomeFilePerFormato(
  checklist: ChecklistWallbox,
  formato: FormatoChecklistWallbox
) {
  return formato === "A2C"
    ? getNomeFileChecklistWallboxA2C(checklist)
    : getNomeFileChecklistWallboxEdison(checklist);
}

export const runtime = "nodejs";

const BUCKET_CHECKLIST_WALLBOX_PDF = "checklist-wallbox-pdf";
const MITTENTE = "Cantivo <rapporti@cantivo.it>";
const PESO_MAX_ALLEGATO_BYTES = 5 * 1024 * 1024;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE_HEADERS });
}

type DipendenteEmail = {
  email: string;
  ruolo: string;
  auth_user_id: string | null;
};

export async function POST(request: NextRequest) {
  let checklistId = "";

  try {
    const body = (await request.json().catch(() => null)) as {
      checklistWallboxId?: string;
      formato?: string;
    } | null;
    checklistId = body?.checklistWallboxId || "";
    const formato = normalizzaFormato(body?.formato);

    if (!checklistId) {
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.CHECKLIST_NON_TROVATA,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // ── Autenticazione + autorizzazione (admin o responsabile) ──
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

    const { data: mittenteDipendente } = await supabaseAdmin
      .from("dipendenti")
      .select("azienda_id, ruolo, attivo")
      .eq("auth_user_id", user.id)
      .eq("attivo", true)
      .maybeSingle();

    if (!mittenteDipendente) {
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const aziendaId = mittenteDipendente.azienda_id as string;

    // ── Checklist: deve esistere, essere FIRMATA e della stessa azienda ──
    const checklist = await loadChecklistWallbox(checklistId, supabaseAdmin);

    if (!checklist || checklist.azienda_id !== aziendaId) {
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.CHECKLIST_NON_TROVATA,
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (checklist.stato !== CHECKLIST_WALLBOX_STATI.FIRMATO) {
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.INVIO_SOLO_FIRMATA,
        HTTP_STATUS.CONFLICT
      );
    }

    if (!checklist.email_cliente) {
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.EMAIL_CLIENTE_OBBLIGATORIA,
        HTTP_STATUS.CONFLICT
      );
    }

    // ── CC: admin attivi dell'azienda + compilatore ──
    const { data: dipendentiAzienda } = await supabaseAdmin
      .from("dipendenti")
      .select("email, ruolo, auth_user_id")
      .eq("azienda_id", aziendaId)
      .eq("attivo", true);

    const dipendenti = (dipendentiAzienda || []) as DipendenteEmail[];
    const cc = Array.from(
      new Set(
        [
          ...dipendenti
            .filter((d) => ["ADMIN", "SUPERADMIN"].includes(d.ruolo))
            .map((d) => d.email),
          ...dipendenti
            .filter((d) => d.auth_user_id === checklist.created_by)
            .map((d) => d.email),
        ].filter(
          (email) =>
            email &&
            email.toLowerCase() !== checklist.email_cliente.toLowerCase()
        )
      )
    );

    // ── PDF: copia legale per formato, generata una volta e archiviata ──
    const storagePath = `${aziendaId}/${checklistId}-${formato.toLowerCase()}.pdf`;
    let pdfBytes: Uint8Array;

    const { data: pdfEsistente } = await supabaseAdmin.storage
      .from(BUCKET_CHECKLIST_WALLBOX_PDF)
      .download(storagePath);

    if (pdfEsistente) {
      pdfBytes = new Uint8Array(await pdfEsistente.arrayBuffer());
    } else {
      pdfBytes = await generaPdfPerFormato(checklist, formato);

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_CHECKLIST_WALLBOX_PDF)
        .upload(storagePath, Buffer.from(pdfBytes), {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error("Errore archiviazione PDF checklist wallbox", uploadError);
        return jsonErrore(
          CHECKLIST_WALLBOX_TESTI.ERRORI.PDF_GENERICO,
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    }

    if (pdfBytes.byteLength > PESO_MAX_ALLEGATO_BYTES) {
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.PDF_TROPPO_GRANDE,
        HTTP_STATUS.CONFLICT
      );
    }

    // ── Invio Resend ──
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.INVIO_NON_CONFIGURATO,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const resend = new Resend(apiKey);
    const nomeCliente =
      checklist.ragione_sociale.trim() ||
      `${checklist.nome} ${checklist.cognome}`.trim();
    const oggetto = `Checklist installazione wallbox — ${nomeCliente || checklist.comune}`;

    const { data: invio, error: erroreInvio } = await resend.emails.send({
      from: MITTENTE,
      to: [checklist.email_cliente],
      cc,
      subject: oggetto,
      text: [
        `Gentile ${nomeCliente || "cliente"},`,
        "",
        "in allegato la checklist di sopralluogo per l'installazione della wallbox, firmata dal tecnico e dal cliente.",
        "",
        "Email generata automaticamente da Cantivo (cantivo.it).",
      ].join("\n"),
      attachments: [
        {
          filename: getNomeFilePerFormato(checklist, formato),
          content: Buffer.from(pdfBytes),
        },
      ],
    });

    // ── Log invio (sempre, anche in errore) ──
    await supabaseAdmin.from("email_log").insert({
      azienda_id: aziendaId,
      checklist_wallbox_id: checklistId,
      destinatari: [checklist.email_cliente],
      cc,
      oggetto,
      esito: erroreInvio ? "ERRORE" : "INVIATA",
      message_id: invio?.id || null,
      errore: erroreInvio ? erroreInvio.message : null,
    });

    if (erroreInvio) {
      console.error("Errore invio Resend checklist wallbox", erroreInvio);
      return jsonErrore(
        CHECKLIST_WALLBOX_TESTI.ERRORI.INVIO_FALLITO,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    // ── Solo a invio riuscito: stato INVIATO ──
    const { error: erroreStato } = await supabaseAdmin
      .from("checklist_wallbox")
      .update({
        stato: CHECKLIST_WALLBOX_STATI.INVIATO,
        inviato_il: new Date().toISOString(),
      })
      .eq("id", checklistId)
      .eq("stato", CHECKLIST_WALLBOX_STATI.FIRMATO);

    if (erroreStato) {
      console.error("Email inviata ma stato non aggiornato", {
        checklistId,
        erroreStato,
      });
    }

    return Response.json(
      {
        inviata: true,
        destinatario: checklist.email_cliente,
        cc,
        messageId: invio?.id || null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    console.error("Errore invio checklist wallbox", {
      checklistId,
      message: error instanceof Error ? error.message : String(error),
      error,
    });
    return jsonErrore(
      CHECKLIST_WALLBOX_TESTI.ERRORI.INVIO_FALLITO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
