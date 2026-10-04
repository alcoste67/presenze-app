import { supabase } from "@/lib/supabase";
import { API_HEADERS } from "@/constants/api";
import { getMessaggioErroreApi } from "@/lib/errors";
import { ORDINI_LAVORO_TESTI } from "@/constants/ordiniLavoro";

type EsitoInvio = {
  inviata: boolean;
  destinatario: string;
  cc: string[];
  messageId: string | null;
};

/** Invia il PDF dell'ordine di lavoro firmato via email (cliente + admin + compilatore). */
export async function inviaOrdineLavoroEdison({
  ordineLavoroId,
}: {
  ordineLavoroId: string;
}): Promise<EsitoInvio> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) {
    throw new Error(ORDINI_LAVORO_TESTI.ERRORI.SESSIONE_MANCANTE);
  }

  const risposta = await fetch("/api/ordini-lavoro/invia", {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
    body: JSON.stringify({ ordineLavoroId }),
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(
      getMessaggioErroreApi(payload, ORDINI_LAVORO_TESTI.ERRORI.INVIO_FALLITO)
    );
  }

  return payload as EsitoInvio;
}
