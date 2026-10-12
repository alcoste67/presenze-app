import { isRecord } from "@/lib/typeGuards";
import { HTTP_STATUS } from "@/constants/api";
import { NOTE_SPESE_LIMITI, NOTE_SPESE_TESTI, TIPO_SPESA } from "@/constants/noteSpese";
import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { creaNotaSpesa } from "@/services/noteSpese/creaNotaSpesa";
import { loadNoteSpese } from "@/services/noteSpese/loadNoteSpese";
import type { NotaSpesaInput, StatoNotaSpesa } from "@/types/noteSpese";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const DATA_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STATI_VALIDI: readonly StatoNotaSpesa[] = ["IN_ATTESA", "APPROVATA", "RIFIUTATA"];
const TIPI_VALIDI: readonly string[] = Object.values(TIPO_SPESA);
const RUOLI_VEDE_TUTTE: readonly string[] = [RUOLI_DIPENDENTE.ADMIN, RUOLI_DIPENDENTE.SUPERADMIN];

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

type DipendenteChiamante = {
  id: string;
  azienda_id: string;
  ruolo: string;
};

async function getDipendenteChiamante(accessToken: string): Promise<DipendenteChiamante | null> {
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

function isDataValida(value: string): boolean {
  return DATA_PATTERN.test(value);
}

function leggiInput(body: unknown): NotaSpesaInput | null {
  if (!isRecord(body)) return null;

  if (typeof body.data !== "string" || !isDataValida(body.data)) return null;
  if (typeof body.tipo !== "string" || !TIPI_VALIDI.includes(body.tipo)) return null;
  if (typeof body.importo !== "number" || !Number.isFinite(body.importo) || body.importo <= 0) {
    return null;
  }
  if (body.importo > NOTE_SPESE_LIMITI.IMPORTO_MASSIMO) return null;
  if (typeof body.fotoScontrinoPath !== "string" || !body.fotoScontrinoPath) return null;

  return {
    data: body.data,
    tipo: body.tipo as NotaSpesaInput["tipo"],
    importo: body.importo,
    descrizione: typeof body.descrizione === "string" ? body.descrizione.trim() : "",
    fotoScontrinoPath: body.fotoScontrinoPath,
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const dipendente = await getDipendenteChiamante(accessToken);
    if (!dipendente) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const { searchParams } = new URL(request.url);
    const dataInizio = searchParams.get("dataInizio");
    const dataFine = searchParams.get("dataFine");
    const statoParam = searchParams.get("stato");
    const stato =
      statoParam && (STATI_VALIDI as readonly string[]).includes(statoParam)
        ? (statoParam as StatoNotaSpesa)
        : undefined;
    const soloMie = searchParams.get("soloMie") === "true";

    const note = await loadNoteSpese({
      aziendaId: dipendente.azienda_id,
      dipendenteId: dipendente.id,
      vedeTutte: RUOLI_VEDE_TUTTE.includes(dipendente.ruolo) && !soloMie,
      stato,
      periodo: dataInizio && dataFine ? { dataInizio, dataFine } : undefined,
      supabaseClient: supabaseAdmin,
    });

    return Response.json({ note }, { headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Errore caricamento note spese", error);
    return jsonErrore(NOTE_SPESE_TESTI.ERRORI.CARICAMENTO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const dipendente = await getDipendenteChiamante(accessToken);
    if (!dipendente) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const body = await request.json().catch(() => null);
    const input = leggiInput(body);
    if (!input) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.GENERICO, HTTP_STATUS.BAD_REQUEST);
    }

    // Lo scontrino è già su Storage sotto {azienda_id}/...: verifica che
    // il path dichiarato appartenga davvero all'azienda del chiamante.
    if (!input.fotoScontrinoPath.startsWith(`${dipendente.azienda_id}/`)) {
      return jsonErrore(NOTE_SPESE_TESTI.ERRORI.GENERICO, HTTP_STATUS.BAD_REQUEST);
    }

    const id = await creaNotaSpesa({
      aziendaId: dipendente.azienda_id,
      dipendenteId: dipendente.id,
      input,
      supabaseClient: supabaseAdmin,
    });

    return Response.json({ ok: true, id }, { headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Errore creazione nota spesa", error);
    return jsonErrore(NOTE_SPESE_TESTI.ERRORI.SALVATAGGIO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
