import {
  RAPPORTI_INTERVENTO_LIMITI,
  RAPPORTI_INTERVENTO_REGOLE,
} from "@/constants/rapportiIntervento";
import type { CalcoloOreFatturabiliIntervento } from "@/types/rapportiIntervento";

type Params = {
  oreUomoRealiMinuti: number;
  viaggioMinuti: number;
};

export function calcolaOreFatturabili({
  oreUomoRealiMinuti,
  viaggioMinuti,
}: Params): CalcoloOreFatturabiliIntervento {
  const oreReali = Math.max(
    0,
    Math.floor(oreUomoRealiMinuti)
  );
  const viaggio = Math.max(
    0,
    Math.floor(viaggioMinuti)
  );

  if (
    oreReali <=
    RAPPORTI_INTERVENTO_LIMITI.MEZZA_GIORNATA_MINUTI
  ) {
    return {
      regola_fatturazione:
        RAPPORTI_INTERVENTO_REGOLE.MEZZA_GIORNATA,
      ore_fatturabili_minuti:
        RAPPORTI_INTERVENTO_LIMITI.MEZZA_GIORNATA_MINUTI +
        viaggio,
    };
  }

  if (
    oreReali <=
    RAPPORTI_INTERVENTO_LIMITI.GIORNATA_MINUTI
  ) {
    return {
      regola_fatturazione:
        RAPPORTI_INTERVENTO_REGOLE.GIORNATA,
      ore_fatturabili_minuti:
        RAPPORTI_INTERVENTO_LIMITI.GIORNATA_MINUTI +
        viaggio,
    };
  }

  return {
    regola_fatturazione:
      RAPPORTI_INTERVENTO_REGOLE.ORE_REALI,
    ore_fatturabili_minuti:
      oreReali + viaggio,
  };
}
