import { supabase } from "@/lib/supabase";

import { SAL_STATI } from "@/constants/sal";
import type {
  SalCantiere,
  SalLavorazione,
  StatoSalLavorazione,
} from "@/types/sal";

type LavorazioneSalRow = {
  id: string;
  cantiere_id: string;
  nome: string;
  ordine: number;
  percentuale_completamento: number;
};

function getStatoSalLavorazione(
  percentuale: number
): StatoSalLavorazione {
  if (percentuale === 0) {
    return SAL_STATI.NON_INIZIATA;
  }

  if (percentuale === 100) {
    return SAL_STATI.COMPLETATA;
  }

  return SAL_STATI.IN_CORSO;
}

function getAvanzamentoTotale(
  lavorazioni: SalLavorazione[]
) {
  if (lavorazioni.length === 0) {
    return 0;
  }

  const totale = lavorazioni.reduce(
    (somma, lavorazione) =>
      somma +
      lavorazione.percentuale_completamento,
    0
  );

  return Math.round(totale / lavorazioni.length);
}

export async function loadSalCantiere(
  cantiereId: string
): Promise<SalCantiere> {
  if (!cantiereId) {
    return {
      cantiereId,
      avanzamentoTotale: 0,
      lavorazioni: [],
    };
  }

  const { data, error } = await supabase
    .from("lavorazioni_cantiere")
    .select(
      "id, cantiere_id, nome, ordine, percentuale_completamento"
    )
    .eq("cantiere_id", cantiereId)
    .eq("attiva", true)
    .order("ordine", {
      ascending: true,
    })
    .order("nome", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const lavorazioni = (
    (data || []) as LavorazioneSalRow[]
  ).map((lavorazione) => ({
    ...lavorazione,
    stato: getStatoSalLavorazione(
      lavorazione.percentuale_completamento
    ),
  }));

  return {
    cantiereId,
    avanzamentoTotale:
      getAvanzamentoTotale(lavorazioni),
    lavorazioni,
  };
}
