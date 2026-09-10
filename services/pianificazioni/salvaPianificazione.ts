import { getMessaggioErroreApi } from "@/lib/errors";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { PIANIFICAZIONI_TESTI } from "@/constants/pianificazioni";
import { supabase } from "@/lib/supabase";
import type { PianificazioneInput } from "@/types/pianificazioni";

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
    throw new Error(PIANIFICAZIONI_TESTI.ERRORI.SESSIONE_MANCANTE);
  }

  return accessToken;
}

export async function creaPianificazioneClient(
  input: PianificazioneInput
): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(API_ROUTES.PIANIFICAZIONI, {
    method: "POST",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await leggiJsonResponse(response);
    throw new Error(
      getMessaggioErroreApi(payload, PIANIFICAZIONI_TESTI.ERRORI.SALVATAGGIO)
    );
  }
}

export async function aggiornaPianificazioneClient(
  id: string,
  input: PianificazioneInput
): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${API_ROUTES.PIANIFICAZIONI}/${id}`, {
    method: "PUT",
    headers: {
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await leggiJsonResponse(response);
    throw new Error(
      getMessaggioErroreApi(payload, PIANIFICAZIONI_TESTI.ERRORI.SALVATAGGIO)
    );
  }
}

export async function eliminaPianificazioneClient(id: string): Promise<void> {
  const accessToken = await getAccessToken();

  const response = await fetch(`${API_ROUTES.PIANIFICAZIONI}/${id}`, {
    method: "DELETE",
    headers: {
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
    },
  });

  if (!response.ok) {
    const payload = await leggiJsonResponse(response);
    throw new Error(
      getMessaggioErroreApi(payload, PIANIFICAZIONI_TESTI.ERRORI.ELIMINAZIONE)
    );
  }
}
