import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ANOMALIE_TIMBRATURE, ANOMALIE_TIMBRATURE_TESTI } from "@/constants/anomalieTimbrature";
import { inviaPush } from "@/lib/webPush";

const MITTENTE = "Cantivo <notifiche@cantivo.it>";
const FINESTRA_MINUTI = 15;

// Stessa cadenza del cron (ogni 15 minuti): la finestra deve combaciare,
// altrimenti il promemoria rischia di non partire mai o di ripetersi.
export function inFinestraPromemoriaProposte(minutiRoma: number): boolean {
  const soglia = ANOMALIE_TIMBRATURE.SOGLIA_MINUTI_PROMEMORIA_PROPOSTE;
  return minutiRoma >= soglia && minutiRoma < soglia + FINESTRA_MINUTI;
}

type PropostaInAttesa = {
  id: string;
  dipendente_id: string;
  creato_il: string;
};

/**
 * Un promemoria al giorno per dipendente, cumulativo su tutte le proposte di
 * correzione turno aperto ancora IN_ATTESA: finché il dipendente non conferma
 * o rifiuta, la giornata non si chiude da sola — qui si fa solo in modo che
 * non se ne dimentichi. Best-effort, non deve mai interrompere il cron.
 */
export async function inviaPromemoriaProposteInAttesa(
  supabaseAdmin: SupabaseClient,
  baseUrl: string
): Promise<number> {
  const { data: proposte, error } = await supabaseAdmin
    .from("timbrature_proposte_correzione")
    .select("id, dipendente_id, creato_il")
    .eq("stato", "IN_ATTESA")
    .order("creato_il", { ascending: true });

  if (error) {
    console.error("Errore caricamento proposte in attesa per promemoria", error);
    return 0;
  }

  const righe = (proposte || []) as PropostaInAttesa[];
  if (righe.length === 0) return 0;

  const propostePerDipendente = new Map<string, PropostaInAttesa[]>();
  for (const riga of righe) {
    const lista = propostePerDipendente.get(riga.dipendente_id) || [];
    lista.push(riga);
    propostePerDipendente.set(riga.dipendente_id, lista);
  }

  const dipendentiIds = [...propostePerDipendente.keys()];
  const { data: dipendenti } = await supabaseAdmin
    .from("dipendenti")
    .select("id, email, auth_user_id, attivo")
    .in("id", dipendentiIds);

  let notificheInviate = 0;
  const apiKey = process.env.RESEND_API_KEY;
  const resend = apiKey ? new Resend(apiKey) : null;

  for (const dipendente of dipendenti || []) {
    if (!dipendente.attivo) continue;

    const proposteDipendente = propostePerDipendente.get(dipendente.id) || [];
    if (proposteDipendente.length === 0) continue;

    const piuVecchia = proposteDipendente[0];
    const linkConferma = `${baseUrl}/conferma-correzione/${piuVecchia.id}`;
    const numero = proposteDipendente.length;

    const testoPromemoria = ANOMALIE_TIMBRATURE_TESTI.PROMEMORIA_PROPOSTE;
    const titolo =
      numero === 1 ? testoPromemoria.TITOLO_SINGOLARE : testoPromemoria.TITOLO_PLURALE;
    const corpo =
      numero === 1
        ? testoPromemoria.CORPO_SINGOLARE
        : `${testoPromemoria.CORPO_PLURALE_PREFIX} ${numero} ${testoPromemoria.CORPO_PLURALE_SUFFIX}`;

    if (dipendente.auth_user_id) {
      const { data: subscriptions } = await supabaseAdmin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("dipendente_id", dipendente.id);

      for (const subscription of subscriptions || []) {
        const esito = await inviaPush(
          { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
          { titolo, corpo, url: `/conferma-correzione/${piuVecchia.id}` }
        );
        if (esito.ok) {
          notificheInviate += 1;
        } else if (esito.scaduta) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    }

    if (resend && dipendente.email) {
      try {
        await resend.emails.send({
          from: MITTENTE,
          to: dipendente.email,
          subject: titolo,
          text: [corpo, "", `Conferma qui: ${linkConferma}`].join("\n"),
        });
      } catch (errore) {
        console.error("Errore mail promemoria proposte correzione", errore);
      }
    }
  }

  return notificheInviate;
}
