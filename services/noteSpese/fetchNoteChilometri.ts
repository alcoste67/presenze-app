import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { NOTE_SPESE_TESTI } from "@/constants/noteSpese";
import { getMessaggioErroreApi } from "@/lib/errors";

export type NoteChilometriRisposta = {
  usaAutoPropria: boolean;
  note: { id: string; data: string; km: number }[];
};

export async function fetchNoteChilometri(
  params: { dataInizio?: string; dataFine?: string } = {}
): Promise<NoteChilometriRisposta> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error(NOTE_SPESE_TESTI.ERRORI.SESSIONE_MANCANTE);

  const query = new URLSearchParams();
  if (params.dataInizio) query.set("dataInizio", params.dataInizio);
  if (params.dataFine) query.set("dataFine", params.dataFine);

  const risposta = await fetch(`${API_ROUTES.NOTE_CHILOMETRI}?${query.toString()}`, {
    headers: {
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(getMessaggioErroreApi(payload, NOTE_SPESE_TESTI.ERRORI.CARICAMENTO));
  }

  return {
    usaAutoPropria: Boolean(payload?.usaAutoPropria),
    note: payload?.note || [],
  };
}
