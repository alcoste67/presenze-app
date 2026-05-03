import { supabase } from "@/lib/supabase";

import { TipoTimbratura } from "@/types/timbrature";

type Params = {
  userId: string;
  cantiereId: string;
  tipo: TipoTimbratura;
};

export async function creaTimbratura({
  userId,
  cantiereId,
  tipo,
}: Params) {
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

  return data;
}