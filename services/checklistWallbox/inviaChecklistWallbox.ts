import { supabase } from "@/lib/supabase";
import { API_HEADERS } from "@/constants/api";
import { getMessaggioErroreApi } from "@/lib/errors";
import { CHECKLIST_WALLBOX_TESTI } from "@/constants/checklistWallbox";

type EsitoInvio = {
  inviata: boolean;
  destinatario: string;
  cc: string[];
  messageId: string | null;
};

/** Invia il PDF della checklist firmata via email (cliente + admin + compilatore). */
export async function inviaChecklistWallbox({
  checklistWallboxId,
}: {
  checklistWallboxId: string;
}): Promise<EsitoInvio> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) {
    throw new Error(CHECKLIST_WALLBOX_TESTI.ERRORI.SESSIONE_MANCANTE);
  }

  const risposta = await fetch("/api/checklist-wallbox/invia", {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
    body: JSON.stringify({ checklistWallboxId }),
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(
      getMessaggioErroreApi(
        payload,
        CHECKLIST_WALLBOX_TESTI.ERRORI.INVIO_FALLITO
      )
    );
  }

  return payload as EsitoInvio;
}
