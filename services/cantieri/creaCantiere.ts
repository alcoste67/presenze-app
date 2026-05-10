import { supabase } from "@/lib/supabase";
import {
  CantiereBackoffice,
  CantiereInput,
} from "@/types/cantieri";

export async function creaCantiere(
  cantiere: CantiereInput
): Promise<CantiereBackoffice> {
  const { data, error } = await supabase
    .from("cantieri")
    .insert({
      nome: cantiere.nome,
      indirizzo: cantiere.indirizzo,
      lavorazioni: cantiere.lavorazioni,
      attivo: cantiere.attivo,
    })
    .select(
      "id, nome, indirizzo, lavorazioni, attivo"
    )
    .single();

  if (error) {
    throw error;
  }

  return data as CantiereBackoffice;
}
