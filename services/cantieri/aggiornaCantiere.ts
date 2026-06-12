import { supabase } from "@/lib/supabase";
import {
  CantiereBackoffice,
  CantiereInput,
} from "@/types/cantieri";

type Params = {
  cantiereId: string;
  cantiere: CantiereInput;
};

export async function aggiornaCantiere({
  cantiereId,
  cantiere,
}: Params): Promise<CantiereBackoffice> {
  const { data, error } = await supabase
    .from("cantieri")
    .update({
      nome: cantiere.nome,
      indirizzo: cantiere.indirizzo,
      lavorazioni: cantiere.lavorazioni,
      attivo: cantiere.attivo,
      cliente_id: cantiere.cliente_id,
      ...(cantiere.da_verificare !== undefined
        ? { da_verificare: cantiere.da_verificare }
        : {}),
    })
    .eq("id", cantiereId)
    .select(
      "id, nome, indirizzo, lavorazioni, attivo, cliente_id, da_verificare"
    )
    .single();

  if (error) {
    throw error;
  }

  return data as CantiereBackoffice;
}
