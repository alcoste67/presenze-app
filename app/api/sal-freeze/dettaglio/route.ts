import type { NextRequest } from "next/server";

import { API_HEADERS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import type {
  SalFreezeDettaglio,
  SalFreezeFoto,
  SalFreezeFotoPreview,
  SalFreezeLavorazione,
  SalFreezeMacchinario,
  SalFreezeMensile,
} from "@/types/salFreeze";

export const runtime = "nodejs";

const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

const SELECT_SAL_FREEZE_MENSILE =
  "id, cantiere_id, period_start, period_end, freeze_at, created_by, note, metadata, annullato_at, annullato_by";
const SELECT_SAL_FREEZE_LAVORAZIONI =
  "id, freeze_id, lavorazione_id, lavorazione_nome_snapshot, percentuale_precedente, percentuale_attuale, delta_percentuale, ore_uomo_minuti, ordine, created_at";
const SELECT_SAL_FREEZE_FOTO =
  "id, freeze_id, cantiere_id, sal_foto_id, lavorazione_id, data_riferimento, storage_path_snapshot, descrizione, ordine, created_at";
const SELECT_SAL_FREEZE_MACCHINARI =
  "id, freeze_id, macchinario_id, tipo_macchinario_snapshot, descrizione_snapshot, ore_utilizzo, note, ordine, created_at";

function jsonErrore(error: string, status: number) {
  return Response.json(
    { success: false, error },
    { status, headers: NO_STORE_HEADERS }
  );
}

function estraiBearerToken(request: NextRequest) {
  const authorization = request.headers.get(
    API_HEADERS.AUTHORIZATION
  );

  if (
    !authorization?.startsWith(
      API_HEADERS.BEARER_PREFIX
    )
  ) {
    return null;
  }

  const token = authorization
    .slice(API_HEADERS.BEARER_PREFIX.length)
    .trim();

  return token || null;
}

function leggiFreezeId(request: NextRequest) {
  const freezeId = request.nextUrl.searchParams.get(
    "freezeId"
  );

  if (!freezeId?.trim()) {
    return null;
  }

  return freezeId.trim();
}

function estraiStoragePath(
  storagePathSnapshot: string
): { bucket: string; path: string } | null {
  const separatorIndex =
    storagePathSnapshot.indexOf("/");

  if (separatorIndex <= 0) {
    return null;
  }

  const bucket = storagePathSnapshot.slice(
    0,
    separatorIndex
  );
  const path = storagePathSnapshot.slice(
    separatorIndex + 1
  );

  if (!bucket || !path) {
    return null;
  }

  return { bucket, path };
}

async function aggiungiPreviewFoto({
  foto,
}: {
  foto: SalFreezeFoto[];
}): Promise<SalFreezeFotoPreview[]> {
  return Promise.all(
    foto.map(async (item) => {
      const storage = estraiStoragePath(
        item.storage_path_snapshot
      );

      if (!storage) {
        return {
          ...item,
          preview_url: null,
        };
      }

      const { data, error } = await supabaseAdmin.storage
        .from(storage.bucket)
        .createSignedUrl(storage.path, 60 * 15);

      if (error) {
        return {
          ...item,
          preview_url: null,
        };
      }

      return {
        ...item,
        preview_url: data?.signedUrl || null,
      };
    })
  );
}

export async function GET(request: NextRequest) {
  const accessToken = estraiBearerToken(request);

  if (!accessToken) {
    return jsonErrore(
      "Token autenticazione mancante",
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user?.email) {
    return jsonErrore(
      "Token autenticazione non valido",
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const utenteAdmin = await isAdmin(
    user.email,
    supabaseAdmin
  );
  const utenteResponsabile = utenteAdmin
    ? true
    : await isResponsabile(user.email, supabaseAdmin);

  if (!utenteAdmin && !utenteResponsabile) {
    return jsonErrore(
      "Accesso non autorizzato",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const freezeId = leggiFreezeId(request);

  if (!freezeId) {
    return jsonErrore(
      "Freeze SAL obbligatorio",
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const [
    freezeResult,
    lavorazioniResult,
    fotoResult,
    macchinariResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("sal_freeze_mensili")
      .select(SELECT_SAL_FREEZE_MENSILE)
      .eq("id", freezeId)
      .maybeSingle(),
    supabaseAdmin
      .from("sal_freeze_lavorazioni")
      .select(SELECT_SAL_FREEZE_LAVORAZIONI)
      .eq("freeze_id", freezeId)
      .order("ordine", { ascending: true }),
    supabaseAdmin
      .from("sal_freeze_foto")
      .select(SELECT_SAL_FREEZE_FOTO)
      .eq("freeze_id", freezeId)
      .order("ordine", { ascending: true }),
    supabaseAdmin
      .from("sal_freeze_macchinari")
      .select(SELECT_SAL_FREEZE_MACCHINARI)
      .eq("freeze_id", freezeId)
      .order("ordine", { ascending: true }),
  ]);

  if (freezeResult.error) {
    console.error("[sal-freeze-dettaglio-error]", {
      freezeId,
      step: "freeze",
      errorMessage: freezeResult.error.message,
    });

    return jsonErrore(
      "Errore lettura dettaglio SAL periodo",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  if (lavorazioniResult.error) {
    console.error("[sal-freeze-dettaglio-error]", {
      freezeId,
      step: "lavorazioni",
      errorMessage: lavorazioniResult.error.message,
    });

    return jsonErrore(
      "Errore lettura dettaglio SAL periodo",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  if (fotoResult.error) {
    console.error("[sal-freeze-dettaglio-error]", {
      freezeId,
      step: "foto",
      errorMessage: fotoResult.error.message,
    });

    return jsonErrore(
      "Errore lettura dettaglio SAL periodo",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  if (macchinariResult.error) {
    console.error("[sal-freeze-dettaglio-error]", {
      freezeId,
      step: "macchinari",
      errorMessage: macchinariResult.error.message,
    });

    return jsonErrore(
      "Errore lettura dettaglio SAL periodo",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }

  const freeze = freezeResult.data as
    | SalFreezeMensile
    | null;

  if (!freeze) {
    return jsonErrore(
      "SAL periodo non trovato",
      HTTP_STATUS.NOT_FOUND
    );
  }

  const foto = await aggiungiPreviewFoto({
    foto: (fotoResult.data || []) as SalFreezeFoto[],
  });

  const dettaglio: SalFreezeDettaglio = {
    freeze,
    lavorazioni: (lavorazioniResult.data ||
      []) as SalFreezeLavorazione[],
    foto,
    macchinari: (macchinariResult.data ||
      []) as SalFreezeMacchinario[],
  };

  console.log("[sal-freeze-dettaglio]", {
    freezeId,
    cantiereId: freeze.cantiere_id,
    fotoCount: foto.length,
    lavorazioniCount: dettaglio.lavorazioni.length,
    macchinariCount: dettaglio.macchinari.length,
  });

  return Response.json(
    {
      success: true,
      dettaglio,
    },
    {
      status: 200,
      headers: NO_STORE_HEADERS,
    }
  );
}
