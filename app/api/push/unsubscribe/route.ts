import type { NextRequest } from "next/server";

import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isRecord } from "@/lib/typeGuards";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

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

  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("id")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  if (!dipendente) {
    return jsonErrore("Dipendente non trovato", HTTP_STATUS.FORBIDDEN);
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!isRecord(body) || typeof body.endpoint !== "string") {
    return jsonErrore("Endpoint mancante", HTTP_STATUS.BAD_REQUEST);
  }

  // Solo il dipendente proprietario della subscription puo' rimuoverla.
  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("dipendente_id", dipendente.id);

  if (error) {
    console.error("Errore rimozione push subscription", error);
    return jsonErrore("Errore rimozione", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }

  return Response.json({ ok: true }, { headers: NO_STORE });
}
