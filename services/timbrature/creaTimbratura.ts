import { supabase } from "@/lib/supabase";

import {
  Timbratura,
  TipoTimbratura,
} from "@/types/timbrature";
import { calcolaStatoDaUltimaTimbratura } from "@/services/timbrature/calcolaStato";
import { loadUltimaTimbratura } from "@/services/timbrature/loadUltimaTimbratura";
import { validaSequenzaTimbratura } from "@/services/timbrature/validaSequenzaTimbratura";

type Params = {
  userId: string;
  cantiereId: string;
  tipo: TipoTimbratura;
};

export async function creaTimbratura({
  userId,
  cantiereId,
  tipo,
}: Params): Promise<Timbratura> {
  const ultimaTimbratura =
    await loadUltimaTimbratura(userId);

  const statoAttuale =
    calcolaStatoDaUltimaTimbratura(
      ultimaTimbratura?.tipo
    );

  const validazione =
    validaSequenzaTimbratura(
      statoAttuale,
      tipo
    );

  if (!validazione.valida) {
    throw new Error(
      validazione.errore ||
        "Sequenza timbratura non valida"
    );
  }

  const { data, error } = await supabase
    .from("timbrature")
    .insert({
      user_id: userId,
      cantiere_id: cantiereId,
      tipo,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Timbratura;
}
