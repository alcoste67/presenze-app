import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { NOTE_SPESE_TESTI } from "@/constants/noteSpese";
import { getMessaggioErroreApi } from "@/lib/errors";

export async function salvaNotaChilometriClient({
  data,
  km,
}: {
  data: string;
  km: number;
}): Promise<void> {
  const { data: sessione, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = sessione.session?.access_token;
  if (!token) throw new Error(NOTE_SPESE_TESTI.ERRORI.SESSIONE_MANCANTE);

  const risposta = await fetch(API_ROUTES.NOTE_CHILOMETRI, {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
    body: JSON.stringify({ data, km }),
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(getMessaggioErroreApi(payload, NOTE_SPESE_TESTI.ERRORI.SALVATAGGIO));
  }
}
