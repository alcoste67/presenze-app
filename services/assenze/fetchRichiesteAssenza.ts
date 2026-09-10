import { isRecord } from "@/lib/typeGuards";
import { getMessaggioErroreApi } from "@/lib/errors";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { ASSENZE_TESTI } from "@/constants/assenze";
import { supabase } from "@/lib/supabase";
import type { RichiestaAssenza, StatoRichiestaAssenza } from "@/types/assenze";

type RichiesteAssenzaRisposta = {
  richieste: RichiestaAssenza[];
  puoApprovare: boolean;
};

function isRichiestaAssenza(value: unknown): value is RichiestaAssenza {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.dipendenteId === "string" &&
    typeof value.dipendenteNome === "string" &&
    (value.tipo === "FERIE" || value.tipo === "PERMESSO") &&
    typeof value.dataInizio === "string" &&
    typeof value.dataFine === "string" &&
    typeof value.giornataIntera === "boolean" &&
    (value.ore === null || typeof value.ore === "number") &&
    typeof value.stato === "string" &&
    typeof value.nota === "string" &&
    typeof value.createdAt === "string"
  );
}

function isRisposta(value: unknown): value is RichiesteAssenzaRisposta {
  return (
    isRecord(value) &&
    Array.isArray(value.richieste) &&
    value.richieste.every(isRichiestaAssenza) &&
    typeof value.puoApprovare === "boolean"
  );
}

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

export async function fetchRichiesteAssenza(opzioni?: {
  dataInizio?: string;
  dataFine?: string;
  stato?: StatoRichiestaAssenza;
  soloMie?: boolean;
}): Promise<RichiesteAssenzaRisposta> {
  const accessToken = await getAccessToken();

  const parametri = new URLSearchParams();
  if (opzioni?.dataInizio) parametri.set("dataInizio", opzioni.dataInizio);
  if (opzioni?.dataFine) parametri.set("dataFine", opzioni.dataFine);
  if (opzioni?.stato) parametri.set("stato", opzioni.stato);
  if (opzioni?.soloMie) parametri.set("soloMie", "true");

  const query = parametri.toString();
  const response = await fetch(
    query ? `${API_ROUTES.ASSENZE}?${query}` : API_ROUTES.ASSENZE,
    {
      headers: {
        [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
    }
  );

  const payload = await leggiJsonResponse(response);

  if (!response.ok) {
    throw new Error(getMessaggioErroreApi(payload, ASSENZE_TESTI.ERRORI.GENERICO));
  }

  if (!isRisposta(payload)) {
    throw new Error(ASSENZE_TESTI.ERRORI.RISPOSTA_NON_VALIDA);
  }

  return payload;
}
