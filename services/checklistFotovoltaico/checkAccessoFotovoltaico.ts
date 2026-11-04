import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { isAziendaAutorizzataFotovoltaico } from "@/lib/fotovoltaicoAccess";

/** true se l'azienda dell'utente autenticato è tra quelle abilitate al fotovoltaico (catalogo + checklist). */
export async function checkAccessoFotovoltaico(userId: string): Promise<boolean> {
  try {
    const aziendaId = await getAziendaIdFromAuthUser(supabase, userId);
    return isAziendaAutorizzataFotovoltaico(aziendaId);
  } catch {
    return false;
  }
}
