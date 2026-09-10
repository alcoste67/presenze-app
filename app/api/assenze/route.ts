import { isRecord } from "@/lib/typeGuards";
import { HTTP_STATUS } from "@/constants/api";
import {
  ASSENZE_TESTI,
  RUOLI_APPROVA_ASSENZE,
  TIPO_ASSENZA,
} from "@/constants/assenze";
import { RUOLI_MODIFICA_PIANIFICAZIONI } from "@/constants/pianificazioni";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { creaRichiestaAssenza } from "@/services/assenze/creaRichiestaAssenza";
import { loadRichiesteAssenza } from "@/services/assenze/loadRichiesteAssenza";
import type {
  RichiestaAssenzaInput,
  StatoRichiestaAssenza,
} from "@/types/assenze";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const DATA_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const STATI_VALIDI: readonly StatoRichiestaAssenza[] = [
  "IN_ATTESA",
  "APPROVATA",
  "RIFIUTATA",
];

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

function puoApprovare(ruolo: string): boolean {
  return (RUOLI_APPROVA_ASSENZE as readonly string[]).includes(ruolo);
}

function vedeTutteLeAssenze(ruolo: string): boolean {
  return (RUOLI_MODIFICA_PIANIFICAZIONI as readonly string[]).includes(ruolo);
}

function isDataValida(value: string): boolean {
  return DATA_PATTERN.test(value);
}

function leggiInput(body: unknown): RichiestaAssenzaInput | null {
  if (!isRecord(body)) return null;

  if (body.tipo !== TIPO_ASSENZA.FERIE && body.tipo !== TIPO_ASSENZA.PERMESSO) {
    return null;
  }
  if (typeof body.dataInizio !== "string" || !isDataValida(body.dataInizio)) {
    return null;
  }
  if (typeof body.dataFine !== "string" || !isDataValida(body.dataFine)) {
    return null;
  }
  if (typeof body.giornataIntera !== "boolean") {
    return null;
  }

  const ore =
    typeof body.ore === "number" && Number.isFinite(body.ore)
      ? body.ore
      : null;

  return {
    tipo: body.tipo,
    dataInizio: body.dataInizio,
    dataFine: body.dataFine,
    giornataIntera: body.giornataIntera,
    ore,
    nota: typeof body.nota === "string" ? body.nota : "",
  };
}

function getErroreInput(input: RichiestaAssenzaInput): string | null {
  if (input.dataFine < input.dataInizio) {
    return ASSENZE_TESTI.ERRORI.INTERVALLO_NON_VALIDO;
  }

  if (!input.giornataIntera) {
    if (input.dataInizio !== input.dataFine) {
      return ASSENZE_TESTI.ERRORI.PARZIALE_UN_GIORNO;
    }
    if (!input.ore || input.ore <= 0) {
      return ASSENZE_TESTI.ERRORI.ORE_OBBLIGATORIE;
    }
  }

  return null;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const dipendente = await getDipendenteChiamante(accessToken);
    if (!dipendente) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const { searchParams } = new URL(request.url);
    const dataInizio = searchParams.get("dataInizio");
    const dataFine = searchParams.get("dataFine");
    const statoParam = searchParams.get("stato");
    const stato =
      statoParam && (STATI_VALIDI as readonly string[]).includes(statoParam)
        ? (statoParam as StatoRichiestaAssenza)
        : undefined;

    const puoApprovareRuolo = puoApprovare(dipendente.ruolo);
    const soloMie = searchParams.get("soloMie") === "true";

    const richieste = await loadRichiesteAssenza({
      aziendaId: dipendente.azienda_id,
      dipendenteId: dipendente.id,
      vedeTutte: vedeTutteLeAssenze(dipendente.ruolo) && !soloMie,
      stato,
      periodo: dataInizio && dataFine ? { dataInizio, dataFine } : undefined,
      supabaseClient: supabaseAdmin,
    });

    return Response.json(
      { richieste, puoApprovare: puoApprovareRuolo },
      { headers: NO_STORE }
    );
  } catch (error: unknown) {
    console.error("Errore caricamento richieste assenza", error);
    return jsonErrore(ASSENZE_TESTI.ERRORI.GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const dipendente = await getDipendenteChiamante(accessToken);
    if (!dipendente) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const body = await request.json().catch(() => null);
    const input = leggiInput(body);
    if (!input) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.GENERICO, HTTP_STATUS.BAD_REQUEST);
    }

    const erroreInput = getErroreInput(input);
    if (erroreInput) {
      return jsonErrore(erroreInput, HTTP_STATUS.BAD_REQUEST);
    }

    const id = await creaRichiestaAssenza({
      aziendaId: dipendente.azienda_id,
      dipendenteId: dipendente.id,
      input,
      supabaseClient: supabaseAdmin,
    });

    return Response.json({ ok: true, id }, { headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Errore creazione richiesta assenza", error);
    return jsonErrore(ASSENZE_TESTI.ERRORI.SALVATAGGIO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
