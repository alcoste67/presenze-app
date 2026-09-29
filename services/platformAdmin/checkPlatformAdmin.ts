import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { supabase } from "@/lib/supabase";

/** true solo per le email in PLATFORM_ADMIN_EMAILS — usato solo per decidere se mostrare il link al pannello /superadmin. */
export async function checkPlatformAdmin(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return false;

  try {
    const response = await fetch(API_ROUTES.PLATFORM_ADMIN_CHECK, {
      headers: {
        [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as { ok?: boolean };
    return Boolean(payload.ok);
  } catch {
    return false;
  }
}
