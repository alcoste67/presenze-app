import { isRecord } from "@/lib/typeGuards";
import { getMessaggioErroreApi } from "@/lib/errors";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { PIANIFICAZIONI_TESTI } from "@/constants/pianificazioni";
import { supabase } from "@/lib/supabase";
import type {
  PianificazioneLavoro,
  PianificazioneMacchinario,
  PianificazioneMembro,
  PianificazioniFiltri,
  PianificazioniRisposta,
} from "@/types/pianificazioni";

function isPianificazioneMembro(value: unknown): value is PianificazioneMembro {
  return (
    isRecord(value) &&
    typeof value.dipendenteId === "string" &&
    typeof value.nome === "string"
  );
}

function isPianificazioneMacchinario(
  value: unknown
): value is PianificazioneMacchinario {
  return (
    isRecord(value) &&
    typeof value.macchinarioId === "string" &&
    typeof value.nome === "string"
  );
}

function isPianificazioneLavoro(value: unknown): value is PianificazioneLavoro {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.cantiereId === "string" &&
    typeof value.cantiereNome === "string" &&
    typeof value.data === "string" &&
    typeof value.note === "string" &&
    Array.isArray(value.squadra) &&
    value.squadra.every(isPianificazioneMembro) &&
    Array.isArray(value.macchinari) &&
    value.macchinari.every(isPianificazioneMacchinario) &&
    typeof value.creatoDaId === "string" &&
    typeof value.createdAt === "string"
  );
}

function isPianificazioniRisposta(value: unknown): value is PianificazioniRisposta {
  return (
    isRecord(value) &&
    Array.isArray(value.pianificazioni) &&
    value.pianificazioni.every(isPianificazioneLavoro) &&
    typeof value.puoModificare === "boolean"
  );
}

async function leggiJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchPianificazioni(
  filtri: PianificazioniFiltri,
  opzioni?: { soloMie?: boolean }
): Promise<PianificazioniRisposta> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    throw new Error(PIANIFICAZIONI_TESTI.ERRORI.SESSIONE_MANCANTE);
  }

  const parametri = new URLSearchParams({
    dataInizio: filtri.dataInizio,
    dataFine: filtri.dataFine,
  });

  if (opzioni?.soloMie) {
    parametri.set("soloMie", "true");
  }

  const response = await fetch(
    `${API_ROUTES.PIANIFICAZIONI}?${parametri.toString()}`,
    {
      headers: {
        [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
    }
  );

  const payload = await leggiJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      getMessaggioErroreApi(payload, PIANIFICAZIONI_TESTI.ERRORI.GENERICO)
    );
  }

  if (!isPianificazioniRisposta(payload)) {
    throw new Error(PIANIFICAZIONI_TESTI.ERRORI.RISPOSTA_NON_VALIDA);
  }

  return payload;
}
