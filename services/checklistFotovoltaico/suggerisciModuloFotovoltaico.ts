import { areaModuloMq, type ModuloPerDimensionamento } from "@/services/checklistFotovoltaico/calcolaDimensionamentoFotovoltaico";
import type { ModuloFotovoltaico } from "@/types/moduliFotovoltaici";

type Valutazione = {
  modulo: ModuloFotovoltaico;
  potenzaMassimaKwp: number;
};

function wpPerMq(modulo: ModuloPerDimensionamento): number {
  const area = areaModuloMq(modulo);
  return area > 0 ? modulo.potenza_wp / area : 0;
}

/**
 * Suggerisce il modulo del catalogo più adatto allo spazio disponibile:
 * tra quelli che raggiungono/superano la potenza consigliata nell'area
 * utile, il più vicino per eccesso minimo (a parità, Wp/mq più alto);
 * se nessuno la raggiunge, quello con la potenza massima ottenibile più
 * alta nello stesso spazio.
 */
export function suggerisciModuloFotovoltaico(
  moduli: ModuloFotovoltaico[],
  { potenzaConsigliataKwp, areaUtileMq }: { potenzaConsigliataKwp: number; areaUtileMq: number | null }
): ModuloFotovoltaico | null {
  if (moduli.length === 0 || areaUtileMq === null || areaUtileMq <= 0) {
    return null;
  }

  const valutati: Valutazione[] = moduli
    .map((modulo) => {
      const area = areaModuloMq(modulo);
      if (area <= 0) return null;
      const numeroModuliMax = Math.floor(areaUtileMq / area);
      if (numeroModuliMax <= 0) return null;
      return { modulo, potenzaMassimaKwp: (numeroModuliMax * modulo.potenza_wp) / 1000 };
    })
    .filter((v): v is Valutazione => v !== null);

  if (valutati.length === 0) return null;

  const idonei = valutati.filter((v) => v.potenzaMassimaKwp >= potenzaConsigliataKwp);
  const pool = idonei.length > 0 ? idonei : valutati;
  const privilegiaMinimo = idonei.length > 0;

  const migliore = pool.reduce<Valutazione | null>((corrente, candidato) => {
    if (!corrente) return candidato;

    const differenza = candidato.potenzaMassimaKwp - corrente.potenzaMassimaKwp;
    const candidatoMigliore = privilegiaMinimo ? differenza < 0 : differenza > 0;
    const paritaPotenza = differenza === 0;

    if (candidatoMigliore) return candidato;
    if (paritaPotenza && wpPerMq(candidato.modulo) > wpPerMq(corrente.modulo)) return candidato;
    return corrente;
  }, null);

  return migliore?.modulo ?? null;
}
