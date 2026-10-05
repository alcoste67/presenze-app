import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { inviaPush } from "@/lib/webPush";
import type { GiornataVuotaDipendente } from "@/services/timbrature/rilevaGiornateVuote";

const MITTENTE = "Cantivo <notifiche@cantivo.it>";

function formattaDataIt(dataYYYYMMDD: string): string {
  const [anno, mese, giorno] = dataYYYYMMDD.split("-");
  return `${giorno}/${mese}`;
}

/**
 * Un promemoria al giorno per azienda, cumulativo su tutti i dipendenti
 * con giorni da classificare: push + email ad ADMIN/SUPERADMIN, con link
 * alla pagina di correzione di ciascun dipendente coinvolto.
 */
export async function notificaGiornateVuoteDaClassificare(
  supabaseAdmin: SupabaseClient,
  giornateVuote: GiornataVuotaDipendente[],
  baseUrl: string
): Promise<number> {
  if (giornateVuote.length === 0) return 0;

  const dipendentiIds = giornateVuote.map((g) => g.dipendenteId);
  const { data: dipendenti } = await supabaseAdmin
    .from("dipendenti")
    .select("id, nome, cognome")
    .in("id", dipendentiIds);

  const nomePerDipendente = new Map(
    (dipendenti || []).map((d) => [d.id as string, `${d.nome} ${d.cognome}`.trim()])
  );

  const perAzienda = new Map<string, GiornataVuotaDipendente[]>();
  for (const giornata of giornateVuote) {
    const lista = perAzienda.get(giornata.aziendaId) || [];
    lista.push(giornata);
    perAzienda.set(giornata.aziendaId, lista);
  }

  let notificheInviate = 0;
  const apiKey = process.env.RESEND_API_KEY;
  const resend = apiKey ? new Resend(apiKey) : null;

  for (const [aziendaId, lista] of perAzienda) {
    const { data: admin } = await supabaseAdmin
      .from("dipendenti")
      .select("id, email")
      .eq("azienda_id", aziendaId)
      .in("ruolo", [RUOLI_DIPENDENTE.ADMIN, RUOLI_DIPENDENTE.SUPERADMIN])
      .eq("attivo", true);

    const adminList = admin || [];
    if (adminList.length === 0) continue;

    const righe = lista.map((g) => {
      const nome = nomePerDipendente.get(g.dipendenteId) || "Dipendente";
      const date = g.giorni.map(formattaDataIt).join(", ");
      return `${nome}: ${g.giorni.length} ${g.giorni.length === 1 ? "giorno" : "giorni"} (${date})`;
    });

    const totaleGiorni = lista.reduce((somma, g) => somma + g.giorni.length, 0);
    const titolo =
      lista.length === 1
        ? `${nomePerDipendente.get(lista[0].dipendenteId)}: giorni da classificare`
        : `${lista.length} dipendenti con giorni da classificare`;
    const corpo = `${totaleGiorni} ${totaleGiorni === 1 ? "giornata senza timbrature" : "giornate senza timbrature"}: ${righe.join(" — ")}`;
    const linkPrimario = `/backoffice/correggi-timbratura/${lista[0].dipendenteId}`;

    const adminIds = adminList.map((a) => a.id);
    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("dipendente_id", adminIds);

    for (const subscription of subscriptions || []) {
      const esito = await inviaPush(
        { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
        { titolo, corpo, url: linkPrimario }
      );
      if (esito.ok) {
        notificheInviate += 1;
      } else if (esito.scaduta) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }

    const destinatari = adminList.map((a) => a.email).filter(Boolean);
    if (resend && destinatari.length > 0) {
      try {
        await resend.emails.send({
          from: MITTENTE,
          to: destinatari,
          subject: titolo,
          text: [
            "Questi dipendenti hanno giornate lavorative senza timbrature né ferie/permesso registrati:",
            "",
            ...righe.map((riga, i) => `- ${riga} → ${baseUrl}/backoffice/correggi-timbratura/${lista[i].dipendenteId}`),
          ].join("\n"),
        });
      } catch (errore) {
        console.error("Errore mail giornate vuote da classificare", errore);
      }
    }
  }

  return notificheInviate;
}
