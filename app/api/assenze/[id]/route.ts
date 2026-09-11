import { isRecord } from "@/lib/typeGuards";
import { HTTP_STATUS } from "@/constants/api";
import { ASSENZE_TESTI, RUOLI_APPROVA_ASSENZE } from "@/constants/assenze";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { aggiornaStatoRichiesta } from "@/services/assenze/aggiornaStatoRichiesta";
import { annullaRichiesta } from "@/services/assenze/annullaRichiesta";

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

function puoApprovare(ruolo: string): boolean {
  return (RUOLI_APPROVA_ASSENZE as readonly string[]).includes(ruolo);
}

async function getProprietarioRichiesta(
  richiestaId: string,
  aziendaId: string
): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("richieste_assenza")
    .select("dipendente_id")
    .eq("id", richiestaId)
    .eq("azienda_id", aziendaId)
    .maybeSingle();

  return data?.dipendente_id || null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;

    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const dipendente = await getDipendenteChiamante(accessToken);
    if (!dipendente) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const body = await request.json().catch(() => null);
    if (
      !isRecord(body) ||
      (body.stato !== "APPROVATA" &&
        body.stato !== "RIFIUTATA" &&
        body.stato !== "ANNULLATA")
    ) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.GENERICO, HTTP_STATUS.BAD_REQUEST);
    }

    if (body.stato === "ANNULLATA") {
      const proprietarioId = await getProprietarioRichiesta(
        id,
        dipendente.azienda_id
      );

      if (!proprietarioId) {
        return jsonErrore(ASSENZE_TESTI.ERRORI.NON_TROVATA, HTTP_STATUS.NOT_FOUND);
      }

      const eProprietario = proprietarioId === dipendente.id;
      if (!eProprietario && !puoApprovare(dipendente.ruolo)) {
        return jsonErrore(ASSENZE_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
      }

      const annullata = await annullaRichiesta({
        richiestaId: id,
        aziendaId: dipendente.azienda_id,
        annullataDa: dipendente.id,
        supabaseClient: supabaseAdmin,
      });

      if (!annullata) {
        return jsonErrore(ASSENZE_TESTI.ERRORI.NON_TROVATA, HTTP_STATUS.NOT_FOUND);
      }

      return Response.json({ ok: true }, { headers: NO_STORE });
    }

    if (!puoApprovare(dipendente.ruolo)) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
    }

    const aggiornata = await aggiornaStatoRichiesta({
      richiestaId: id,
      aziendaId: dipendente.azienda_id,
      stato: body.stato,
      approvataDa: dipendente.id,
      supabaseClient: supabaseAdmin,
    });

    if (!aggiornata) {
      return jsonErrore(ASSENZE_TESTI.ERRORI.NON_TROVATA, HTTP_STATUS.NOT_FOUND);
    }

    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error: unknown) {
    console.error("Errore aggiornamento richiesta assenza", error);
    return jsonErrore(
      ASSENZE_TESTI.ERRORI.AGGIORNAMENTO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
