import { isRecord } from "@/lib/typeGuards";
import { HTTP_STATUS } from "@/constants/api";
import {
  PIANIFICAZIONI_TESTI,
  RUOLI_MODIFICA_PIANIFICAZIONI,
} from "@/constants/pianificazioni";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { aggiornaPianificazione } from "@/services/pianificazioni/aggiornaPianificazione";
import { eliminaPianificazione } from "@/services/pianificazioni/eliminaPianificazione";
import { validaInputPianificazione } from "@/services/pianificazioni/validaInputPianificazione";
import type { PianificazioneInput } from "@/types/pianificazioni";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

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

async function autorizzaModifica(
  request: Request
): Promise<
  | { ok: true; dipendente: DipendenteChiamante }
  | { ok: false; risposta: Response }
> {
  const accessToken = estraiBearerToken(request);
  if (!accessToken) {
    return {
      ok: false,
      risposta: jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      ),
    };
  }

  const dipendente = await getDipendenteChiamante(accessToken);
  if (!dipendente) {
    return {
      ok: false,
      risposta: jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.TOKEN_NON_VALIDO,
        HTTP_STATUS.UNAUTHORIZED
      ),
    };
  }

  if (!puoModificare(dipendente.ruolo)) {
    return {
      ok: false,
      risposta: jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      ),
    };
  }

  return { ok: true, dipendente };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const autorizzazione = await autorizzaModifica(request);
    if (!autorizzazione.ok) return autorizzazione.risposta;

    const body = await request.json().catch(() => null);
    const input = leggiInputPianificazione(body);
    if (!input) {
      return jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.GENERICO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const erroreInput = await validaInputPianificazione({
      aziendaId: autorizzazione.dipendente.azienda_id,
      input,
      supabaseClient: supabaseAdmin,
    });
    if (erroreInput) {
      return jsonErrore(erroreInput, HTTP_STATUS.BAD_REQUEST);
    }

    const aggiornata = await aggiornaPianificazione({
      pianificazioneId: id,
      aziendaId: autorizzazione.dipendente.azienda_id,
      input,
      supabaseClient: supabaseAdmin,
    });

    if (!aggiornata) {
      return jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.NON_TROVATA,
        HTTP_STATUS.NOT_FOUND
      );
    }

    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Errore aggiornamento pianificazione", error);
    return jsonErrore(
      PIANIFICAZIONI_TESTI.ERRORI.SALVATAGGIO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const autorizzazione = await autorizzaModifica(request);
    if (!autorizzazione.ok) return autorizzazione.risposta;

    const eliminata = await eliminaPianificazione({
      pianificazioneId: id,
      aziendaId: autorizzazione.dipendente.azienda_id,
      supabaseClient: supabaseAdmin,
    });

    if (!eliminata) {
      return jsonErrore(
        PIANIFICAZIONI_TESTI.ERRORI.NON_TROVATA,
        HTTP_STATUS.NOT_FOUND
      );
    }

    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Errore eliminazione pianificazione", error);
    return jsonErrore(
      PIANIFICAZIONI_TESTI.ERRORI.ELIMINAZIONE,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
