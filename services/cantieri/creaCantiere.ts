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
      da_verificare: cantiere.da_verificare ?? false,
      responsabile_commessa_user_id:
        cantiere.responsabile_commessa_user_id ?? null,
      azienda_id: aziendaId,
    })
    .select(
      "id, nome, indirizzo, lavorazioni, attivo, cliente_id, da_verificare, responsabile_commessa_user_id"
    )
    .single();

  if (error) {
    throw error;
  }

  return data as CantiereBackoffice;
}
