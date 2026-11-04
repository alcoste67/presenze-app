import { supabase } from "@/lib/supabase";
import { API_HEADERS } from "@/constants/api";
import { getMessaggioErroreApi } from "@/lib/errors";
import { CHECKLIST_FOTOVOLTAICO_TESTI } from "@/constants/checklistFotovoltaico";

type EsitoInvio = {
  inviata: boolean;
  destinatario: string;
  cc: string[];
  messageId: string | null;
};

/** Invia il PDF della checklist firmata via email (cliente + admin + compilatore). */
export async function inviaChecklistFotovoltaico({
  checklistFotovoltaicoId,
}: {
  checklistFotovoltaicoId: string;
}): Promise<EsitoInvio> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) {
    throw new Error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.SESSIONE_MANCANTE);
  }

  const risposta = await fetch("/api/checklist-fotovoltaico/invia", {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
    body: JSON.stringify({ checklistFotovoltaicoId }),
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(
      getMessaggioErroreApi(payload, CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.INVIO_FALLITO)
    );
  }

  return payload as EsitoInvio;
}
