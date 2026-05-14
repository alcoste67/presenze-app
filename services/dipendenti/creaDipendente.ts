import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { supabase } from "@/lib/supabase";
import {
  Dipendente,
  DipendenteInput,
  TipoConteggioOre,
} from "@/types/dipendenti";
import { TIPO_CONTEGGIO_ORE } from "@/constants/tipoConteggioOre";

const ERRORI_CREA_DIPENDENTE = {
  SESSIONE_MANCANTE:
    "Sessione utente non valida",
  RISPOSTA_NON_VALIDA:
    "Risposta creazione dipendente non valida",
  ERRORE_GENERICO:
    "Errore creazione dipendente",
} as const;

const TIPI_CONTEGGIO_ORE_CONSENTITI: readonly TipoConteggioOre[] =
  Object.values(TIPO_CONTEGGIO_ORE);

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isDipendente(
  value: unknown
): value is Dipendente {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.nome === "string" &&
    typeof value.cognome === "string" &&
    typeof value.email === "string" &&
    typeof value.ruolo === "string" &&
    typeof value.attivo === "boolean" &&
    typeof value.tipo_conteggio_ore ===
      "string" &&
    TIPI_CONTEGGIO_ORE_CONSENTITI.includes(
      value.tipo_conteggio_ore as TipoConteggioOre
    ) &&
    (typeof value.auth_user_id === "string" ||
      value.auth_user_id === null) &&
    typeof value.created_at === "string"
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

  return ERRORI_CREA_DIPENDENTE.ERRORE_GENERICO;
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

export async function creaDipendente(
  dipendente: DipendenteInput
): Promise<Dipendente> {
  const { data, error } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  const accessToken =
    data.session?.access_token;

  if (!accessToken) {
    throw new Error(
      ERRORI_CREA_DIPENDENTE.SESSIONE_MANCANTE
    );
  }

  const response = await fetch(
    API_ROUTES.CREA_DIPENDENTE_CON_AUTH,
    {
      method: "POST",
      headers: {
        [API_HEADERS.CONTENT_TYPE]:
          API_HEADERS.APPLICATION_JSON,
        [API_HEADERS.AUTHORIZATION]:
          `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
      body: JSON.stringify(dipendente),
    }
  );

  const payload =
    await leggiJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      getMessaggioErroreApi(payload)
    );
  }

  if (!isDipendente(payload)) {
    throw new Error(
      ERRORI_CREA_DIPENDENTE.RISPOSTA_NON_VALIDA
    );
  }

  return payload;
}
