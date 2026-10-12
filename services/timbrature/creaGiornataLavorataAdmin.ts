import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { ASSENZE_TESTI } from "@/constants/assenze";
import { getMessaggioErroreApi } from "@/lib/errors";

export async function creaGiornataLavorataAdmin({
  dipendenteId,
  data,
  oraIngresso,
  oraUscita,
  cantiereId,
  attivitaTipo,
}: {
  dipendenteId: string;
  data: string;
  oraIngresso: string;
  oraUscita: string;
  cantiereId: string | null;
  attivitaTipo: string | null;
}): Promise<void> {
  const { data: sessione, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = sessione.session?.access_token;
  if (!token) throw new Error(ASSENZE_TESTI.ERRORI.SESSIONE_MANCANTE);

  const risposta = await fetch(API_ROUTES.TIMBRATURE_CORREZIONE_ADMIN_GIORNATA_LAVORATA, {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
    body: JSON.stringify({ dipendenteId, data, oraIngresso, oraUscita, cantiereId, attivitaTipo }),
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(getMessaggioErroreApi(payload, ASSENZE_TESTI.ERRORI.SALVATAGGIO));
  }
}
