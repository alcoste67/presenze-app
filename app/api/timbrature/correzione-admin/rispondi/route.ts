import type { NextRequest } from "next/server";
import { Resend } from "resend";

import { HTTP_STATUS } from "@/constants/api";
import { ANOMALIE_TIMBRATURE_TESTI } from "@/constants/anomalieTimbrature";
import { TIMBRATURE } from "@/constants/stati";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRecord } from "@/lib/typeGuards";
import { inviaPush } from "@/lib/webPush";
import { calcolaTurnoApertoENetteOre } from "@/services/timbrature/calcolaOreNetteTurnoAperto";

export const runtime = "nodejs";

const MITTENTE = "Cantivo <notifiche@cantivo.it>";
const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

async function autenticaDipendente(request: NextRequest) {
  const accessToken = estraiBearerToken(request);
  if (!accessToken) return null;

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !user) return null;

  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("id, nome, cognome, azienda_id, auth_user_id")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  return dipendente;
}

async function notificaProponente(
  propostoDaId: string,
  titolo: string,
  corpo: string
): Promise<void> {
  const { data: admin } = await supabaseAdmin
    .from("dipendenti")
    .select("id, email")
    .eq("id", propostoDaId)
    .maybeSingle();

  if (!admin) return;

  const { data: subscriptions } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("dipendente_id", admin.id);

  for (const subscription of subscriptions || []) {
    const esito = await inviaPush(
      { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
      { titolo, corpo }
    );
    if (!esito.ok && esito.scaduta) {
      await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && admin.email) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({ from: MITTENTE, to: [admin.email], subject: titolo, text: corpo });
    } catch (errore) {
      console.error("Errore mail esito proposta correzione", errore);
    }
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const dipendente = await autenticaDipendente(request);
  if (!dipendente) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.NON_AUTORIZZATO, HTTP_STATUS.UNAUTHORIZED);
  }

  const propostaId = request.nextUrl.searchParams.get("propostaId");
  if (!propostaId) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.PROPOSTA_NON_TROVATA, HTTP_STATUS.BAD_REQUEST);
  }

  const { data: proposta } = await supabaseAdmin
    .from("timbrature_proposte_correzione")
    .select("id, dipendente_id, proposto_da, orario_proposto, stato")
    .eq("id", propostaId)
    .maybeSingle();

  if (!proposta || proposta.dipendente_id !== dipendente.id) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.PROPOSTA_NON_TROVATA, HTTP_STATUS.NOT_FOUND);
  }

  const { data: admin } = await supabaseAdmin
    .from("dipendenti")
    .select("nome, cognome")
    .eq("id", proposta.proposto_da)
    .maybeSingle();

  const { data: eventi } = await supabaseAdmin
    .from("timbrature")
    .select("id, tipo, created_at")
    .eq("user_id", dipendente.auth_user_id)
    .order("created_at", { ascending: false })
    .limit(40);

  const turno = eventi?.length ? calcolaTurnoApertoENetteOre([...eventi].reverse()) : null;

  return Response.json(
    {
      proposta: {
        id: proposta.id,
        stato: proposta.stato,
        orarioProposto: proposta.orario_proposto,
        propostoDaNome: admin ? `${admin.nome} ${admin.cognome}`.trim() : "",
        apertoDalle: turno ? turno.apertoDalle.toISOString() : null,
      },
    },
    { headers: NO_STORE }
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const dipendente = await autenticaDipendente(request);
  if (!dipendente) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.NON_AUTORIZZATO, HTTP_STATUS.UNAUTHORIZED);
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (
    !isRecord(body) ||
    typeof body.propostaId !== "string" ||
    (body.azione !== "CONFERMA" && body.azione !== "RIFIUTA")
  ) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO, HTTP_STATUS.BAD_REQUEST);
  }

  const { data: proposta } = await supabaseAdmin
    .from("timbrature_proposte_correzione")
    .select("id, dipendente_id, azienda_id, proposto_da, avviso_anomalia_id, orario_proposto, stato")
    .eq("id", body.propostaId)
    .maybeSingle();

  if (!proposta || proposta.dipendente_id !== dipendente.id) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.PROPOSTA_NON_TROVATA, HTTP_STATUS.NOT_FOUND);
  }
  if (proposta.stato !== "IN_ATTESA") {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.PAGINA_CONFERMA.GIA_GESTITA, HTTP_STATUS.CONFLICT);
  }

  const nomeCompleto = `${dipendente.nome} ${dipendente.cognome}`.trim();

  if (body.azione === "RIFIUTA") {
    const notaRifiuto = typeof body.notaRifiuto === "string" ? body.notaRifiuto.trim() : "";
    if (!notaRifiuto) {
      return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.NOTA_OBBLIGATORIA_RIFIUTO, HTTP_STATUS.BAD_REQUEST);
    }

    await supabaseAdmin
      .from("timbrature_proposte_correzione")
      .update({ stato: "RIFIUTATA", nota_rifiuto: notaRifiuto, risposto_il: new Date().toISOString() })
      .eq("id", proposta.id);

    await notificaProponente(
      proposta.proposto_da,
      `${nomeCompleto} ha segnalato un problema`,
      `${nomeCompleto} dice che l'orario proposto non è corretto: "${notaRifiuto}". Rivedi manualmente la sua timbratura.`
    );

    return Response.json({ ok: true, esito: "RIFIUTATA" }, { headers: NO_STORE });
  }

  // ── CONFERMA ──
  if (!dipendente.auth_user_id) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  const { data: eventi } = await supabaseAdmin
    .from("timbrature")
    .select("id, tipo, cantiere_id, attivita_tipo, created_at")
    .eq("user_id", dipendente.auth_user_id)
    .order("created_at", { ascending: false })
    .limit(40);

  const turno = eventi?.length ? calcolaTurnoApertoENetteOre([...eventi].reverse()) : null;
  if (!turno) {
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.TURNO_GIA_CHIUSO, HTTP_STATUS.CONFLICT);
  }

  const ultimaTimbratura = eventi?.[0];

  const { data: nuovaTimbratura, error: erroreInsert } = await supabaseAdmin
    .from("timbrature")
    .insert({
      user_id: dipendente.auth_user_id,
      cantiere_id: ultimaTimbratura?.cantiere_id ?? null,
      attivita_tipo: ultimaTimbratura?.attivita_tipo ?? null,
      tipo: TIMBRATURE.USCITA,
      azienda_id: proposta.azienda_id,
      created_at: proposta.orario_proposto,
    })
    .select("id")
    .single();

  if (erroreInsert || !nuovaTimbratura) {
    console.error("Errore inserimento uscita da conferma proposta", erroreInsert);
    return jsonErrore(ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  await supabaseAdmin
    .from("timbrature_proposte_correzione")
    .update({
      stato: "CONFERMATA",
      timbratura_id: nuovaTimbratura.id,
      risposto_il: new Date().toISOString(),
    })
    .eq("id", proposta.id);

  if (proposta.avviso_anomalia_id) {
    await supabaseAdmin
      .from("timbrature_avvisi_anomalia")
      .update({ risolto_il: new Date().toISOString() })
      .eq("id", proposta.avviso_anomalia_id);
  }

  await notificaProponente(
    proposta.proposto_da,
    `${nomeCompleto} ha confermato l'orario`,
    `${nomeCompleto} ha confermato l'orario di uscita proposto. La timbratura è stata registrata.`
  );

  return Response.json({ ok: true, esito: "CONFERMATA" }, { headers: NO_STORE });
}
