import type { NextRequest } from "next/server";
import { Resend } from "resend";

import { HTTP_STATUS } from "@/constants/api";
import { ANOMALIE_TIMBRATURE_TESTI } from "@/constants/anomalieTimbrature";
import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRecord } from "@/lib/typeGuards";
import { romaLocalToUtc } from "@/lib/timezoneRoma";
import { inviaPush } from "@/lib/webPush";
import { calcolaTurnoApertoENetteOre } from "@/services/timbrature/calcolaOreNetteTurnoAperto";

export const runtime = "nodejs";

const MITTENTE = "Cantivo <notifiche@cantivo.it>";
const NO_STORE = { "Cache-Control": "no-store" } as const;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_ORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

function baseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const host = request.headers.get("host");
  return host ? `https://${host}` : "https://cantivo.it";
}

async function autenticaAdmin(request: NextRequest) {
  const accessToken = estraiBearerToken(request);
  if (!accessToken) return null;

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !user) return null;

  const { data: richiedente } = await supabaseAdmin
    .from("dipendenti")
    .select("id, azienda_id, ruolo")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  if (
    !richiedente ||
    ![RUOLI_DIPENDENTE.ADMIN, RUOLI_DIPENDENTE.SUPERADMIN].includes(
      richiedente.ruolo as typeof RUOLI_DIPENDENTE.ADMIN | typeof RUOLI_DIPENDENTE.SUPERADMIN
    )
  ) {
    return null;
  }

  return richiedente;
}

async function caricaTurnoApertoTarget(dipendenteAuthUserId: string) {
  const { data: eventi } = await supabaseAdmin
    .from("timbrature")
    .select("id, tipo, created_at")
    .eq("user_id", dipendenteAuthUserId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (!eventi || eventi.length === 0) return null;
  return calcolaTurnoApertoENetteOre([...eventi].reverse());
}

export async function GET(request: NextRequest): Promise<Response> {
  const richiedente = await autenticaAdmin(request);
  if (!richiedente) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.NON_AUTORIZZATO, HTTP_STATUS.FORBIDDEN);
  }

  const dipendenteId = request.nextUrl.searchParams.get("dipendenteId");
  if (!dipendenteId) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.DIPENDENTE_NON_TROVATO, HTTP_STATUS.BAD_REQUEST);
  }

  const { data: target } = await supabaseAdmin
    .from("dipendenti")
    .select("id, nome, cognome, azienda_id, auth_user_id")
    .eq("id", dipendenteId)
    .maybeSingle();

  if (!target || target.azienda_id !== richiedente.azienda_id || !target.auth_user_id) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.DIPENDENTE_NON_TROVATO, HTTP_STATUS.NOT_FOUND);
  }

  const turno = await caricaTurnoApertoTarget(target.auth_user_id);
  if (!turno) {
    return Response.json({ turnoAperto: null }, { headers: NO_STORE });
  }

  const { data: proposta } = await supabaseAdmin
    .from("timbrature_proposte_correzione")
    .select("id, orario_proposto, creato_il")
    .eq("dipendente_id", target.id)
    .eq("stato", "IN_ATTESA")
    .maybeSingle();

  return Response.json(
    {
      turnoAperto: {
        dipendenteNome: `${target.nome} ${target.cognome}`.trim(),
        apertoDalle: turno.apertoDalle.toISOString(),
        oreNette: turno.oreNette,
        propostaInAttesa: proposta
          ? {
              id: proposta.id,
              orarioProposto: proposta.orario_proposto,
              creatoIl: proposta.creato_il,
            }
          : null,
      },
    },
    { headers: NO_STORE }
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const richiedente = await autenticaAdmin(request);
  if (!richiedente) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.NON_AUTORIZZATO, HTTP_STATUS.FORBIDDEN);
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (
    !isRecord(body) ||
    typeof body.dipendenteId !== "string" ||
    typeof body.data !== "string" ||
    !REGEX_DATA.test(body.data) ||
    typeof body.ora !== "string" ||
    !REGEX_ORARIO.test(body.ora)
  ) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.DATA_ORARIO_OBBLIGATORI, HTTP_STATUS.BAD_REQUEST);
  }

  const { data: target } = await supabaseAdmin
    .from("dipendenti")
    .select("id, nome, cognome, email, azienda_id, auth_user_id")
    .eq("id", body.dipendenteId)
    .maybeSingle();

  if (!target || target.azienda_id !== richiedente.azienda_id || !target.auth_user_id) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.DIPENDENTE_NON_TROVATO, HTTP_STATUS.NOT_FOUND);
  }

  const orarioProposto = romaLocalToUtc(body.data, body.ora);
  if (orarioProposto.getTime() > Date.now()) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.ORARIO_FUTURO, HTTP_STATUS.BAD_REQUEST);
  }

  const turno = await caricaTurnoApertoTarget(target.auth_user_id);
  if (!turno) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.TURNO_GIA_CHIUSO, HTTP_STATUS.CONFLICT);
  }
  if (orarioProposto.getTime() <= turno.apertoDalle.getTime()) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.ORARIO_PRECEDENTE_ENTRATA, HTTP_STATUS.BAD_REQUEST);
  }

  const { data: propostaEsistente } = await supabaseAdmin
    .from("timbrature_proposte_correzione")
    .select("id")
    .eq("dipendente_id", target.id)
    .eq("stato", "IN_ATTESA")
    .maybeSingle();

  if (propostaEsistente) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.PROPOSTA_GIA_IN_ATTESA, HTTP_STATUS.CONFLICT);
  }

  const { data: anomalia } = await supabaseAdmin
    .from("timbrature_avvisi_anomalia")
    .select("id")
    .eq("timbratura_apertura_id", turno.timbraturaAperturaId)
    .is("risolto_il", null)
    .maybeSingle();

  const { data: proposta, error: erroreInsert } = await supabaseAdmin
    .from("timbrature_proposte_correzione")
    .insert({
      azienda_id: target.azienda_id,
      dipendente_id: target.id,
      proposto_da: richiedente.id,
      avviso_anomalia_id: anomalia?.id ?? null,
      orario_proposto: orarioProposto.toISOString(),
    })
    .select("id")
    .single();

  if (erroreInsert || !proposta) {
    console.error("Errore inserimento proposta correzione", erroreInsert);
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  const linkConferma = `${baseUrl(request)}${"/conferma-correzione"}/${proposta.id}`;
  const nomeCompleto = `${target.nome} ${target.cognome}`.trim();

  const { data: subscriptions } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("dipendente_id", target.id);

  for (const subscription of subscriptions || []) {
    const esito = await inviaPush(
      { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
      {
        titolo: "Conferma orario di uscita",
        corpo: "Il tuo responsabile ha proposto un orario di uscita: confermalo appena puoi",
        url: `/conferma-correzione/${proposta.id}`,
      }
    );
    if (!esito.ok && esito.scaduta) {
      await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && target.email) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: MITTENTE,
        to: [target.email],
        subject: "Conferma il tuo orario di uscita",
        text: [
          `Ciao ${nomeCompleto},`,
          "",
          "Il tuo responsabile ha notato che il tuo turno risulta ancora aperto e ha proposto un orario di uscita.",
          "Apri questo link per confermarlo o segnalare che non è corretto:",
          linkConferma,
          "",
          "Email generata automaticamente da Cantivo (cantivo.it).",
        ].join("\n"),
      });
    } catch (errore) {
      console.error("Errore mail proposta correzione", errore);
    }
  }

  return Response.json({ ok: true, propostaId: proposta.id }, { headers: NO_STORE });
}
