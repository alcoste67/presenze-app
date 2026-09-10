import { isRecord } from "@/lib/typeGuards";
import { HTTP_STATUS } from "@/constants/api";
import {
  PIANIFICAZIONI_LIMITI,
  PIANIFICAZIONI_TESTI,
  RUOLI_MODIFICA_PIANIFICAZIONI,
} from "@/constants/pianificazioni";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { creaPianificazione } from "@/services/pianificazioni/creaPianificazione";
import { loadPianificazioni } from "@/services/pianificazioni/loadPianificazioni";
import { validaInputPianificazione } from "@/services/pianificazioni/validaInputPianificazione";
import type {
  PianificazioneInput,
  PianificazioniFiltri,
} from "@/types/pianificazioni";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const DATA_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

type DipendenteChiamante = {
  id: string;
  azienda_id: string;
  ruolo: string;
};

async function getDipendenteChiamante(
  accessToken: string
): Promise<DipendenteChiamante | null> {
  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) return null;

  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("id, azienda_id, ruolo")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  return (dipendente as DipendenteChiamante | null) || null;
}

function puoModificare(ruolo: string): boolean {
  return (RUOLI_MODIFICA_PIANIFICAZIONI as readonly string[]).includes(ruolo);
}

function parseDataInput(value: string): Date | null {
  const match = DATA_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const data = new Date(Date.UTC(year, month - 1, day));

  if (
    data.getUTCFullYear() !== year ||
    data.getUTCMonth() !== month - 1 ||
    data.getUTCDate() !== day
  ) {
    return null;
  }

  return data;
}

function getFiltriDaQuery(searchParams: URLSearchParams): PianificazioniFiltri | null {
  const dataInizio = searchParams.get("dataInizio") || "";
  const dataFine = searchParams.get("dataFine") || "";

  if (!dataInizio || !dataFine) return null;

  return { dataInizio, dataFine };
}

function getErroreFiltri(filtri: PianificazioniFiltri): string | null {
  const inizio = parseDataInput(filtri.dataInizio);
  const fine = parseDataInput(filtri.dataFine);

  if (!inizio || !fine) {
    return PIANIFICAZIONI_TESTI.ERRORI.FILTRI_NON_VALIDI;
  }

  const giorni =
    Math.floor((fine.getTime() - inizio.getTime()) / MS_PER_DAY) + 1;

  if (giorni <= 0) {
    return PIANIFICAZIONI_TESTI.ERRORI.INTERVALLO_NON_VALIDO;
  }

  if (giorni > PIANIFICAZIONI_LIMITI.MAX_GIORNI) {
    return `${PIANIFICAZIONI_TESTI.ERRORI.INTERVALLO_MASSIMO_PREFIX} ${PIANIFICAZIONI_LIMITI.MAX_GIORNI} ${PIANIFICAZIONI_TESTI.ERRORI.INTERVALLO_MASSIMO_SUFFIX}`;
  }

  return null;
}

function normalizzaIdArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (!value.every((v) => typeof v === "string")) return undefined;
  return value;
}

function leggiInputPianificazione(body: unknown): PianificazioneInput | null {
  if (!isRecord(body)) return null;
  if (typeof body.cantiereId !== "string" || !body.cantiereId) return null;
  if (typeof body.data !== "string" || !body.data) return null;

  const dipendentiIds = normalizzaIdArray(body.dipendentiIds);
  const macchinariIds = normalizzaIdArray(body.macchinariIds);

  if (!dipendentiIds || !macchinariIds) return null;

  return {
    cantiereId: body.cantiereId,
    data: body.data,
    note: typeof body.note === "string" ? body.note : "",
    dipendentiIds,
    macchinariIds,
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const dipendente = await getDipendenteChiamante(accessToken);
    if (!dipendente) {
      return jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.TOKEN_NON_VALIDO,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const { searchParams } = new URL(request.url);
    const filtri = getFiltriDaQuery(searchParams);
    if (!filtri) {
      return jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.DATE_OBBLIGATORIE,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const erroreFiltri = getErroreFiltri(filtri);
    if (erroreFiltri) {
      return jsonErrore(erroreFiltri, HTTP_STATUS.BAD_REQUEST);
    }

    const vedeTutte = puoModificare(dipendente.ruolo);

    const pianificazioni = await loadPianificazioni({
      aziendaId: dipendente.azienda_id,
      filtri,
      dipendenteId: dipendente.id,
      vedeTutte,
      supabaseClient: supabaseAdmin,
    });

    return Response.json(
      { pianificazioni, puoModificare: vedeTutte },
      { headers: NO_STORE }
    );
  } catch (error: unknown) {
    console.error("Errore caricamento pianificazioni", error);
    return jsonErrore(
      PIANIFICAZIONI_TESTI.ERRORI.GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const dipendente = await getDipendenteChiamante(accessToken);
    if (!dipendente) {
      return jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.TOKEN_NON_VALIDO,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    if (!puoModificare(dipendente.ruolo)) {
      return jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const body = await request.json().catch(() => null);
    const input = leggiInputPianificazione(body);
    if (!input) {
      return jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.GENERICO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const erroreInput = await validaInputPianificazione({
      aziendaId: dipendente.azienda_id,
      input,
      supabaseClient: supabaseAdmin,
    });
    if (erroreInput) {
      return jsonErrore(erroreInput, HTTP_STATUS.BAD_REQUEST);
    }

    const pianificazioneId = await creaPianificazione({
      aziendaId: dipendente.azienda_id,
      creatoDa: dipendente.id,
      input,
      supabaseClient: supabaseAdmin,
    });

    return Response.json(
      { ok: true, id: pianificazioneId },
      { headers: NO_STORE }
    );
  } catch (error: unknown) {
    console.error("Errore creazione pianificazione", error);
    return jsonErrore(
      PIANIFICAZIONI_TESTI.ERRORI.SALVATAGGIO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
