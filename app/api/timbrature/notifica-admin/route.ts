import type { NextRequest } from "next/server";

import { HTTP_STATUS } from "@/constants/api";
import { TIMBRATURE } from "@/constants/stati";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRecord } from "@/lib/typeGuards";
import { notificaAdminTimbratura } from "@/services/timbrature/notificaAdminTimbratura";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;
const FINESTRA_VALIDITA_MS = 5 * 60 * 1000;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

// Chiamata fire-and-forget dal client subito dopo un'ENTRATA/USCITA: qui si
// riverifica che l'evento sia realmente appena successo (mai fidarsi del
// client sul "tipo" dichiarato) prima di disturbare l'admin.
export async function POST(request: NextRequest) {
  const accessToken = estraiBearerToken(request);
  if (!accessToken) {
    return jsonErrore("Token mancante", HTTP_STATUS.UNAUTHORIZED);
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user) {
    return jsonErrore("Token non valido", HTTP_STATUS.UNAUTHORIZED);
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (
    !isRecord(body) ||
    (body.tipo !== TIMBRATURE.ENTRATA && body.tipo !== TIMBRATURE.USCITA)
  ) {
    return jsonErrore("Tipo non valido", HTTP_STATUS.BAD_REQUEST);
  }

  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  if (!dipendente) {
    return jsonErrore("Dipendente non trovato", HTTP_STATUS.FORBIDDEN);
  }

  const { data: ultima } = await supabaseAdmin
    .from("timbrature")
    .select("tipo, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const recente =
    ultima && Date.now() - new Date(ultima.created_at).getTime() < FINESTRA_VALIDITA_MS;

  if (!ultima || ultima.tipo !== body.tipo || !recente) {
    return jsonErrore("Nessuna timbratura recente corrispondente", HTTP_STATUS.CONFLICT);
  }

  await notificaAdminTimbratura({
    dipendenteId: dipendente.id,
    tipo: body.tipo,
    orario: new Date(ultima.created_at),
  });

  return Response.json({ ok: true }, { headers: NO_STORE });
}
