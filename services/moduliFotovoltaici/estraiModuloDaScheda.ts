import { isRecord } from "@/lib/typeGuards";
import { getMessaggioErroreApi } from "@/lib/errors";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { MODULI_FOTOVOLTAICI_TESTI } from "@/constants/moduliFotovoltaici";
import { supabase } from "@/lib/supabase";
import type { ModuloFotovoltaicoImportPreview } from "@/types/moduliFotovoltaici";

async function leggiJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function estraiModuloDaScheda(
  file: File
): Promise<ModuloFotovoltaicoImportPreview> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    throw new Error(MODULI_FOTOVOLTAICI_TESTI.ERRORI.TOKEN_MANCANTE);
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(API_ROUTES.MODULI_FOTOVOLTAICI_ESTRAI_DA_SCHEDA, {
    method: "POST",
    headers: {
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
    },
    body: formData,
  });

  const payload = await leggiJsonResponse(response);

  if (!response.ok) {
    throw new Error(getMessaggioErroreApi(payload, MODULI_FOTOVOLTAICI_TESTI.ERRORI.GENERICO));
  }

  if (!isRecord(payload)) {
    throw new Error(MODULI_FOTOVOLTAICI_TESTI.ERRORI.AI_RISPOSTA_NON_VALIDA);
  }

  return payload as ModuloFotovoltaicoImportPreview;
}
