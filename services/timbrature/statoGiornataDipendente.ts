import type { SupabaseClient } from "@supabase/supabase-js";

import { TIMBRATURE } from "@/constants/stati";
import type { StatoLavoratore } from "@/types/timbrature";
import { dataRomaOggi, romaLocalToUtc } from "@/lib/timezoneRoma";
import { calcolaStatoDaUltimaTimbratura } from "@/services/timbrature/calcolaStato";

export type StatoGiornataDipendente = {
  statoAttuale: StatoLavoratore;
  haEntrataOggi: boolean;
  haUscitaOggi: boolean;
};

function getDataSuccessiva(dataYYYYMMDD: string): string {
  const [year, month, day] = dataYYYYMMDD.split("-").map(Number);
  const dataUtc = new Date(Date.UTC(year, month - 1, day));
  dataUtc.setUTCDate(dataUtc.getUTCDate() + 1);
  return dataUtc.toISOString().slice(0, 10);
}

/** Stato attuale (DENTRO/IN_PAUSA/FUORI) + cosa risulta timbrato oggi (ora Italia). */
export async function caricaStatoGiornata(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<StatoGiornataDipendente> {
  // Query separata dalla successiva: lo stato attuale deve riflettere
  // l'ultima timbratura in assoluto (anche di ieri, se oggi non si è
  // ancora timbrato), non solo quelle di oggi.
  const { data: ultima, error: erroreUltima } = await supabaseClient
    .from("timbrature")
    .select("tipo")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (erroreUltima) throw erroreUltima;

  const oggi = dataRomaOggi();
  const inizioOggiUtc = romaLocalToUtc(oggi, "00:00").toISOString();
  const inizioDomaniUtc = romaLocalToUtc(
    getDataSuccessiva(oggi),
    "00:00"
  ).toISOString();

  // Filtrata per data (non "ultime N righe poi filtro"): con molte
  // timbrature in un giorno (es. più cambi cantiere) un limite fisso
  // rischiava di far sparire l'entrata di stamattina dal calcolo.
  const { data: righeOggi, error: erroreOggi } = await supabaseClient
    .from("timbrature")
    .select("tipo")
    .eq("user_id", userId)
    .gte("created_at", inizioOggiUtc)
    .lt("created_at", inizioDomaniUtc);

  if (erroreOggi) throw erroreOggi;

  const timbratureOggi = righeOggi || [];

  return {
    statoAttuale: calcolaStatoDaUltimaTimbratura(ultima?.tipo),
    haEntrataOggi: timbratureOggi.some((t) => t.tipo === TIMBRATURE.ENTRATA),
    haUscitaOggi: timbratureOggi.some((t) => t.tipo === TIMBRATURE.USCITA),
  };
}
