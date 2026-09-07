import type { NextRequest } from "next/server";

import { HTTP_STATUS } from "@/constants/api";
import { CORREZIONI_TIMBRATURE_TESTI } from "@/constants/correzioniTimbrature";
import { inviaPush } from "@/lib/webPush";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { giornoFerialeRoma, minutiRomaAttuali } from "@/lib/timezoneRoma";
import { caricaStatoGiornata } from "@/services/timbrature/statoGiornataDipendente";
import { valutaPromemoriaPush, type TipoPromemoriaPush } from "@/services/timbrature/valutaPromemoriaPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

const TESTI_PER_TIPO: Record<TipoPromemoriaPush, { titolo: string; corpo: string }> = {
  ENTRATA: {
    titolo: CORREZIONI_TIMBRATURE_TESTI.PUSH.ENTRATA_TITOLO,
    corpo: CORREZIONI_TIMBRATURE_TESTI.PUSH.ENTRATA_CORPO,
  },
  PAUSA: {
    titolo: CORREZIONI_TIMBRATURE_TESTI.PUSH.PAUSA_TITOLO,
    corpo: CORREZIONI_TIMBRATURE_TESTI.PUSH.PAUSA_CORPO,
  },
  RIENTRO: {
    titolo: CORREZIONI_TIMBRATURE_TESTI.PUSH.RIENTRO_TITOLO,
    corpo: CORREZIONI_TIMBRATURE_TESTI.PUSH.RIENTRO_CORPO,
  },
  USCITA: {
    titolo: CORREZIONI_TIMBRATURE_TESTI.PUSH.USCITA_TITOLO,
    corpo: CORREZIONI_TIMBRATURE_TESTI.PUSH.USCITA_CORPO,
  },
};

// Chiamata da GitHub Actions ogni 15 minuti nella fascia utile: la route
// stessa decide, in base all'orario reale in Italia, se è il momento di
// mandare qualcosa — così l'ora legale/solare non serve gestirla nel cron.
export async function GET(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return jsonErrore("Non autorizzato", HTTP_STATUS.UNAUTHORIZED);
  }

  if (!giornoFerialeRoma()) {
    return Response.json({ ok: true, esito: "weekend" }, { headers: NO_STORE });
  }

  const minutiRoma = minutiRomaAttuali();

  const { data: dipendenti, error: erroreDipendenti } = await supabaseAdmin
    .from("dipendenti")
    .select("id, auth_user_id")
    .eq("attivo", true)
    .not("auth_user_id", "is", null);

  if (erroreDipendenti) {
    console.error("Errore caricamento dipendenti per promemoria", erroreDipendenti);
    return jsonErrore("Errore caricamento dipendenti", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  let notificheInviate = 0;
  let subscriptionScadute = 0;

  for (const dipendente of dipendenti || []) {
    if (!dipendente.auth_user_id) continue;

    const stato = await caricaStatoGiornata(supabaseAdmin, dipendente.auth_user_id);
    const promemoria = valutaPromemoriaPush(minutiRoma, stato);
    if (!promemoria) continue;

    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("dipendente_id", dipendente.id);

    const testo = TESTI_PER_TIPO[promemoria];

    for (const subscription of subscriptions || []) {
      const esito = await inviaPush(
        { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
        { titolo: testo.titolo, corpo: testo.corpo, url: "/" }
      );

      if (esito.ok) {
        notificheInviate += 1;
      } else if (esito.scaduta) {
        subscriptionScadute += 1;
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }
  }

  return Response.json(
    { ok: true, minutiRoma, notificheInviate, subscriptionScadute },
    { headers: NO_STORE }
  );
}
