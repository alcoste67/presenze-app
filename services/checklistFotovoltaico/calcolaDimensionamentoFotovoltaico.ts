// Logica di dimensionamento confermata con Alex (Fase 3):
//
//   fabbisogno_totale = F1 + F2 + F3 (annuo)
//                      + pompa di calore (se selezionata)
//                      + auto elettrica (se selezionata)
//                      + induzione (se selezionata)
//                      + altro (se selezionato)
//   potenza_consigliata_kWp = fabbisogno_totale / resa_kwh_per_kwp
//
//   area_utile_mq = superficie_falda_mq × fattore_occupazione_falda
//   numero_moduli_max = floor(area_utile_mq / area_modulo_mq)
//   potenza_massima_kWp = numero_moduli_max × potenza_modulo_Wp / 1000
//
//   consumo_f3_giornaliero_medio = F3_annuo / 365
//   batteria_grezza_kWh = consumo_f3_giornaliero_medio × margine_batteria
//   batteria_consigliata_kWh = taglio commerciale più vicino per eccesso
//
// Tutte le costanti (resa, fattore di occupazione, margine batteria,
// consumi di default dei nuovi carichi) sono editabili in UI: qui non ci
// sono valori hardcoded, solo quelli passati dal record/form.

export const TAGLI_BATTERIA_KWH = [2.5, 5, 7.5, 10, 15, 20, 25] as const;

export function arrotondaTaglioBatteria(valoreKwh: number): number {
  if (valoreKwh <= 0) return 0;
  const taglio = TAGLI_BATTERIA_KWH.find((t) => t >= valoreKwh);
  if (taglio !== undefined) return taglio;
  return Math.ceil(valoreKwh / 5) * 5;
}

export type InputDimensionamento = {
  consumo_f1_kwh: number | null;
  consumo_f2_kwh: number | null;
  consumo_f3_kwh: number | null;
  pompa_calore_attiva: boolean;
  pompa_calore_kwh_anno: number;
  auto_elettrica_attiva: boolean;
  auto_elettrica_kwh_anno: number;
  induzione_attiva: boolean;
  induzione_kwh_anno: number;
  altro_attivo: boolean;
  altro_kwh_anno: number;
  resa_kwh_per_kwp: number;
  superficie_falda_mq: number | null;
  fattore_occupazione_falda: number;
  margine_batteria: number;
};

export type ModuloPerDimensionamento = {
  potenza_wp: number;
  lunghezza_mm: number;
  larghezza_mm: number;
};

export type RisultatoDimensionamento = {
  fabbisogno_totale_kwh: number;
  potenza_consigliata_kwp: number;
  area_utile_mq: number | null;
  potenza_massima_kwp: number | null;
  numero_moduli_max: number | null;
  batteria_consigliata_kwh: number | null;
};

export function areaModuloMq(modulo: ModuloPerDimensionamento): number {
  return (modulo.lunghezza_mm * modulo.larghezza_mm) / 1_000_000;
}

export function calcolaDimensionamentoFotovoltaico(
  input: InputDimensionamento,
  modulo: ModuloPerDimensionamento | null
): RisultatoDimensionamento {
  const fabbisognoBase =
    (input.consumo_f1_kwh ?? 0) + (input.consumo_f2_kwh ?? 0) + (input.consumo_f3_kwh ?? 0);
  const fabbisognoExtra =
    (input.pompa_calore_attiva ? input.pompa_calore_kwh_anno : 0) +
    (input.auto_elettrica_attiva ? input.auto_elettrica_kwh_anno : 0) +
    (input.induzione_attiva ? input.induzione_kwh_anno : 0) +
    (input.altro_attivo ? input.altro_kwh_anno : 0);
  const fabbisogno_totale_kwh = fabbisognoBase + fabbisognoExtra;

  const resa = input.resa_kwh_per_kwp > 0 ? input.resa_kwh_per_kwp : 1;
  const potenza_consigliata_kwp = fabbisogno_totale_kwh / resa;

  let area_utile_mq: number | null = null;
  let potenza_massima_kwp: number | null = null;
  let numero_moduli_max: number | null = null;

  if (input.superficie_falda_mq !== null && input.superficie_falda_mq > 0) {
    area_utile_mq = input.superficie_falda_mq * input.fattore_occupazione_falda;

    if (modulo) {
      const areaModulo = areaModuloMq(modulo);
      if (areaModulo > 0) {
        numero_moduli_max = Math.floor(area_utile_mq / areaModulo);
        potenza_massima_kwp = (numero_moduli_max * modulo.potenza_wp) / 1000;
      }
    }
  }

  let batteria_consigliata_kwh: number | null = null;
  if (input.consumo_f3_kwh !== null && input.consumo_f3_kwh > 0) {
    const consumoGiornalieroMedio = input.consumo_f3_kwh / 365;
    const batteriaGrezza = consumoGiornalieroMedio * input.margine_batteria;
    batteria_consigliata_kwh = arrotondaTaglioBatteria(batteriaGrezza);
  }

  return {
    fabbisogno_totale_kwh,
    potenza_consigliata_kwp,
    area_utile_mq,
    potenza_massima_kwp,
    numero_moduli_max,
    batteria_consigliata_kwh,
  };
}
