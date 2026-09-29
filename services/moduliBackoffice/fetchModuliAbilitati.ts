import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { MODULI_BACKOFFICE } from "@/constants/moduliBackoffice";
import { supabase } from "@/lib/supabase";

/**
 * Moduli backoffice abilitati per l'azienda dell'utente autenticato.
 * Fail-open su qualunque errore: meglio mostrare tutto che nascondere
 * moduli per un problema di rete o di configurazione.
 */
export async function fetchModuliAbilitati(): Promise<Set<string>> {
  const tuttiAbilitati = new Set(Object.values(MODULI_BACKOFFICE));

  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return tuttiAbilitati;

    const response = await fetch(API_ROUTES.MODULI_ABILITATI, {
      headers: {
        [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
    });
    if (!response.ok) return tuttiAbilitati;

    const payload = (await response.json()) as { moduli?: string[] };
    if (!Array.isArray(payload.moduli)) return tuttiAbilitati;

    return new Set(payload.moduli);
  } catch {
    return tuttiAbilitati;
  }
}
