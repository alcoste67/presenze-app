import type { SupabaseClient } from "@supabase/supabase-js";

import { ANOMALIE_TIMBRATURE } from "@/constants/anomalieTimbrature";
import { calcolaTurnoApertoENetteOre } from "@/services/timbrature/calcolaOreNetteTurnoAperto";

type Esito = {
  dipendenteId: string;
  azienda_id: string;
  timbraturaAperturaId: string;
  oreNette: number;
} | null;

/**
 * Controlla se il turno ancora aperto di un dipendente ha superato la soglia
 * di ore nette e, se sì, registra l'anomalia (una sola volta per turno:
 * l'unique constraint su timbratura_apertura_id fa da guardia contro tick
 * concorrenti del cron). Ritorna l'esito solo se è una NUOVA anomalia, per
 * evitare di notificare admin/dipendente ripetutamente per lo stesso turno.
 */
export async function rilevaAnomaliaTurnoAperto(
  supabaseAdmin: SupabaseClient,
  dipendenteId: string,
  authUserId: string
): Promise<Esito> {
  const { data: eventi } = await supabaseAdmin
    .from("timbrature")
    .select("id, tipo, created_at")
    .eq("user_id", authUserId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (!eventi || eventi.length === 0) return null;

  const ordinati = [...eventi].reverse();
  const turno = calcolaTurnoApertoENetteOre(ordinati);

  if (!turno || turno.oreNette < ANOMALIE_TIMBRATURE.SOGLIA_ORE_TURNO_APERTO) {
    return null;
  }

  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("azienda_id")
    .eq("id", dipendenteId)
    .maybeSingle();

  if (!dipendente) return null;

  const { error: erroreInsert } = await supabaseAdmin
    .from("timbrature_avvisi_anomalia")
    .insert({
      azienda_id: dipendente.azienda_id,
      dipendente_id: dipendenteId,
      timbratura_apertura_id: turno.timbraturaAperturaId,
      ore_nette_al_momento: turno.oreNette,
    });

  // Se l'insert fallisce (tipicamente per l'unique constraint) l'anomalia è
  // già stata segnalata in un tick precedente: niente da fare.
  if (erroreInsert) return null;

  return {
    dipendenteId,
    azienda_id: dipendente.azienda_id,
    timbraturaAperturaId: turno.timbraturaAperturaId,
    oreNette: turno.oreNette,
  };
}
