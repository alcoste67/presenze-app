import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { LAVORAZIONI_TESTI } from "@/constants/lavorazioni";
import { supabase } from "@/lib/supabase";
import type { LavorazioneImportPreview } from "@/types/lavorazioni";

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isLavorazioneImportPreview(
  value: unknown
): value is LavorazioneImportPreview {
  return (
    isRecord(value) &&
    typeof value.nome === "string" &&
    typeof value.ordine === "number" &&
    Number.isInteger(value.ordine)
  );
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

function getMessaggioErroreApi(
  payload: unknown
) {
  if (
    isRecord(payload) &&
    typeof payload.errore === "string"
  ) {
    return payload.errore;
  }

  return LAVORAZIONI_TESTI.ERRORI
    .AI_ESTRAZIONE_FALLITA;
}

export async function estraiLavorazioniDaComputo(
  file: File
): Promise<LavorazioneImportPreview[]> {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken =
    data.session?.access_token;

  if (!accessToken) {
    throw new Error(
      LAVORAZIONI_TESTI.ERRORI
        .TOKEN_MANCANTE
    );
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    API_ROUTES.LAVORAZIONI_ESTRAI_DA_COMPUTO,
    {
      method: "POST",
      headers: {
        [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
      body: formData,
    }
  );

  const payload =
    await leggiJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      getMessaggioErroreApi(payload)
    );
  }

  if (
    !Array.isArray(payload) ||
    !payload.every(
      isLavorazioneImportPreview
    )
  ) {
    throw new Error(
      LAVORAZIONI_TESTI.ERRORI
        .AI_RISPOSTA_NON_VALIDA
    );
  }

  return payload;
}
