import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { ANOMALIE_TIMBRATURE_TESTI } from "@/constants/anomalieTimbrature";
import { getMessaggioErroreApi } from "@/lib/errors";

type Params = {
  dipendenteId: string;
  data: string;
  ora: string;
};

export async function proponiCorrezioneAdmin({ dipendenteId, data, ora }: Params): Promise<void> {
  const { data: sessione, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = sessione.session?.access_token;
  if (!token) throw new Error("Sessione mancante");

  const risposta = await fetch(API_ROUTES.TIMBRATURE_CORREZIONE_ADMIN, {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
    body: JSON.stringify({ dipendenteId, data, ora }),
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(getMessaggioErroreApi(payload, ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO));
  }
}
