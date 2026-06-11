import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import {
  CantiereBackoffice,
  CantiereInput,
} from "@/types/cantieri";

export async function creaCantiere(
  cantiere: CantiereInput
): Promise<CantiereBackoffice> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(
    supabase,
    user.id
  );

  const { data, error } = await supabase
    .from("cantieri")
    .insert({
      nome: cantiere.nome,
      indirizzo: cantiere.indirizzo,
      lavorazioni: cantiere.lavorazioni,
      attivo: cantiere.attivo,
      cliente_id: cantiere.cliente_id,
      azienda_id: aziendaId,
    })
    .select(
      "id, nome, indirizzo, lavorazioni, attivo, cliente_id"
    )
    .single();

  if (error) {
    throw error;
  }

  return data as CantiereBackoffice;
}
