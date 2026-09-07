import type { NextRequest } from "next/server";
import { Resend } from "resend";

import { HTTP_STATUS } from "@/constants/api";
import { CORREZIONI_TIMBRATURE_TESTI } from "@/constants/correzioniTimbrature";
import { TIMBRATURE } from "@/constants/stati";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRecord } from "@/lib/typeGuards";
import { dataRomaOggi, oraRomaAttuale, romaLocalToUtc } from "@/lib/timezoneRoma";
import { calcolaStatoDaUltimaTimbratura } from "@/services/timbrature/calcolaStato";
import { caricaStatoGiornata } from "@/services/timbrature/statoGiornataDipendente";
import { validaSequenzaTimbratura } from "@/services/timbrature/validaSequenzaTimbratura";
import { valutaPromemoria } from "@/services/timbrature/valutaPromemoria";
import { notificaAdminTimbratura } from "@/services/timbrature/notificaAdminTimbratura";

export const runtime = "nodejs";

const MITTENTE = "Cantivo <notifiche@cantivo.it>";
const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

const REGEX_ORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function POST(request: NextRequest) {
  const accessToken = estraiBearerToken(request);
  if (!accessToken) {
    return jsonErrore("Token mancante", HTTP_STATUS.UNAUTHORIZED);
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) {
    return jsonErrore("Token non valido", HTTP_STATUS.UNAUTHORIZED);
  }

  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("id, azienda_id, nome, cognome, email")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  if (!dipendente) {
    return jsonErrore("Dipendente non trovato", HTTP_STATUS.FORBIDDEN);
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (
    !isRecord(body) ||
    (body.tipo !== TIMBRATURE.ENTRATA && body.tipo !== TIMBRATURE.USCITA) ||
    typeof body.orario !== "string" ||
    !REGEX_ORARIO.test(body.orario)
  ) {
    return jsonErrore(CORREZIONI_TIMBRATURE_TESTI.ERRORI.ORARIO_OBBLIGATORIO, HTTP_STATUS.BAD_REQUEST);
  }
  if (body.tipo === TIMBRATURE.ENTRATA && body.cantiereId != null && typeof body.cantiereId !== "string") {
    return jsonErrore(CORREZIONI_TIMBRATURE_TESTI.ERRORI.GENERICO, HTTP_STATUS.BAD_REQUEST);
  }

  const tipo = body.tipo as typeof TIMBRATURE.ENTRATA | typeof TIMBRATURE.USCITA;
  const orario = body.orario;
  const cantiereIdRichiesto = typeof body.cantiereId === "string" ? body.cantiereId : null;
  const attivitaTipoRichiesta = typeof body.attivitaTipo === "string" ? body.attivitaTipo : null;

  // ── La finestra di correzione va rivalutata qui: mai fidarsi del client ──
  const statoGiornata = await caricaStatoGiornata(supabaseAdmin, user.id);
  const promemoriaAttivo = valutaPromemoria(oraRomaAttuale(), statoGiornata);
  if (promemoriaAttivo !== tipo) {
    return jsonErrore(CORREZIONI_TIMBRATURE_TESTI.ERRORI.FUORI_FINESTRA, HTTP_STATUS.CONFLICT);
  }

  const dichiarato = romaLocalToUtc(dataRomaOggi(), orario);
  if (dichiarato.getTime() > Date.now()) {
    return jsonErrore(CORREZIONI_TIMBRATURE_TESTI.ERRORI.ORARIO_FUTURO, HTTP_STATUS.BAD_REQUEST);
  }

  const { data: ultimaTimbraturaVera } = await supabaseAdmin
    .from("timbrature")
    .select("id, tipo, cantiere_id, attivita_tipo, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    ultimaTimbraturaVera &&
    new Date(ultimaTimbraturaVera.created_at).getTime() >= dichiarato.getTime()
  ) {
    return jsonErrore(CORREZIONI_TIMBRATURE_TESTI.ERRORI.ORARIO_PRECEDENTE, HTTP_STATUS.BAD_REQUEST);
  }

  const statoVero = calcolaStatoDaUltimaTimbratura(ultimaTimbraturaVera?.tipo);
  const validazioneSequenza = validaSequenzaTimbratura(statoVero, tipo);
  if (!validazioneSequenza.valida) {
    return jsonErrore(CORREZIONI_TIMBRATURE_TESTI.ERRORI.FUORI_FINESTRA, HTTP_STATUS.CONFLICT);
  }

  const cantiereId = tipo === TIMBRATURE.ENTRATA ? cantiereIdRichiesto : ultimaTimbraturaVera?.cantiere_id ?? null;
  const attivitaTipo =
    tipo === TIMBRATURE.ENTRATA ? attivitaTipoRichiesta : ultimaTimbraturaVera?.attivita_tipo ?? null;

  if (tipo === TIMBRATURE.ENTRATA && !cantiereId && !attivitaTipo) {
    return jsonErrore(CORREZIONI_TIMBRATURE_TESTI.ERRORI.GENERICO, HTTP_STATUS.BAD_REQUEST);
  }

  const { data: nuovaTimbratura, error: erroreInsert } = await supabaseAdmin
    .from("timbrature")
    .insert({
      user_id: user.id,
      cantiere_id: cantiereId,
      attivita_tipo: attivitaTipo,
      tipo,
      azienda_id: dipendente.azienda_id,
      created_at: dichiarato.toISOString(),
    })
    .select("id")
    .single();

  if (erroreInsert || !nuovaTimbratura) {
    console.error("Errore inserimento autocorrezione timbratura", erroreInsert);
    return jsonErrore(CORREZIONI_TIMBRATURE_TESTI.ERRORI.GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  await supabaseAdmin.from("timbrature_autocorrezioni").insert({
    azienda_id: dipendente.azienda_id,
    dipendente_id: dipendente.id,
    timbratura_id: nuovaTimbratura.id,
    tipo,
    orario_dichiarato: dichiarato.toISOString(),
  });

  await notificaAdminTimbratura({ dipendenteId: dipendente.id, tipo, orario: dichiarato });

  // ── Notifica admin: best-effort, non blocca la risposta al dipendente ──
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const { data: admin } = await supabaseAdmin
        .from("dipendenti")
        .select("email")
        .eq("azienda_id", dipendente.azienda_id)
        .in("ruolo", ["ADMIN", "SUPERADMIN"])
        .eq("attivo", true);

      const destinatari = (admin || []).map((a) => a.email).filter(Boolean);
      if (destinatari.length > 0) {
        const resend = new Resend(apiKey);
        const nomeDipendente = `${dipendente.nome} ${dipendente.cognome}`.trim();
        await resend.emails.send({
          from: MITTENTE,
          to: destinatari,
          subject: `Autocorrezione timbratura — ${nomeDipendente}`,
          text: [
            `${nomeDipendente} ha corretto una timbratura mancante.`,
            "",
            `Tipo: ${tipo === TIMBRATURE.ENTRATA ? "Entrata" : "Uscita"}`,
            `Orario dichiarato: ${orario} del ${dataRomaOggi()}`,
            "",
            "Email generata automaticamente da Cantivo (cantivo.it).",
          ].join("\n"),
        });
      }
    } catch (errore) {
      console.error("Errore notifica admin autocorrezione", errore);
    }
  }

  return Response.json({ ok: true }, { headers: NO_STORE });
}
