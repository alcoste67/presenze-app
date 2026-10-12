import { supabase } from "@/lib/supabase";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { RIMBORSI_KM_TESTI } from "@/constants/rimborsiKm";
import { getMessaggioErroreApi } from "@/lib/errors";
import type { RimborsiKmMensiliRisposta } from "@/types/rimborsiKm";

export async function fetchRimborsiKmMensili({
  anno,
  mese,
}: {
  anno: number;
  mese: number;
}): Promise<RimborsiKmMensiliRisposta> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const token = data.session?.access_token;
  if (!token) throw new Error(RIMBORSI_KM_TESTI.ERRORI.SESSIONE_MANCANTE);

  const query = new URLSearchParams({ anno: String(anno), mese: String(mese) });

  const risposta = await fetch(`${API_ROUTES.NOTE_CHILOMETRI_RIMBORSI_MENSILI}?${query.toString()}`, {
    headers: {
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
  });

  const payload = await risposta.json().catch(() => null);

  if (!risposta.ok) {
    throw new Error(getMessaggioErroreApi(payload, RIMBORSI_KM_TESTI.ERRORI.GENERICO));
  }

  return payload as RimborsiKmMensiliRisposta;
}
