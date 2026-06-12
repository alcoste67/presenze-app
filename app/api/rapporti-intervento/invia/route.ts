import type { NextRequest } from "next/server";
import { Resend } from "resend";

import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import {
  RAPPORTI_INTERVENTO_STATI,
  RAPPORTI_INTERVENTO_TESTI,
} from "@/constants/rapportiIntervento";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadRapportoIntervento } from "@/services/rapportiIntervento/loadRapportoIntervento";
import {
  generaRapportoInterventoPdf,
  getNomeFile,
} from "@/services/rapportiIntervento/pdf/generaPdfRapporto";

export const runtime = "nodejs";

const BUCKET_RAPPORTI_PDF = "rapporti-pdf";
const MITTENTE = "Cantivo <rapporti@cantivo.it>";
const PESO_MAX_ALLEGATO_BYTES = 5 * 1024 * 1024;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE_HEADERS });
}

function formattaData(data: string) {
  return new Intl.DateTimeFormat("it-IT").format(
    new Date(`${data}T00:00:00`)
  );
}

type DipendenteEmail = {
  email: string;
  ruolo: string;
  auth_user_id: string | null;
};

export async function POST(request: NextRequest) {
  let rapportoId = "";

  try {
    const body = (await request.json().catch(() => null)) as {
      rapportoInterventoId?: string;
    } | null;
    rapportoId = body?.rapportoInterventoId || "";

    if (!rapportoId) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.RAPPORTO_NON_TROVATO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // ── Autenticazione + autorizzazione (admin o responsabile) ──
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.TOKEN_NON_VALIDO,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const { data: mittenteDipendente } = await supabaseAdmin
      .from("dipendenti")
      .select("azienda_id, ruolo, attivo")
      .eq("auth_user_id", user.id)
      .eq("attivo", true)
      .maybeSingle();

    const ruoliAbilitati = ["ADMIN", "SUPERADMIN", "RESPONSABILE"];
    if (
      !mittenteDipendente ||
      !ruoliAbilitati.includes(mittenteDipendente.ruolo)
    ) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const aziendaId = mittenteDipendente.azienda_id as string;

    // ── Rapporto: deve esistere, essere FIRMATO e della stessa azienda ──
    const { data: rapportoRiga } = await supabaseAdmin
      .from("rapporti_intervento")
      .select("id, azienda_id, stato, cliente_id, created_by")
      .eq("id", rapportoId)
      .maybeSingle();

    if (!rapportoRiga || rapportoRiga.azienda_id !== aziendaId) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.RAPPORTO_NON_TROVATO,
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (rapportoRiga.stato !== RAPPORTI_INTERVENTO_STATI.FIRMATO) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.INVIO_SOLO_FIRMATO,
        HTTP_STATUS.CONFLICT
      );
    }

    // ── Email cliente dall'anagrafica ──
    if (!rapportoRiga.cliente_id) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.CLIENTE_SENZA_EMAIL,
        HTTP_STATUS.CONFLICT
      );
    }

    const { data: cliente } = await supabaseAdmin
      .from("clienti")
      .select("ragione_sociale, email")
      .eq("id", rapportoRiga.cliente_id)
      .maybeSingle();

    if (!cliente?.email) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.CLIENTE_SENZA_EMAIL,
        HTTP_STATUS.CONFLICT
      );
    }

    // ── CC: admin attivi dell'azienda + compilatore del rapporto ──
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
            .filter((d) => d.auth_user_id === rapportoRiga.created_by)
            .map((d) => d.email),
        ].filter(
          (email) => email && email.toLowerCase() !== cliente.email?.toLowerCase()
        )
      )
    );

    // ── PDF: copia legale, generata una volta e archiviata ──
    const storagePath = `${aziendaId}/${rapportoId}.pdf`;
    let pdfBytes: Uint8Array;

    const { data: pdfEsistente } = await supabaseAdmin.storage
      .from(BUCKET_RAPPORTI_PDF)
      .download(storagePath);

    const rapporto = await loadRapportoIntervento(rapportoId, supabaseAdmin);
    if (!rapporto) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.RAPPORTO_NON_TROVATO,
        HTTP_STATUS.NOT_FOUND
      );
    }

    if (pdfEsistente) {
      pdfBytes = new Uint8Array(await pdfEsistente.arrayBuffer());
    } else {
      pdfBytes = await generaRapportoInterventoPdf(rapporto, {
        mostraFatturazione: false,
      });

      const { error: uploadError } = await supabaseAdmin.storage
        .from(BUCKET_RAPPORTI_PDF)
        .upload(storagePath, Buffer.from(pdfBytes), {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error("Errore archiviazione PDF rapporto", uploadError);
        return jsonErrore(
          RAPPORTI_INTERVENTO_TESTI.ERRORI.PDF_GENERICO,
          HTTP_STATUS.INTERNAL_SERVER_ERROR
        );
      }
    }

    if (pdfBytes.byteLength > PESO_MAX_ALLEGATO_BYTES) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.PDF_TROPPO_GRANDE,
        HTTP_STATUS.CONFLICT
      );
    }

    // ── Invio Resend ──
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.INVIO_NON_CONFIGURATO,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const resend = new Resend(apiKey);
    const oggetto = `Rapporto di lavoro — ${rapporto.cantiere_nome_snapshot} — ${formattaData(rapporto.data_intervento)}`;

    const { data: invio, error: erroreInvio } = await resend.emails.send({
      from: MITTENTE,
      to: [cliente.email],
      cc,
      subject: oggetto,
      text: [
        `Gentile ${cliente.ragione_sociale},`,
        "",
        `in allegato il rapporto di lavoro del ${formattaData(rapporto.data_intervento)} per il cantiere ${rapporto.cantiere_nome_snapshot}, firmato dal responsabile e dal cliente.`,
        "",
        "Email generata automaticamente da Cantivo (cantivo.it).",
      ].join("\n"),
      attachments: [
        {
          filename: getNomeFile(rapporto),
          content: Buffer.from(pdfBytes),
        },
      ],
    });

    // ── Log invio (sempre, anche in errore) ──
    await supabaseAdmin.from("email_log").insert({
      azienda_id: aziendaId,
      rapporto_intervento_id: rapportoId,
      destinatari: [cliente.email],
      cc,
      oggetto,
      esito: erroreInvio ? "ERRORE" : "INVIATA",
      message_id: invio?.id || null,
      errore: erroreInvio ? erroreInvio.message : null,
    });

    if (erroreInvio) {
      console.error("Errore invio Resend", erroreInvio);
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.INVIO_FALLITO,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    // ── Solo a invio riuscito: stato INVIATO ──
    const { error: erroreStato } = await supabaseAdmin
      .from("rapporti_intervento")
      .update({
        stato: RAPPORTI_INTERVENTO_STATI.INVIATO,
        inviato_il: new Date().toISOString(),
      })
      .eq("id", rapportoId)
      .eq("stato", RAPPORTI_INTERVENTO_STATI.FIRMATO);

    if (erroreStato) {
      // Email partita ma stato non aggiornato: logga in evidenza
      console.error("Email inviata ma stato non aggiornato", {
        rapportoId,
        erroreStato,
      });
    }

    return Response.json(
      {
        inviata: true,
        destinatario: cliente.email,
        cc,
        messageId: invio?.id || null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error: unknown) {
    console.error("Errore invio rapporto", {
      rapportoId,
      message: error instanceof Error ? error.message : String(error),
      error,
    });
    return jsonErrore(
      RAPPORTI_INTERVENTO_TESTI.ERRORI.INVIO_FALLITO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
