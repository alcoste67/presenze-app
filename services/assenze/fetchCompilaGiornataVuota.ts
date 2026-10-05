import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { ASSENZE_TESTI } from "@/constants/assenze";
import { getMessaggioErroreApi } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import type { TipoAssenzaEsteso } from "@/types/assenze";

export async function compilaGiornataVuotaClient(input: {
  dipendenteId: string;
  data: string;
  tipo: TipoAssenzaEsteso;
  nota: string;
}): Promise<void> {
  const { data: sessione, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = sessione.session?.access_token;
  if (!token) throw new Error(ASSENZE_TESTI.ERRORI.SESSIONE_MANCANTE);

  const risposta = await fetch(API_ROUTES.ASSENZE_COMPILA_GIORNATA, {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
    body: JSON.stringify(input),
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(getMessaggioErroreApi(payload, ASSENZE_TESTI.ERRORI.SALVATAGGIO));
  }
}
