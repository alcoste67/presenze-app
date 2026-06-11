import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";

type SupabaseClient = typeof supabase;

export const ERRORE_CLIENTE_COLLEGATO =
  "Cliente collegato a cantieri o rapporti: disattivalo invece di eliminarlo";

/**
 * Elimina un cliente SOLO se non è referenziato da cantieri o rapporti.
 * In caso contrario lancia ERRORE_CLIENTE_COLLEGATO (lo storico non si
 * tocca: il cliente va disattivato).
 */
export async function eliminaClienteSeVuoto({
  clienteId,
  supabaseClient = supabase,
}: {
  clienteId: string;
  supabaseClient?: SupabaseClient;
}): Promise<void> {
  const [cantieriResult, rapportiResult] = await Promise.all([
    supabaseClient
      .from("cantieri")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId),
    supabaseClient
      .from("rapporti_intervento")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId),
  ]);

  if (cantieriResult.error) {
    throwErroreSupabase("Verifica cantieri cliente", cantieriResult.error);
  }
  if (rapportiResult.error) {
    throwErroreSupabase("Verifica rapporti cliente", rapportiResult.error);
  }

  if ((cantieriResult.count ?? 0) > 0 || (rapportiResult.count ?? 0) > 0) {
    throw new Error(ERRORE_CLIENTE_COLLEGATO);
  }

  const { error } = await supabaseClient
    .from("clienti")
    .delete()
    .eq("id", clienteId);

  if (error) {
    // FK violation (rapporto creato nel frattempo) → stesso messaggio
    if (error.code === "23503") {
      throw new Error(ERRORE_CLIENTE_COLLEGATO);
    }
    throwErroreSupabase("Eliminazione cliente", error);
  }
}
