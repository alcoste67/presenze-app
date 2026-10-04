import type { NextRequest } from "next/server";
import { Resend } from "resend";

import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import { ORDINI_LAVORO_STATI, ORDINI_LAVORO_TESTI } from "@/constants/ordiniLavoro";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAziendaAutorizzataWallbox } from "@/lib/wallboxAccess";
import { loadOrdineLavoro } from "@/services/ordiniLavoro/loadOrdiniLavoro";
import {
  generaPdfOrdineLavoroEdison,
  getNomeFileOrdineLavoroEdison,
} from "@/services/ordiniLavoro/pdf/generaPdfOrdineLavoroEdison";

export const runtime = "nodejs";

const BUCKET_ORDINI_LAVORO_PDF = "ordini-lavoro-edison-pdf";
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
  let ordineLavoroId = "";

  try {
    const body = (await request.json().catch(() => null)) as {
      ordineLavoroId?: string;
    } | null;
    ordineLavoroId = body?.ordineLavoroId || "";

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

    const { data: mittenteDipendente } = await supabaseAdmin
      .from("dipendenti")
      .select("azienda_id, ruolo, attivo")
      .eq("auth_user_id", user.id)
      .eq("attivo", true)
      .maybeSingle();

    if (!mittenteDipendente) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const aziendaId = mittenteDipendente.azienda_id as string;

    if (!isAziendaAutorizzataWallbox(aziendaId)) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const ordine = await loadOrdineLavoro(ordineLavoroId, supabaseAdmin);

    if (!ordine || ordine.azienda_id !== aziendaId) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.ORDINE_NON_TROVATO,
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (ordine.stato !== ORDINI_LAVORO_STATI.FIRMATO) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.INVIO_SOLO_FIRMATO,
        HTTP_STATUS.CONFLICT
      );
    }

    if (!ordine.cliente_email) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.NOME_CLIENTE_OBBLIGATORIO,
        HTTP_STATUS.CONFLICT
      );
    }

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
            .filter((d) => d.auth_user_id === ordine.created_by)
            .map((d) => d.email),
        ].filter(
          (email) =>
            email && email.toLowerCase() !== ordine.cliente_email.toLowerCase()
        )
      )
    );

    const storagePath = `${aziendaId}/${ordineLavoroId}.pdf`;
    let pdfBytes: Uint8Array;

    const { data: pdfEsistente } = await supabaseAdmin.storage
      .from(BUCKET_ORDINI_LAVORO_PDF)
      .download(storagePath);

    if (pdfEsistente) {
      pdfBytes = new Uint8Array(await pdfEsistente.arrayBuffer());
    } else {
      pdfBytes = await generaPdfOrdineLavoroEdison(ordine);

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_ORDINI_LAVORO_PDF)
        .upload(storagePath, Buffer.from(pdfBytes), {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error("Errore archiviazione PDF ordine di lavoro", uploadError);
        return jsonErrore(
          ORDINI_LAVORO_TESTI.ERRORI.PDF_GENERICO,
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    }

    if (pdfBytes.byteLength > PESO_MAX_ALLEGATO_BYTES) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.PDF_TROPPO_GRANDE,
        HTTP_STATUS.CONFLICT
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.INVIO_NON_CONFIGURATO,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const resend = new Resend(apiKey);
    const nomeCliente = ordine.cliente_nome_cognome;
    const oggetto = `Ordine di lavoro — ${nomeCliente || ordine.cliente_comune}`;

    const { data: invio, error: erroreInvio } = await resend.emails.send({
      from: MITTENTE,
      to: [ordine.cliente_email],
      cc,
      subject: oggetto,
      text: [
        `Gentile ${nomeCliente || "cliente"},`,
        "",
        "in allegato l'ordine di lavoro relativo all'intervento eseguito, firmato dal tecnico e dal cliente.",
        "",
        "Email generata automaticamente da Cantivo (cantivo.it).",
      ].join("\n"),
      attachments: [
        {
          filename: getNomeFileOrdineLavoroEdison(ordine),
          content: Buffer.from(pdfBytes),
        },
      ],
    });

    await supabaseAdmin.from("email_log").insert({
      azienda_id: aziendaId,
      ordine_lavoro_edison_id: ordineLavoroId,
      destinatari: [ordine.cliente_email],
      cc,
      oggetto,
      esito: erroreInvio ? "ERRORE" : "INVIATA",
      message_id: invio?.id || null,
      errore: erroreInvio ? erroreInvio.message : null,
    });

    if (erroreInvio) {
      console.error("Errore invio Resend ordine di lavoro", erroreInvio);
      return jsonErrore(
        ORDINI_LAVORO_TESTI.ERRORI.INVIO_FALLITO,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const { error: erroreStato } = await supabaseAdmin
      .from("ordini_lavoro_edison")
      .update({
        stato: ORDINI_LAVORO_STATI.INVIATO,
        inviato_il: new Date().toISOString(),
      })
      .eq("id", ordineLavoroId)
      .eq("stato", ORDINI_LAVORO_STATI.FIRMATO);

    if (erroreStato) {
      console.error("Email inviata ma stato non aggiornato", {
        ordineLavoroId,
        erroreStato,
      });
    }

    return Response.json(
      {
        inviata: true,
        destinatario: ordine.cliente_email,
        cc,
        messageId: invio?.id || null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    console.error("Errore invio ordine di lavoro", {
      ordineLavoroId,
      message: error instanceof Error ? error.message : String(error),
      error,
    });
    return jsonErrore(
      ORDINI_LAVORO_TESTI.ERRORI.INVIO_FALLITO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
