import type { SupabaseClient } from "@supabase/supabase-js";

import { TIMBRATURE } from "@/constants/stati";
import type { StatoLavoratore } from "@/types/timbrature";
import { dataRomaDi, dataRomaOggi } from "@/lib/timezoneRoma";
import { calcolaStatoDaUltimaTimbratura } from "@/services/timbrature/calcolaStato";

export type StatoGiornataDipendente = {
  statoAttuale: StatoLavoratore;
  haEntrataOggi: boolean;
  haUscitaOggi: boolean;
};

/** Stato attuale (DENTRO/IN_PAUSA/FUORI) + cosa risulta timbrato oggi (ora Italia). */
export async function caricaStatoGiornata(
  supabaseClient: SupabaseClient,
  userId: string
): Promise<StatoGiornataDipendente> {
  const { data, error } = await supabaseClient
    .from("timbrature")
    .select("tipo, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  const righe = data || [];
  const oggi = dataRomaOggi();
  const timbratureOggi = righe.filter((t) => dataRomaDi(t.created_at) === oggi);

  return {
    statoAttuale: calcolaStatoDaUltimaTimbratura(righe[0]?.tipo),
    haEntrataOggi: timbratureOggi.some((t) => t.tipo === TIMBRATURE.ENTRATA),
    haUscitaOggi: timbratureOggi.some((t) => t.tipo === TIMBRATURE.USCITA),
  };
}
