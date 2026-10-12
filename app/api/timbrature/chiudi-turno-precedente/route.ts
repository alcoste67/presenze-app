import type { NextRequest } from "next/server";

import { HTTP_STATUS } from "@/constants/api";
import { BLOCCO_GIORNO_PRECEDENTE_TESTI } from "@/constants/bloccoGiornoPrecedente";
import { TIMBRATURE } from "@/constants/stati";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRecord } from "@/lib/typeGuards";
import { dataRomaDi, dataRomaOggi, romaLocalToUtc } from "@/lib/timezoneRoma";
import { calcolaTurnoApertoENetteOre } from "@/services/timbrature/calcolaOreNetteTurnoAperto";
import { notificaAdminTurnoCorretto } from "@/services/timbrature/notificaAdminTurnoCorretto";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_ORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

export async function POST(request: NextRequest): Promise<Response> {
  const accessToken = estraiBearerToken(request);
  if (!accessToken) {
    return jsonErrore(
      BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.NON_AUTORIZZATO,
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !user) {
    return jsonErrore(
      BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.NON_AUTORIZZATO,
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("id, nome, cognome, azienda_id, auth_user_id")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  if (!dipendente?.auth_user_id) {
    return jsonErrore(
      BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.NON_AUTORIZZATO,
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (
    !isRecord(body) ||
    typeof body.data !== "string" ||
    !REGEX_DATA.test(body.data) ||
    typeof body.ora !== "string" ||
    !REGEX_ORARIO.test(body.ora)
  ) {
    return jsonErrore(
      BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.ORARIO_OBBLIGATORIO,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const { data: eventi } = await supabaseAdmin
    .from("timbrature")
    .select("id, tipo, cantiere_id, attivita_tipo, created_at")
    .eq("user_id", dipendente.auth_user_id)
    .order("created_at", { ascending: false })
    .limit(40);

  const turno = eventi?.length
    ? calcolaTurnoApertoENetteOre([...eventi].reverse())
    : null;

  if (!turno) {
    return jsonErrore(
      BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.TURNO_GIA_CHIUSO,
      HTTP_STATUS.CONFLICT
    );
  }

  if (dataRomaDi(turno.apertoDalle) >= dataRomaOggi()) {
    return jsonErrore(
      BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.TURNO_DI_OGGI,
      HTTP_STATUS.CONFLICT
    );
  }

  const orarioProposto = romaLocalToUtc(body.data, body.ora);
  if (orarioProposto.getTime() > Date.now()) {
    return jsonErrore(
      BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.ORARIO_FUTURO,
      HTTP_STATUS.BAD_REQUEST
    );
  }
  if (orarioProposto.getTime() <= turno.apertoDalle.getTime()) {
    return jsonErrore(
      BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.ORARIO_PRECEDENTE_ENTRATA,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const ultimaTimbratura = eventi?.[0];

  const { data: nuovaTimbratura, error: erroreInsert } = await supabaseAdmin
    .from("timbrature")
    .insert({
      user_id: dipendente.auth_user_id,
      cantiere_id: ultimaTimbratura?.cantiere_id ?? null,
      attivita_tipo: ultimaTimbratura?.attivita_tipo ?? null,
      tipo: TIMBRATURE.USCITA,
      azienda_id: dipendente.azienda_id,
      created_at: orarioProposto.toISOString(),
    })
    .select("id")
    .single();

  if (erroreInsert || !nuovaTimbratura) {
    console.error("Errore chiusura turno precedente", erroreInsert);
    return jsonErrore(
      BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  await supabaseAdmin
    .from("timbrature_avvisi_anomalia")
    .update({ risolto_il: new Date().toISOString() })
    .eq("timbratura_apertura_id", turno.timbraturaAperturaId)
    .is("risolto_il", null);

  // Il dipendente ha chiuso da sé il turno: eventuali proposte admin
  // ancora in attesa per lo stesso turno non servono più.
  await supabaseAdmin
    .from("timbrature_proposte_correzione")
    .update({ stato: "ANNULLATA", risposto_il: new Date().toISOString() })
    .eq("dipendente_id", dipendente.id)
    .eq("stato", "IN_ATTESA");

  await notificaAdminTurnoCorretto({
    dipendenteId: dipendente.id,
    apertoDalle: turno.apertoDalle,
    orarioUscita: orarioProposto,
  });

  return Response.json({ ok: true }, { headers: NO_STORE });
}
