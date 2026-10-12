import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { NOTE_SPESE_TESTI } from "@/constants/noteSpese";
import { getMessaggioErroreApi } from "@/lib/errors";
import type { NotaSpesa, StatoNotaSpesa } from "@/types/noteSpese";

export async function fetchNoteSpese(
  params: {
    dataInizio?: string;
    dataFine?: string;
    stato?: StatoNotaSpesa;
    soloMie?: boolean;
  } = {}
): Promise<NotaSpesa[]> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error(NOTE_SPESE_TESTI.ERRORI.SESSIONE_MANCANTE);

  const query = new URLSearchParams();
  if (params.dataInizio) query.set("dataInizio", params.dataInizio);
  if (params.dataFine) query.set("dataFine", params.dataFine);
  if (params.stato) query.set("stato", params.stato);
  if (params.soloMie) query.set("soloMie", "true");

  const risposta = await fetch(`${API_ROUTES.NOTE_SPESE}?${query.toString()}`, {
    headers: {
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(getMessaggioErroreApi(payload, NOTE_SPESE_TESTI.ERRORI.CARICAMENTO));
  }

  return (payload?.note || []) as NotaSpesa[];
}
