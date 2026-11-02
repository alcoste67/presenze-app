import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { BLOCCO_GIORNO_PRECEDENTE_TESTI } from "@/constants/bloccoGiornoPrecedente";
import { getMessaggioErroreApi } from "@/lib/errors";
import type { TimbraturaLavorazioneInput } from "@/types/timbratureLavorazioni";

export type ChiudiTurnoPrecedenteRisposta = {
  id: string;
  cantiereId: string | null;
};

export async function chiudiTurnoPrecedenteClient({
  data,
  ora,
  lavorazioni,
}: {
  data: string;
  ora: string;
  lavorazioni?: TimbraturaLavorazioneInput[];
}): Promise<ChiudiTurnoPrecedenteRisposta> {
  const { data: sessione, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = sessione.session?.access_token;
  if (!token) throw new Error(BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.NON_AUTORIZZATO);

  const risposta = await fetch(API_ROUTES.TIMBRATURE_CHIUDI_TURNO_PRECEDENTE, {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
    body: JSON.stringify({ data, ora, lavorazioni }),
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(getMessaggioErroreApi(payload, BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.GENERICO));
  }

  return { id: payload.id as string, cantiereId: (payload.cantiereId as string | null) ?? null };
}
