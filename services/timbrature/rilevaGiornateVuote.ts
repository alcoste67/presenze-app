import type { SupabaseClient } from "@supabase/supabase-js";

import { ANOMALIE_TIMBRATURE } from "@/constants/anomalieTimbrature";
import { TIPO_CONTEGGIO_ORE } from "@/constants/tipoConteggioOre";
import { dataRomaDi, dataRomaOggi, giornoLavorativoRoma, romaLocalToUtc } from "@/lib/timezoneRoma";

const FINESTRA_GIORNI = 30;
const FINESTRA_MINUTI_CRON = 15;

// Stessa cadenza del cron (ogni 15 minuti).
export function inFinestraPromemoriaGiornateVuote(minutiRoma: number): boolean {
  const soglia = ANOMALIE_TIMBRATURE.SOGLIA_MINUTI_PROMEMORIA_GIORNATE_VUOTE;
  return minutiRoma >= soglia && minutiRoma < soglia + FINESTRA_MINUTI_CRON;
}

export type DipendenteRiga = {
  id: string;
  azienda_id: string;
  auth_user_id: string | null;
  created_at: string;
  tipo_conteggio_ore: string;
};

function sottraiGiorni(dataYYYYMMDD: string, giorni: number): string {
  const data = new Date(`${dataYYYYMMDD}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() - giorni);
  return data.toISOString().slice(0, 10);
}

async function aziendaRistrettaSoloWallboxA2C(
  supabaseAdmin: SupabaseClient,
  aziendaId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("aziende")
    .select("solo_checklist_wallbox_a2c")
    .eq("id", aziendaId)
    .maybeSingle();

  return Boolean(data?.solo_checklist_wallbox_a2c);
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
 * una richiesta ferie/permesso/altro/malattia che li copra, per UN
 * dipendente attivo A TEMPO PIENO (REALE o forfait 8h). I part-time
 * (forfait 4h) sono esclusi: non è detto lavorino tutti i giorni feriali,
 * quindi un giorno vuoto per loro non è un'anomalia — non abbiamo un
 * calendario per-dipendente dei giorni effettivamente lavorati per fare
 * di meglio. Si accumulano finché non vengono classificati (dall'admin o
 * da una richiesta del dipendente stesso): nessuno sblocco automatico.
 * Le aziende con solo_checklist_wallbox_a2c=true (es. FUNI) sono escluse:
 * i loro dipendenti non hanno accesso alla timbratura, quindi ogni
 * giorno risulterebbe sempre "vuoto".
 */
export async function trovaGiornateVuoteDipendente(
  supabaseAdmin: SupabaseClient,
  dipendente: DipendenteRiga
): Promise<string[]> {
  if (
    !dipendente.auth_user_id ||
    dipendente.tipo_conteggio_ore === TIPO_CONTEGGIO_ORE.GIORNATA_FORFAIT_4H
  ) {
    return [];
  }

  if (await aziendaRistrettaSoloWallboxA2C(supabaseAdmin, dipendente.azienda_id)) {
    return [];
  }

  const oggi = dataRomaOggi();
  const dataMinima = dataRomaDi(dipendente.created_at);
  const candidati = candidatiLavorativi(oggi, dataMinima);
  if (candidati.length === 0) return [];

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

  return candidati
    .filter((data) => !giorniConTimbratura.has(data) && !giorniCoperti(data))
    .sort();
}

/**
 * Stessa rilevazione, per ogni dipendente attivo dell'intera piattaforma
 * (uso: cron del promemoria giornaliero cumulativo).
 */
export async function trovaGiornateVuoteDaClassificare(
  supabaseAdmin: SupabaseClient
): Promise<GiornataVuotaDipendente[]> {
  const { data: dipendenti, error } = await supabaseAdmin
    .from("dipendenti")
    .select("id, azienda_id, auth_user_id, created_at, tipo_conteggio_ore")
    .eq("attivo", true)
    .not("auth_user_id", "is", null)
    .neq("tipo_conteggio_ore", TIPO_CONTEGGIO_ORE.GIORNATA_FORFAIT_4H);

  if (error) {
    console.error("Errore caricamento dipendenti per giornate vuote", error);
    return [];
  }

  const risultato: GiornataVuotaDipendente[] = [];

  for (const dipendente of (dipendenti || []) as DipendenteRiga[]) {
    const giorniVuoti = await trovaGiornateVuoteDipendente(supabaseAdmin, dipendente);

    if (giorniVuoti.length > 0) {
      risultato.push({
        dipendenteId: dipendente.id,
        aziendaId: dipendente.azienda_id,
        giorni: giorniVuoti,
      });
    }
  }

  return risultato;
}
