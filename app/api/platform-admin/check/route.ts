import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import { isPlatformAdminEmail } from "@/lib/platformAdmin";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

// Solo per decidere se mostrare il link al pannello /superadmin in giro
// per l'app: l'autorizzazione vera resta nelle route /api/superadmin/*.
export async function GET(request: Request): Promise<Response> {
  const accessToken = estraiBearerToken(request);
  if (!accessToken) {
    return Response.json({ ok: false }, { status: HTTP_STATUS.UNAUTHORIZED, headers: NO_STORE_HEADERS });
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (error || !user?.email) {
    return Response.json({ ok: false }, { status: HTTP_STATUS.UNAUTHORIZED, headers: NO_STORE_HEADERS });
  }

  return Response.json(
    { ok: isPlatformAdminEmail(user.email) },
    { headers: NO_STORE_HEADERS }
  );
}
