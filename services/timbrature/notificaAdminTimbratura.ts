import { Resend } from "resend";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { inviaPush } from "@/lib/webPush";

const MITTENTE = "Cantivo <notifiche@cantivo.it>";

type Params = {
  dipendenteId: string;
  tipo: "ENTRATA" | "USCITA";
  orario: Date;
};

/**
 * Avvisa gli ADMIN dell'azienda (push + mail di backup) quando un
 * dipendente con `avvisa_admin_timbratura` attivo timbra entrata/uscita.
 * Best-effort: nessun errore qui deve interrompere il flusso di timbratura.
 */
export async function notificaAdminTimbratura({ dipendenteId, tipo, orario }: Params): Promise<void> {
  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("nome, cognome, azienda_id, avvisa_admin_timbratura")
    .eq("id", dipendenteId)
    .maybeSingle();

  if (!dipendente?.avvisa_admin_timbratura) return;

  const { data: admin } = await supabaseAdmin
    .from("dipendenti")
    .select("id, email")
    .eq("azienda_id", dipendente.azienda_id)
    .eq("ruolo", "ADMIN")
    .eq("attivo", true);

  const adminList = admin || [];
  if (adminList.length === 0) return;

  const nomeCompleto = `${dipendente.nome} ${dipendente.cognome}`.trim();
  const etichettaTipo = tipo === "ENTRATA" ? "Entrata" : "Uscita";
  const oraLocale = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
  }).format(orario);

  // ── Push (canale immediato) ──
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
      {
        titolo: `${etichettaTipo} — ${nomeCompleto}`,
        corpo: `${nomeCompleto} ha timbrato ${etichettaTipo.toLowerCase()} alle ${oraLocale}`,
      }
    );
    if (!esito.ok && esito.scaduta) {
      await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
    }
  }

  // ── Mail (backup, in caso la push non arrivi) ──
  const apiKey = process.env.RESEND_API_KEY;
  const destinatari = adminList.map((a) => a.email).filter(Boolean);
  if (apiKey && destinatari.length > 0) {
    try {
      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: MITTENTE,
        to: destinatari,
        subject: `${etichettaTipo} — ${nomeCompleto}`,
        text: `${nomeCompleto} ha timbrato ${etichettaTipo.toLowerCase()} alle ${oraLocale}.`,
      });
    } catch (errore) {
      console.error("Errore mail avviso admin timbratura", errore);
    }
  }
}
