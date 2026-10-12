import { HTTP_STATUS } from "@/constants/api";
import { RIMBORSI_KM_TESTI } from "@/constants/rimborsiKm";
import { RUOLI_APPROVA_NOTE_SPESE } from "@/constants/noteSpese";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadRimborsiKmMensili } from "@/services/noteSpese/loadRimborsiKmMensili";

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

function puoVedereRimborsi(ruolo: string): boolean {
  return (RUOLI_APPROVA_NOTE_SPESE as readonly string[]).includes(ruolo);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(RIMBORSI_KM_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const dipendente = await getDipendenteChiamante(accessToken);
    if (!dipendente) {
      return jsonErrore(RIMBORSI_KM_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    if (!puoVedereRimborsi(dipendente.ruolo)) {
      return jsonErrore(RIMBORSI_KM_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
    }

    const { searchParams } = new URL(request.url);
    const anno = Number(searchParams.get("anno"));
    const mese = Number(searchParams.get("mese"));

    if (
      !Number.isInteger(anno) ||
      anno < 2000 ||
      anno > 2100 ||
      !Number.isInteger(mese) ||
      mese < 1 ||
      mese > 12
    ) {
      return jsonErrore(RIMBORSI_KM_TESTI.ERRORI.MESE_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
    }

    const righe = await loadRimborsiKmMensili({
      aziendaId: dipendente.azienda_id,
      anno,
      mese,
      supabaseClient: supabaseAdmin,
    });

    return Response.json({ anno, mese, righe }, { headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Errore caricamento rimborsi chilometrici", error);
    return jsonErrore(RIMBORSI_KM_TESTI.ERRORI.GENERICO, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
