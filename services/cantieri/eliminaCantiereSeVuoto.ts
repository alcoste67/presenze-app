import { getMessaggioErroreApi } from "@/lib/errors";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { supabase } from "@/lib/supabase";

const ERRORI_ELIMINA_CANTIERE = {
  SESSIONE_MANCANTE:
    "Sessione utente non valida",
  ERRORE_GENERICO:
    "Errore eliminazione cantiere",
} as const;

async function leggiJsonResponse(
  response: Response
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function eliminaCantiereSeVuoto(
  cantiereId: string
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
      ERRORI_ELIMINA_CANTIERE.SESSIONE_MANCANTE
    );
  }

  const response = await fetch(
    API_ROUTES.ELIMINA_CANTIERE_SE_VUOTO,
    {
      method: "POST",
      headers: {
        [API_HEADERS.CONTENT_TYPE]:
          API_HEADERS.APPLICATION_JSON,
        [API_HEADERS.AUTHORIZATION]:
          `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
      body: JSON.stringify({
        cantiereId,
      }),
    }
  );

  const payload =
    await leggiJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      getMessaggioErroreApi(payload, ERRORI_ELIMINA_CANTIERE.ERRORE_GENERICO)
    );
  }
}
