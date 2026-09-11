import { getMessaggioErroreApi } from "@/lib/errors";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { ASSENZE_TESTI } from "@/constants/assenze";
import { supabase } from "@/lib/supabase";
import type { RichiestaAssenzaInput } from "@/types/assenze";

async function leggiJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error(ASSENZE_TESTI.ERRORI.SESSIONE_MANCANTE);
  }

  return accessToken;
}

export async function creaRichiestaAssenzaClient(
  input: RichiestaAssenzaInput
): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(API_ROUTES.ASSENZE, {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await leggiJsonResponse(response);
    throw new Error(getMessaggioErroreApi(payload, ASSENZE_TESTI.ERRORI.SALVATAGGIO));
  }
}

export async function aggiornaStatoRichiestaClient(
  id: string,
  stato: "APPROVATA" | "RIFIUTATA" | "ANNULLATA"
): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${API_ROUTES.ASSENZE}/${id}`, {
    method: "PATCH",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
    },
    body: JSON.stringify({ stato }),
  });

  if (!response.ok) {
    const payload = await leggiJsonResponse(response);
    throw new Error(getMessaggioErroreApi(payload, ASSENZE_TESTI.ERRORI.AGGIORNAMENTO));
  }
}
