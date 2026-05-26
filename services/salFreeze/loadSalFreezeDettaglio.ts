import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { SAL_FREEZE_TESTI } from "@/constants/salFreeze";
import { supabase } from "@/lib/supabase";
import type {
  SalFreezeDettaglio,
  SalFreezeFotoPreview,
  SalFreezeLavorazione,
  SalFreezeMacchinario,
  SalFreezeMensile,
} from "@/types/salFreeze";

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

export async function loadSalFreezeDettaglio({
  freezeId,
  supabaseClient = supabase,
}: {
  freezeId: string;
  supabaseClient?: SupabaseClient;
}): Promise<SalFreezeDettaglio | null> {
  if (!freezeId) {
    return null;
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
    `${API_ROUTES.SAL_FREEZE_DETTAGLIO}?freezeId=${encodeURIComponent(freezeId)}`,
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
    const errorMessage =
      isRecord(payload) &&
      typeof payload.error === "string"
        ? payload.error
        : SAL_FREEZE_TESTI.ERRORI.GENERICO;

    if (response.status === 404) {
      return null;
    }

    throw new Error(errorMessage);
  }

  const dettaglio =
    isRecord(payload) &&
    isRecord(payload.dettaglio)
      ? (payload.dettaglio as SalFreezeDettaglio)
      : isRecord(payload) &&
          isRecord(payload.freeze) &&
          Array.isArray(payload.lavorazioni) &&
          Array.isArray(payload.foto) &&
          Array.isArray(payload.macchinari)
        ? ({
            freeze: payload.freeze as SalFreezeMensile,
            lavorazioni: payload.lavorazioni as SalFreezeLavorazione[],
            foto: payload.foto as SalFreezeFotoPreview[],
            macchinari: payload.macchinari as SalFreezeMacchinario[],
          } as SalFreezeDettaglio)
        : null;

  if (!dettaglio?.freeze) {
    return null;
  }

  return dettaglio;
}
