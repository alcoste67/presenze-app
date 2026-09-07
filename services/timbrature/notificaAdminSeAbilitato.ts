import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";

/**
 * Fire-and-forget dopo un'ENTRATA/USCITA: se il dipendente ha
 * "avvisa_admin_timbratura" attivo, avvisa gli admin (push + mail). Non
 * deve mai interrompere il flusso di timbratura: eventuali errori restano
 * silenziosi (solo log in console).
 */
export async function notificaAdminSeAbilitato(tipo: "ENTRATA" | "USCITA"): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    await fetch(API_ROUTES.TIMBRATURE_NOTIFICA_ADMIN, {
      method: "POST",
      headers: {
        [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
        [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
      },
      body: JSON.stringify({ tipo }),
    });
  } catch (error: unknown) {
    console.error("Errore notifica admin timbratura", error);
  }
}
