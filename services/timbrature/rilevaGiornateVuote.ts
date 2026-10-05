import type { SupabaseClient } from "@supabase/supabase-js";

import { ANOMALIE_TIMBRATURE } from "@/constants/anomalieTimbrature";
import { dataRomaDi, dataRomaOggi, giornoLavorativoRoma, romaLocalToUtc } from "@/lib/timezoneRoma";

const FINESTRA_GIORNI = 30;
const FINESTRA_MINUTI_CRON = 15;

// Stessa cadenza del cron (ogni 15 minuti).
export function inFinestraPromemoriaGiornateVuote(minutiRoma: number): boolean {
  const soglia = ANOMALIE_TIMBRATURE.SOGLIA_MINUTI_PROMEMORIA_GIORNATE_VUOTE;
  return minutiRoma >= soglia && minutiRoma < soglia + FINESTRA_MINUTI_CRON;
}

type DipendenteRiga = {
  id: string;
  azienda_id: string;
  auth_user_id: string;
  created_at: string;
};

function sottraiGiorni(dataYYYYMMDD: string, giorni: number): string {
  const data = new Date(`${dataYYYYMMDD}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() - giorni);
  return data.toISOString().slice(0, 10);
}

function candidatiLavorativi(oggi: string, dataMinima: string): string[] {
  const candidati: string[] = [];
  for (let i = 1; i <= FINESTRA_GIORNI; i++) {
    const data = sottraiGiorni(oggi, i);
    if (data < dataMinima) break;
    if (giornoLavorativoRoma(new Date(`${data}T12:00:00Z`))) {
      candidati.push(data);
    }
  }
  return candidati;
}

export type GiornataVuotaDipendente = {
  dipendenteId: string;
  aziendaId: string;
  giorni: string[];
};

/**
 * Giorni lavorativi recenti (fino a 30) senza nessuna timbratura e senza
 * una richiesta ferie/permesso/altro che li copra, per ogni dipendente
 * attivo. Si accumulano finché non vengono classificati (dall'admin o da
 * una richiesta del dipendente stesso): nessuno sblocco automatico.
 */
export async function trovaGiornateVuoteDaClassificare(
  supabaseAdmin: SupabaseClient
): Promise<GiornataVuotaDipendente[]> {
  const oggi = dataRomaOggi();

  const { data: dipendenti, error } = await supabaseAdmin
    .from("dipendenti")
    .select("id, azienda_id, auth_user_id, created_at")
    .eq("attivo", true)
    .not("auth_user_id", "is", null);

  if (error) {
    console.error("Errore caricamento dipendenti per giornate vuote", error);
    return [];
  }

  const risultato: GiornataVuotaDipendente[] = [];

  for (const dipendente of (dipendenti || []) as DipendenteRiga[]) {
    const dataMinima = dataRomaDi(dipendente.created_at);
    const candidati = candidatiLavorativi(oggi, dataMinima);
    if (candidati.length === 0) continue;

    const inizioFinestra = candidati[candidati.length - 1];

    const [{ data: timbrature }, { data: richieste }] = await Promise.all([
      supabaseAdmin
        .from("timbrature")
        .select("created_at")
        .eq("user_id", dipendente.auth_user_id)
        .gte("created_at", romaLocalToUtc(inizioFinestra, "00:00").toISOString())
        .lt("created_at", romaLocalToUtc(oggi, "00:00").toISOString()),
      supabaseAdmin
        .from("richieste_assenza")
        .select("data_inizio, data_fine")
        .eq("dipendente_id", dipendente.id)
        .in("stato", ["IN_ATTESA", "APPROVATA"])
        .lte("data_inizio", oggi)
        .gte("data_fine", inizioFinestra),
    ]);

    const giorniConTimbratura = new Set(
      (timbrature || []).map((t) => dataRomaDi(t.created_at as string))
    );

    const richiesteRows = (richieste || []) as { data_inizio: string; data_fine: string }[];
    const giorniCoperti = (data: string) =>
      richiesteRows.some((r) => r.data_inizio <= data && data <= r.data_fine);

    const giorniVuoti = candidati.filter(
      (data) => !giorniConTimbratura.has(data) && !giorniCoperti(data)
    );

    if (giorniVuoti.length > 0) {
      risultato.push({
        dipendenteId: dipendente.id,
        aziendaId: dipendente.azienda_id,
        giorni: giorniVuoti.sort(),
      });
    }
  }

  return risultato;
}
