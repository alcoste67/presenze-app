import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { ANOMALIE_TIMBRATURE_TESTI } from "@/constants/anomalieTimbrature";
import { inviaPush } from "@/lib/webPush";

const MITTENTE = "Cantivo <notifiche@cantivo.it>";

type Params = {
  dipendenteId: string;
  aziendaId: string;
  oreNette: number;
  baseUrl: string;
};

async function inviaPushEMailAdipendenti(
  supabaseAdmin: SupabaseClient,
  dipendentiIds: string[],
  titolo: string,
  corpo: string,
  urlPush: string
): Promise<void> {
  if (dipendentiIds.length === 0) return;

  const { data: subscriptions } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("dipendente_id", dipendentiIds);

  for (const subscription of subscriptions || []) {
    const esito = await inviaPush(
      { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
      { titolo, corpo, url: urlPush }
    );
    if (!esito.ok && esito.scaduta) {
      await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
    }
  }
}

/**
 * Notifica ADMIN/SUPERADMIN (push + mail, con link diretto alla pagina di
 * correzione) e il dipendente interessato (push di rinforzo) quando viene
 * rilevata una nuova anomalia di turno aperto da troppe ore. Best-effort:
 * nessun errore qui deve interrompere il cron.
 */
export async function notificaAnomaliaTurnoAperto(
  supabaseAdmin: SupabaseClient,
  { dipendenteId, aziendaId, oreNette, baseUrl }: Params
): Promise<void> {
  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("nome, cognome, auth_user_id")
    .eq("id", dipendenteId)
    .maybeSingle();

  if (!dipendente) return;

  const nomeCompleto = `${dipendente.nome} ${dipendente.cognome}`.trim();
  const oreArrotondate = Math.floor(oreNette);
  const linkCorrezione = `${baseUrl}/backoffice/correggi-timbratura/${dipendenteId}`;

  const { data: admin } = await supabaseAdmin
    .from("dipendenti")
    .select("id, email")
    .eq("azienda_id", aziendaId)
    .in("ruolo", [RUOLI_DIPENDENTE.ADMIN, RUOLI_DIPENDENTE.SUPERADMIN])
    .eq("attivo", true);

  const adminList = admin || [];

  if (adminList.length > 0) {
    await inviaPushEMailAdipendenti(
      supabaseAdmin,
      adminList.map((a) => a.id),
      `Turno aperto da ${oreArrotondate}h — ${nomeCompleto}`,
      `${nomeCompleto} risulta ancora al lavoro da oltre ${oreArrotondate} ore. Verifica e correggi l'uscita se necessario.`,
      `/backoffice/correggi-timbratura/${dipendenteId}`
    );

    const apiKey = process.env.RESEND_API_KEY;
    const destinatari = adminList.map((a) => a.email).filter(Boolean);
    if (apiKey && destinatari.length > 0) {
      try {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: MITTENTE,
          to: destinatari,
          subject: `Turno aperto da ${oreArrotondate}h — ${nomeCompleto}`,
          text: [
            `${nomeCompleto} risulta ancora al lavoro da oltre ${oreArrotondate} ore, senza timbratura di uscita.`,
            "",
            `Verifica e, se serve, correggi l'orario di uscita qui: ${linkCorrezione}`,
          ].join("\n"),
        });
      } catch (errore) {
        console.error("Errore mail avviso anomalia turno aperto", errore);
      }
    }
  }

  // ── Rinforzo al dipendente stesso ──
  if (dipendente.auth_user_id) {
    await inviaPushEMailAdipendenti(
      supabaseAdmin,
      [dipendenteId],
      ANOMALIE_TIMBRATURE_TESTI.PUSH_DIPENDENTE.TITOLO,
      ANOMALIE_TIMBRATURE_TESTI.PUSH_DIPENDENTE.CORPO,
      "/"
    );
  }
}
