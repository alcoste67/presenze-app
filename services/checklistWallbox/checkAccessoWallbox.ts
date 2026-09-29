import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { isAziendaAutorizzataWallbox } from "@/lib/wallboxAccess";

/** true se l'azienda dell'utente autenticato è tra quelle abilitate alla checklist wallbox. */
export async function checkAccessoWallbox(userId: string): Promise<boolean> {
  try {
    const aziendaId = await getAziendaIdFromAuthUser(supabase, userId);
    return isAziendaAutorizzataWallbox(aziendaId);
  } catch {
    return false;
  }
}
