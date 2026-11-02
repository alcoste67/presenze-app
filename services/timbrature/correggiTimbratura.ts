import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { getMessaggioErroreApi } from "@/lib/errors";
import { CORREZIONI_TIMBRATURE_TESTI } from "@/constants/correzioniTimbrature";
import type { TipoAttivita } from "@/types/attivita";
import type { TimbraturaLavorazioneInput } from "@/types/timbratureLavorazioni";

type Params = {
  tipo: "ENTRATA" | "USCITA";
  orario: string;
  cantiereId?: string | null;
  attivitaTipo?: TipoAttivita | null;
  lavorazioni?: TimbraturaLavorazioneInput[];
};

export type CorreggiTimbraturaRisposta = {
  id: string;
  cantiereId: string | null;
};

export async function correggiTimbratura({
  tipo,
  orario,
  cantiereId,
  attivitaTipo,
  lavorazioni,
}: Params): Promise<CorreggiTimbraturaRisposta> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione mancante");

  const risposta = await fetch(API_ROUTES.TIMBRATURE_CORREZIONE, {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
    body: JSON.stringify({ tipo, orario, cantiereId, attivitaTipo, lavorazioni }),
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(
      getMessaggioErroreApi(payload, CORREZIONI_TIMBRATURE_TESTI.ERRORI.GENERICO)
    );
  }

  return { id: payload.id as string, cantiereId: (payload.cantiereId as string | null) ?? null };
}
