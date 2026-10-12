import type { NextRequest } from "next/server";

import { HTTP_STATUS } from "@/constants/api";
import { BLOCCO_GIORNO_PRECEDENTE_TESTI } from "@/constants/bloccoGiornoPrecedente";
import { estraiBearerToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verificaBloccoGiorno } from "@/services/timbrature/verificaBloccoGiorno";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE });
}

export async function GET(request: NextRequest): Promise<Response> {
  const accessToken = estraiBearerToken(request);
  if (!accessToken) {
    return jsonErrore(
      BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.NON_AUTORIZZATO,
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !user) {
    return jsonErrore(
      BLOCCO_GIORNO_PRECEDENTE_TESTI.ERRORI.NON_AUTORIZZATO,
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const { data: dipendente } = await supabaseAdmin
    .from("dipendenti")
    .select("id, auth_user_id, created_at, tipo_conteggio_ore")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  if (!dipendente?.auth_user_id) {
    return Response.json({ blocco: null }, { headers: NO_STORE });
  }

  const blocco = await verificaBloccoGiorno({
    dipendenteId: dipendente.id,
    authUserId: dipendente.auth_user_id,
    createdAt: dipendente.created_at,
    tipoConteggioOre: dipendente.tipo_conteggio_ore,
    supabaseClient: supabaseAdmin,
  });

  return Response.json({ blocco }, { headers: NO_STORE });
}
