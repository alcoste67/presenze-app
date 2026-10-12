import type { SupabaseClient } from "@supabase/supabase-js";

import { TIPO_CONTEGGIO_ORE } from "@/constants/tipoConteggioOre";
import {
  dataRomaDi,
  dataRomaOggi,
  giornoLavorativoRoma,
  romaLocalToUtc,
} from "@/lib/timezoneRoma";
import { calcolaTurnoApertoENetteOre } from "@/services/timbrature/calcolaOreNetteTurnoAperto";
import type { BloccoGiornoPrecedente } from "@/types/bloccoGiornoPrecedente";

const FINESTRA_GIORNI = 30;

function sottraiGiorni(dataYYYYMMDD: string, giorni: number): string {
  const data = new Date(`${dataYYYYMMDD}T12:00:00Z`);
  data.setUTCDate(data.getUTCDate() - giorni);
  return data.toISOString().slice(0, 10);
}

// Stessa logica di services/timbrature/rilevaGiornateVuote.ts, applicata a
// un solo dipendente: qui serve solo il giorno più vecchio non ancora
// giustificato, per farlo risolvere al dipendente stesso prima di poter
// timbrare di nuovo.
function candidatiLavorativi(oggi: string, dataMinima: string): string[] {
  const candidati: string[] = [];
  for (let i = 1; i <= FINESTRA_GIORNI; i++) {
    const data = sottraiGiorni(oggi, i);
    if (data < dataMinima) break;
    if (giornoLavorativoRoma(new Date(`${data}T12:00:00Z`))) {
      candidati.push(data);
    }
  }
  return candidati.sort();
}

/**
 * Verifica se il dipendente deve risolvere qualcosa prima di poter
 * timbrare di nuovo: un turno ancora aperto da un giorno precedente, o un
 * giorno lavorativo precedente senza nessuna timbratura e senza
 * ferie/permesso che lo copra. Ritorna null se può timbrare normalmente.
 */
export async function verificaBloccoGiorno({
  dipendenteId,
  authUserId,
  createdAt,
  tipoConteggioOre,
  supabaseClient,
}: {
  dipendenteId: string;
  authUserId: string;
  createdAt: string;
  tipoConteggioOre: string;
  supabaseClient: SupabaseClient;
}): Promise<BloccoGiornoPrecedente | null> {
  const { data: eventi } = await supabaseClient
    .from("timbrature")
    .select("id, tipo, created_at")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(40);

  const turno = eventi?.length
    ? calcolaTurnoApertoENetteOre([...eventi].reverse())
    : null;

  if (turno) {
    if (dataRomaDi(turno.apertoDalle) < dataRomaOggi()) {
      return {
        tipo: "TURNO_APERTO",
        apertoDalle: turno.apertoDalle.toISOString(),
        oreNette: turno.oreNette,
      };
    }

    // Turno aperto oggi: è il turno in corso, non blocca nulla.
    return null;
  }

  // Part-time (forfait 4h): nessun calendario di giorni lavorati noto,
  // una giornata vuota per loro non è un'anomalia (stesso criterio di
  // rilevaGiornateVuote).
  if (tipoConteggioOre === TIPO_CONTEGGIO_ORE.GIORNATA_FORFAIT_4H) {
    return null;
  }

  const oggi = dataRomaOggi();
  const dataMinima = dataRomaDi(createdAt);
  const candidati = candidatiLavorativi(oggi, dataMinima);
  if (candidati.length === 0) return null;

  const inizioFinestra = candidati[0];

  const [{ data: timbratureFinestra }, { data: richieste }] = await Promise.all([
    supabaseClient
      .from("timbrature")
      .select("created_at")
      .eq("user_id", authUserId)
      .gte("created_at", romaLocalToUtc(inizioFinestra, "00:00").toISOString())
      .lt("created_at", romaLocalToUtc(oggi, "00:00").toISOString()),
    supabaseClient
      .from("richieste_assenza")
      .select("data_inizio, data_fine")
      .eq("dipendente_id", dipendenteId)
      .in("stato", ["IN_ATTESA", "APPROVATA"])
      .lte("data_inizio", oggi)
      .gte("data_fine", inizioFinestra),
  ]);

  const giorniConTimbratura = new Set(
    (timbratureFinestra || []).map((t) => dataRomaDi(t.created_at as string))
  );

  const richiesteRows = (richieste || []) as { data_inizio: string; data_fine: string }[];
  const giornoCoperto = (data: string) =>
    richiesteRows.some((r) => r.data_inizio <= data && data <= r.data_fine);

  const giornoVuoto = candidati.find(
    (data) => !giorniConTimbratura.has(data) && !giornoCoperto(data)
  );

  if (!giornoVuoto) return null;

  return { tipo: "GIORNATA_VUOTA", data: giornoVuoto };
}
