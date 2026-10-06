import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { ANOMALIE_TIMBRATURE_TESTI } from "@/constants/anomalieTimbrature";
import { getMessaggioErroreApi } from "@/lib/errors";
import { isRecord } from "@/lib/typeGuards";
import type { DatiCorrezioneTimbratura } from "@/types/anomalieTimbrature";

export async function caricaTurnoAperto(
  dipendenteId: string
): Promise<DatiCorrezioneTimbratura> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione mancante");

  const risposta = await fetch(
    `${API_ROUTES.TIMBRATURE_CORREZIONE_ADMIN}?dipendenteId=${encodeURIComponent(dipendenteId)}`,
    {
      headers: {
        [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
      },
    }
  );

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(getMessaggioErroreApi(payload, ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO));
  }

  if (!isRecord(payload)) {
    return { dipendenteNome: "", turnoAperto: null };
  }

  return payload as unknown as DatiCorrezioneTimbratura;
}
