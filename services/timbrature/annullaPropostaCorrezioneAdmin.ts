import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { ANOMALIE_TIMBRATURE_TESTI } from "@/constants/anomalieTimbrature";
import { getMessaggioErroreApi } from "@/lib/errors";

export async function annullaPropostaCorrezioneAdmin(propostaId: string): Promise<void> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione mancante");

  const risposta = await fetch(
    `${API_ROUTES.TIMBRATURE_CORREZIONE_ADMIN}?propostaId=${encodeURIComponent(propostaId)}`,
    {
      method: "DELETE",
      headers: {
        [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
      },
    }
  );

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(getMessaggioErroreApi(payload, ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO));
  }
}
