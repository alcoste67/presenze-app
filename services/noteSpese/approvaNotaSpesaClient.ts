import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { NOTE_SPESE_TESTI } from "@/constants/noteSpese";
import { getMessaggioErroreApi } from "@/lib/errors";
import type { StatoNotaSpesa } from "@/types/noteSpese";

export async function approvaNotaSpesaClient({
  notaId,
  stato,
  notaRifiuto,
}: {
  notaId: string;
  stato: Extract<StatoNotaSpesa, "APPROVATA" | "RIFIUTATA">;
  notaRifiuto?: string;
}): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error(NOTE_SPESE_TESTI.ERRORI.SESSIONE_MANCANTE);

  const risposta = await fetch(`${API_ROUTES.NOTE_SPESE}/${notaId}`, {
    method: "PATCH",
    headers: {
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
    },
    body: JSON.stringify({ stato, notaRifiuto }),
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(getMessaggioErroreApi(payload, NOTE_SPESE_TESTI.ERRORI.SALVATAGGIO));
  }
}
