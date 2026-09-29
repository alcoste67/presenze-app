import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import { risolviModuliAbilitati } from "@/lib/moduliAbilitatiServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request): Promise<Response> {
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
    .select("azienda_id")
    .eq("auth_user_id", user.id)
    .eq("attivo", true)
    .maybeSingle();

  if (!dipendente) {
    return jsonErrore("Accesso non autorizzato", HTTP_STATUS.FORBIDDEN);
  }

  const { data: azienda } = await supabaseAdmin
    .from("aziende")
    .select("piano")
    .eq("id", dipendente.azienda_id)
    .maybeSingle();

  const moduli = await risolviModuliAbilitati(
    dipendente.azienda_id as string,
    (azienda?.piano as string | null) ?? null
  );

  return Response.json({ moduli }, { headers: NO_STORE_HEADERS });
}
