import { supabase } from "@/lib/supabase";

import { TipoAttivita } from "@/types/attivita";
import {
  Timbratura,
  TipoTimbratura,
} from "@/types/timbrature";

type Params = {
  userId: string;
  dataInizio: string;
  dataFine: string;
};

type Cantiere = {
  id: string;
  nome: string;
};

type TimbraturaStoricoRow = Pick<
  Timbratura,
  | "id"
  | "user_id"
  | "cantiere_id"
  | "attivita_tipo"
  | "tipo"
  | "created_at"
>;

export type TimbraturaStorico =
  TimbraturaStoricoRow & {
    cantiere_nome: string | null;
  };

export async function loadStoricoTimbrature({
  userId,
  dataInizio,
  dataFine,
}: Params): Promise<TimbraturaStorico[]> {
  const { data, error } = await supabase
    .from("timbrature")
    .select(
      "id, user_id, cantiere_id, attivita_tipo, tipo, created_at"
    )
    .eq("user_id", userId)
    .gte("created_at", dataInizio)
    .lt("created_at", dataFine)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  const timbrature =
    (data || []) as TimbraturaStoricoRow[];

  const cantiereIds = Array.from(
    new Set(
      timbrature
        .map((timbratura) =>
          timbratura.cantiere_id
        )
        .filter(
          (cantiereId): cantiereId is string =>
            Boolean(cantiereId)
        )
    )
  );

  if (cantiereIds.length === 0) {
    return timbrature.map((timbratura) => ({
      ...timbratura,
      cantiere_nome: null,
    }));
  }

  const {
    data: cantieriData,
    error: cantieriError,
  } = await supabase
    .from("cantieri")
    .select("id, nome")
    .in("id", cantiereIds);

  if (cantieriError) {
    throw cantieriError;
  }

  const cantieri =
    (cantieriData || []) as Cantiere[];

  const cantieriById = new Map(
    cantieri.map((cantiere) => [
      cantiere.id,
      cantiere.nome,
    ])
  );

  return timbrature.map((timbratura) => ({
    ...timbratura,
    attivita_tipo:
      timbratura.attivita_tipo as
        | TipoAttivita
        | null,
    tipo: timbratura.tipo as TipoTimbratura,
    cantiere_nome: timbratura.cantiere_id
      ? cantieriById.get(
          timbratura.cantiere_id
        ) || null
      : null,
  }));
}
