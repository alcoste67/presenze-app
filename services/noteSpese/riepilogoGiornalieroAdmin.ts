import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

import { LABEL_TIPO_SPESA, NOTE_SPESE_CRON } from "@/constants/noteSpese";
import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { dataRomaOggi } from "@/lib/timezoneRoma";
import { inviaPush } from "@/lib/webPush";

const MITTENTE = "Cantivo <notifiche@cantivo.it>";
const FINESTRA_MINUTI = 15;

export function inFinestraRiepilogoNoteSpese(minutiRoma: number): boolean {
  const soglia = NOTE_SPESE_CRON.SOGLIA_MINUTI_RIEPILOGO;
  return minutiRoma >= soglia && minutiRoma < soglia + FINESTRA_MINUTI;
}

type RigaSpesa = { azienda_id: string; dipendente_id: string; tipo: string; importo: number };
type RigaKm = { azienda_id: string; dipendente_id: string; km: number };

type RiepilogoDipendente = {
  nome: string;
  numeroSpese: number;
  totaleSpese: number;
  km: number;
};

/**
 * Riepilogo giornaliero cumulativo per admin/superadmin: una mail+push
 * per azienda con, per ciascun dipendente che oggi ha registrato almeno
 * una spesa o dei km, il totale della giornata. Aziende senza alcuna
 * registrazione oggi non ricevono nulla. Best-effort, non deve mai
 * interrompere il cron.
 */
export async function inviaRiepilogoGiornalieroNoteSpese(
  supabaseAdmin: SupabaseClient
): Promise<number> {
  const oggi = dataRomaOggi();

  const [{ data: spese, error: erroreSpese }, { data: km, error: erroreKm }] = await Promise.all([
    supabaseAdmin
      .from("note_spese")
      .select("azienda_id, dipendente_id, tipo, importo")
      .eq("data", oggi),
    supabaseAdmin.from("note_chilometri").select("azienda_id, dipendente_id, km").eq("data", oggi),
  ]);

  if (erroreSpese || erroreKm) {
    console.error("Errore caricamento dati per riepilogo note spese", erroreSpese || erroreKm);
    return 0;
  }

  const righeSpese = (spese || []) as RigaSpesa[];
  const righeKm = (km || []) as RigaKm[];

  if (righeSpese.length === 0 && righeKm.length === 0) return 0;

  const aziendeIds = new Set([
    ...righeSpese.map((r) => r.azienda_id),
    ...righeKm.map((r) => r.azienda_id),
  ]);

  let notificheInviate = 0;
  const apiKey = process.env.RESEND_API_KEY;
  const resend = apiKey ? new Resend(apiKey) : null;

  for (const aziendaId of aziendeIds) {
    const dipendenteIds = new Set([
      ...righeSpese.filter((r) => r.azienda_id === aziendaId).map((r) => r.dipendente_id),
      ...righeKm.filter((r) => r.azienda_id === aziendaId).map((r) => r.dipendente_id),
    ]);

    const { data: dipendenti } = await supabaseAdmin
      .from("dipendenti")
      .select("id, nome, cognome")
      .in("id", Array.from(dipendenteIds));

    const nomiById = new Map((dipendenti || []).map((d) => [d.id as string, `${d.nome} ${d.cognome}`.trim()]));

    const riepilogoPerDipendente = new Map<string, RiepilogoDipendente>();
    for (const dipendenteId of dipendenteIds) {
      const speseDipendente = righeSpese.filter(
        (r) => r.azienda_id === aziendaId && r.dipendente_id === dipendenteId
      );
      const kmDipendente = righeKm.find(
        (r) => r.azienda_id === aziendaId && r.dipendente_id === dipendenteId
      );

      riepilogoPerDipendente.set(dipendenteId, {
        nome: nomiById.get(dipendenteId) || "Dipendente",
        numeroSpese: speseDipendente.length,
        totaleSpese: speseDipendente.reduce((tot, s) => tot + s.importo, 0),
        km: kmDipendente?.km ?? 0,
      });
    }

    const righeTesto = Array.from(riepilogoPerDipendente.values()).map((r) => {
      const parti: string[] = [];
      if (r.numeroSpese > 0) {
        parti.push(
          `${r.numeroSpese} ${r.numeroSpese === 1 ? "spesa" : "spese"} (${r.totaleSpese.toFixed(2)} €)`
        );
      }
      if (r.km > 0) {
        parti.push(`${r.km} km`);
      }
      return `- ${r.nome}: ${parti.join(", ")}`;
    });

    const tipiPerLabel = Array.from(new Set(righeSpese.map((r) => r.tipo)))
      .map((tipo) => LABEL_TIPO_SPESA[tipo] || tipo)
      .join(", ");

    const { data: admin } = await supabaseAdmin
      .from("dipendenti")
      .select("id, email")
      .eq("azienda_id", aziendaId)
      .in("ruolo", [RUOLI_DIPENDENTE.ADMIN, RUOLI_DIPENDENTE.SUPERADMIN])
      .eq("attivo", true);

    const adminList = admin || [];
    if (adminList.length === 0) continue;

    const titolo = "Riepilogo giornaliero note spese";
    const corpoPush = `Oggi: ${righeTesto.length} ${righeTesto.length === 1 ? "dipendente" : "dipendenti"} con spese o km registrati.`;

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
        { titolo, corpo: corpoPush }
      );
      if (esito.ok) {
        notificheInviate += 1;
      } else if (esito.scaduta) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }

    if (resend) {
      const destinatari = adminList.map((a) => a.email).filter(Boolean);
      if (destinatari.length > 0) {
        try {
          await resend.emails.send({
            from: MITTENTE,
            to: destinatari,
            subject: titolo,
            text: [
              `Riepilogo di oggi (${oggi})${tipiPerLabel ? ` — tipi di spesa: ${tipiPerLabel}` : ""}:`,
              "",
              ...righeTesto,
              "",
              "Dettaglio e approvazione dal backoffice.",
            ].join("\n"),
          });
        } catch (errore) {
          console.error("Errore mail riepilogo note spese", errore);
        }
      }
    }
  }

  return notificheInviate;
}
