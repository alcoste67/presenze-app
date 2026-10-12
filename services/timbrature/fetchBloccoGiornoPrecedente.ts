import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { BLOCCO_GIORNO_PRECEDENTE_TESTI } from "@/constants/bloccoGiornoPrecedente";
import { getMessaggioErroreApi } from "@/lib/errors";
import { isRecord } from "@/lib/typeGuards";
import type { BloccoGiornoPrecedente } from "@/types/bloccoGiornoPrecedente";

export async function fetchBloccoGiornoPrecedente(): Promise<BloccoGiornoPrecedente | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) return null;

  const risposta = await fetch(API_ROUTES.TIMBRATURE_BLOCCO_GIORNO_PRECEDENTE, {
    headers: {
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(
      getMessaggioErroreApi(payload, BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.GENERICO)
    );
  }

  if (!isRecord(payload) || !payload.blocco) {
    return null;
  }

  return payload.blocco as BloccoGiornoPrecedente;
}
