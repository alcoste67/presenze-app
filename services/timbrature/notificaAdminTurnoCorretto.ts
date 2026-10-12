import { Resend } from "resend";

import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { inviaPush } from "@/lib/webPush";

const MITTENTE = "Cantivo <notifiche@cantivo.it>";

type Params = {
  dipendenteId: string;
  apertoDalle: Date;
  orarioUscita: Date;
};

function formattaDataOra(data: Date): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

/**
 * Avvisa tutti gli ADMIN dell'azienda (push + mail) ogni volta che un
 * turno aperto viene corretto — confermato dal dipendente, chiuso da
 * solo, o riaperto/corretto in altro modo. A differenza di
 * notificaAdminTimbratura, non è un'anomalia il cui avviso dipende
 * dall'interruttore per-dipendente "avvisa_admin_timbratura": qui si
 * tratta sempre di una correzione, quindi l'avviso è sempre attivo.
 * Best-effort: nessun errore qui deve interrompere il flusso chiamante.
 */
export async function notificaAdminTurnoCorretto({
  dipendenteId,
  apertoDalle,
  orarioUscita,
}: Params): Promise<void> {
  try {
    const { data: dipendente } = await supabaseAdmin
      .from("dipendenti")
      .select("nome, cognome, azienda_id")
      .eq("id", dipendenteId)
      .maybeSingle();

    if (!dipendente) return;

    const { data: admin } = await supabaseAdmin
      .from("dipendenti")
      .select("id, email")
      .eq("azienda_id", dipendente.azienda_id)
      .in("ruolo", [RUOLI_DIPENDENTE.ADMIN, RUOLI_DIPENDENTE.SUPERADMIN])
      .eq("attivo", true);

    const adminList = admin || [];
    if (adminList.length === 0) return;

    const nomeCompleto = `${dipendente.nome} ${dipendente.cognome}`.trim();
    const titolo = `Turno corretto — ${nomeCompleto}`;
    const corpo = `${nomeCompleto}: turno apertosi il ${formattaDataOra(apertoDalle)} chiuso con uscita alle ${formattaDataOra(orarioUscita)}.`;

    const { data: subscriptions } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in(
        "dipendente_id",
        adminList.map((a) => a.id)
      );

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
    const destinatari = adminList.map((a) => a.email).filter(Boolean);
    if (apiKey && destinatari.length > 0) {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: MITTENTE,
        to: destinatari,
        subject: titolo,
        text: corpo,
      });
    }
  } catch (errore) {
    console.error("Errore notifica admin turno corretto", errore);
  }
}
