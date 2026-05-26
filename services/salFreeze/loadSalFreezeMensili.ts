import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { SAL_FREEZE_TESTI } from "@/constants/salFreeze";
import { supabase } from "@/lib/supabase";
import type { SalFreezeMensile } from "@/types/salFreeze";

type SupabaseClient = typeof supabase;

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getErrorMessage(payload: unknown) {
  if (!isRecord(payload)) {
    return SAL_FREEZE_TESTI.ERRORI.GENERICO;
  }

  if (
    typeof payload.errorMessage === "string" &&
    payload.errorMessage.trim()
  ) {
    return payload.errorMessage.trim();
  }

  if (
    typeof payload.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error.trim();
  }

  return SAL_FREEZE_TESTI.ERRORI.GENERICO;
}

export async function loadSalFreezeMensili({
  cantiereId,
  supabaseClient = supabase,
}: {
  cantiereId: string;
  supabaseClient?: SupabaseClient;
}): Promise<SalFreezeMensile[]> {
  if (!cantiereId) {
    return [];
  }

  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError) {
    throw new Error(
      SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO
    );
  }

  const accessToken =
    sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error(
      SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO
    );
  }

  const response = await fetch(
    `${API_ROUTES.SAL_FREEZE_MENSILI}?cantiereId=${encodeURIComponent(cantiereId)}`,
    {
      headers: {
        [API_HEADERS.AUTHORIZATION]:
          `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
      },
    }
  );

  const payload = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  const freezeList =
    isRecord(payload) &&
    Array.isArray(payload.freeze)
      ? (payload.freeze as SalFreezeMensile[])
      : isRecord(payload) &&
          Array.isArray(payload.freezeList)
        ? (payload.freezeList as SalFreezeMensile[])
        : isRecord(payload) &&
            Array.isArray(payload.data)
          ? (payload.data as SalFreezeMensile[])
          : [];

  console.log("[sal-freeze-mensili-loader]", {
    cantiereId,
    freezeCount: freezeList.length,
  });

  return freezeList;
}
