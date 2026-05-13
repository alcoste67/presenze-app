import { API_HEADERS, API_ROUTES } from "@/constants/api";

const ERRORI_VERIFICA_DIPENDENTE = {
  RISPOSTA_NON_VALIDA:
    "Risposta verifica dipendente non valida",
  ERRORE_GENERICO:
    "Errore verifica dipendente attivo",
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

  return ERRORI_VERIFICA_DIPENDENTE.ERRORE_GENERICO;
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

function isVerificaDipendenteResponse(
  value: unknown
): value is { attivo: boolean } {
  return (
    isRecord(value) &&
    typeof value.attivo === "boolean"
  );
}

export async function isDipendenteAttivo(
  email: string
): Promise<boolean> {
  const emailNormalizzata = email
    .trim()
    .toLowerCase();

  if (!emailNormalizzata) {
    return false;
  }

  const response = await fetch(
    API_ROUTES.VERIFICA_DIPENDENTE_ATTIVO,
    {
      method: "POST",
      headers: {
        [API_HEADERS.CONTENT_TYPE]:
          API_HEADERS.APPLICATION_JSON,
      },
      body: JSON.stringify({
        email: emailNormalizzata,
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

  if (!isVerificaDipendenteResponse(payload)) {
    throw new Error(
      ERRORI_VERIFICA_DIPENDENTE.RISPOSTA_NON_VALIDA
    );
  }

  return payload.attivo;
}
