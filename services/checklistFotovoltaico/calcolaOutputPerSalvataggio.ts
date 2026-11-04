import { supabase } from "@/lib/supabase";
import {
  calcolaDimensionamentoFotovoltaico,
  type ModuloPerDimensionamento,
} from "@/services/checklistFotovoltaico/calcolaDimensionamentoFotovoltaico";
import type { ChecklistFotovoltaicoInput } from "@/types/checklistFotovoltaico";

type SupabaseClient = typeof supabase;

type OutputDimensionamento = {
  fabbisogno_totale_kwh: number;
  potenza_consigliata_kwp: number;
  potenza_massima_kwp: number | null;
  numero_moduli_max: number | null;
  batteria_consigliata_kwh: number | null;
};

/**
 * Ricalcola sempre lato servizio i campi di output del dimensionamento
 * al momento del salvataggio (creazione/modifica bozza): non ci si fida
 * di eventuali valori calcolati lato client, si ricalcola da zero dagli
 * input grezzi + dati del modulo selezionato (se presente).
 */
export async function calcolaOutputPerSalvataggio(
  input: ChecklistFotovoltaicoInput,
  supabaseClient: SupabaseClient
): Promise<OutputDimensionamento> {
  let modulo: ModuloPerDimensionamento | null = null;

  if (input.modulo_fotovoltaico_id) {
    const { data } = await supabaseClient
      .from("moduli_fotovoltaici")
      .select("potenza_wp, lunghezza_mm, larghezza_mm")
      .eq("id", input.modulo_fotovoltaico_id)
      .maybeSingle();

    if (data) {
      modulo = data as ModuloPerDimensionamento;
    }
  }

  const risultato = calcolaDimensionamentoFotovoltaico(input, modulo);

  return {
    fabbisogno_totale_kwh: risultato.fabbisogno_totale_kwh,
    potenza_consigliata_kwp: risultato.potenza_consigliata_kwp,
    potenza_massima_kwp: risultato.potenza_massima_kwp,
    numero_moduli_max: risultato.numero_moduli_max,
    batteria_consigliata_kwh: risultato.batteria_consigliata_kwh,
  };
}
