import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { supabase } from "@/lib/supabase";

const ERRORI_ELIMINA_DIPENDENTE = {
  SESSIONE_MANCANTE:
    "Sessione utente non valida",
  ERRORE_GENERICO:
    "Errore eliminazione dipendente",
} as const;

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getMessaggioErroreApi(
  payload: unknown
): string {
  if (
    isRecord(payload) &&
    typeof payload.errore === "string"
  ) {
    return payload.errore;
  }

  return ERRORI_ELIMINA_DIPENDENTE.ERRORE_GENERICO;
}

async function leggiJsonResponse(
  response: Response
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function eliminaDipendenteSeVuoto(
  dipendenteId: string
): Promise<void> {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken =
    data.session?.access_token;

  if (!accessToken) {
    throw new Error(
      ERRORI_ELIMINA_DIPENDENTE.SESSIONE_MANCANTE
    );
  }

  const response = await fetch(
    API_ROUTES.ELIMINA_DIPENDENTE_SE_VUOTO,
    {
      method: "POST",
      headers: {
        [API_HEADERS.CONTENT_TYPE]:
          API_HEADERS.APPLICATION_JSON,
        [API_HEADERS.AUTHORIZATION]:
          `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
      body: JSON.stringify({
        dipendenteId,
      }),
    }
  );

  const payload =
    await leggiJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      getMessaggioErroreApi(payload)
    );
  }
}
