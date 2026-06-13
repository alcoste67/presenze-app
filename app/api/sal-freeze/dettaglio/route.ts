import type { NextRequest } from "next/server";

import { API_HEADERS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
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

const ERRORI = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  FREEZE_OBBLIGATORIO: "Freeze SAL obbligatorio",
  DETTAGLIO_NON_DISPONIBILE:
    "Dettaglio SAL periodo non disponibile",
  LETTURA_DETTAGLIO:
    "Errore lettura dettaglio SAL periodo",
} as const;

const SELECT_SAL_FREEZE_MENSILE =
  "id, cantiere_id, period_start, period_end, freeze_at, created_by, note, metadata, annullato_at, annullato_by, stato, confermato_at, confermato_by";
const SELECT_SAL_FREEZE_LAVORAZIONI =
  "id, freeze_id, lavorazione_id, lavorazione_nome_snapshot, percentuale_precedente, percentuale_attuale, delta_percentuale, ore_uomo_minuti, ordine, created_at, unita_misura_snapshot, quantita_snapshot, prezzo_unitario_snapshot, importo_totale, importo_maturato, importo_periodo";
const SELECT_SAL_FREEZE_FOTO =
  "id, freeze_id, storage_path_snapshot, descrizione, data_riferimento, ordine";
const SELECT_SAL_FREEZE_MACCHINARI =
  "id, freeze_id, macchinario_id, tipo_macchinario_snapshot, descrizione_snapshot, ore_utilizzo, note, ordine, created_at";

function jsonErrore(
  errorMessage: string,
  status: number,
  details: {
    freezeId: string | null;
    step: string;
  }
) {
  return Response.json(
    {
      success: false,
      errorMessage,
      step: details.step,
      freezeId: details.freezeId,
    },
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
  storagePathSnapshot: string | null | undefined
): { bucket: string; path: string } | null {
  if (typeof storagePathSnapshot !== "string") {
    return null;
  }

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

function getPreviewUrlDaSnapshot(
  storagePathSnapshot: string | null | undefined
) {
  if (typeof storagePathSnapshot !== "string") {
    return null;
  }

  if (
    /^data:image\/(png|jpe?g|webp);base64,/i.test(
      storagePathSnapshot
    ) ||
    /^https?:\/\//i.test(storagePathSnapshot)
  ) {
    return storagePathSnapshot;
  }

  return null;
}

async function aggiungiPreviewFoto({
  foto,
}: {
  foto: SalFreezeFoto[];
}): Promise<SalFreezeFotoPreview[]> {
  try {
    return await Promise.all(
      foto.map(async (item) => {
        try {
          const storage = estraiStoragePath(
            item.storage_path_snapshot
          );

          if (!storage) {
            const directPreview = getPreviewUrlDaSnapshot(
              item.storage_path_snapshot
            );

            return {
              ...item,
              preview_url: directPreview,
            };
          }

          const { data, error } =
            await supabaseAdmin.storage
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
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Errore preview foto";

          console.warn("[sal-freeze-detail-photo-warning]", {
            storagePathSnapshot:
              item.storage_path_snapshot,
            errorMessage,
          });

          return {
            ...item,
            preview_url: null,
          };
        }
      })
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Errore preview foto";

    console.warn("[sal-freeze-detail-photo-warning]", {
      freezeId: null,
      errorMessage,
    });

    return [];
  }
}

export async function GET(request: NextRequest) {
  const freezeId = leggiFreezeId(request);

  try {
    const accessToken = estraiBearerToken(request);

    if (!accessToken) {
      return jsonErrore(
        ERRORI.TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED,
        { freezeId, step: "auth" }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(
        ERRORI.TOKEN_NON_VALIDO,
        HTTP_STATUS.UNAUTHORIZED,
        { freezeId, step: "auth" }
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
        ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN,
        { freezeId, step: "admin_check" }
      );
    }

    if (!freezeId) {
      return jsonErrore(
        ERRORI.FREEZE_OBBLIGATORIO,
        HTTP_STATUS.BAD_REQUEST,
        { freezeId: null, step: "input" }
      );
    }

    const aziendaId = await getAziendaIdFromAuthUser(supabaseAdmin, user.id);

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
        .eq("azienda_id", aziendaId)
        .maybeSingle(),
      supabaseAdmin
        .from("sal_freeze_lavorazioni")
        .select(SELECT_SAL_FREEZE_LAVORAZIONI)
        .eq("freeze_id", freezeId)
        .eq("azienda_id", aziendaId)
        .order("ordine", { ascending: true }),
      supabaseAdmin
        .from("sal_freeze_foto")
        .select(SELECT_SAL_FREEZE_FOTO)
        .eq("freeze_id", freezeId)
        .eq("azienda_id", aziendaId)
        .order("ordine", { ascending: true }),
      supabaseAdmin
        .from("sal_freeze_macchinari")
        .select(SELECT_SAL_FREEZE_MACCHINARI)
        .eq("freeze_id", freezeId)
        .eq("azienda_id", aziendaId)
        .order("ordine", { ascending: true }),
    ]);

    if (freezeResult.error) {
      console.error("[sal-freeze-detail-error]", {
        freezeId,
        step: "freeze",
        errorMessage: freezeResult.error.message,
      });

      return jsonErrore(
        ERRORI.LETTURA_DETTAGLIO,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        { freezeId, step: "freeze" }
      );
    }

    if (lavorazioniResult.error) {
      console.error("[sal-freeze-detail-error]", {
        freezeId,
        step: "lavorazioni",
        errorMessage: lavorazioniResult.error.message,
      });

      return jsonErrore(
        ERRORI.LETTURA_DETTAGLIO,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        { freezeId, step: "lavorazioni" }
      );
    }

    if (macchinariResult.error) {
      console.error("[sal-freeze-detail-error]", {
        freezeId,
        step: "macchinari",
        errorMessage: macchinariResult.error.message,
      });

      return jsonErrore(
        ERRORI.LETTURA_DETTAGLIO,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        { freezeId, step: "macchinari" }
      );
    }

    const freeze = freezeResult.data as
      | SalFreezeMensile
      | null;

    if (!freeze) {
      return jsonErrore(
        ERRORI.DETTAGLIO_NON_DISPONIBILE,
        HTTP_STATUS.NOT_FOUND,
        { freezeId, step: "freeze_not_found" }
      );
    }

    const fotoRaw = (fotoResult.data || []) as SalFreezeFoto[];
    let foto: SalFreezeFotoPreview[] = [];

    try {
      foto = await aggiungiPreviewFoto({
        foto: fotoRaw,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Errore preview foto";

      console.warn("[sal-freeze-detail-photo-warning]", {
        freezeId,
        errorMessage,
      });
      foto = [];
    }

    const dettaglio: SalFreezeDettaglio = {
      freeze,
      lavorazioni: (lavorazioniResult.data ||
        []) as SalFreezeLavorazione[],
      foto,
      macchinari: (macchinariResult.data ||
        []) as SalFreezeMacchinario[],
    };



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
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : ERRORI.LETTURA_DETTAGLIO;

    console.error("[sal-freeze-detail-error]", {
      freezeId,
      step: "unexpected",
      errorMessage,
    });

    return jsonErrore(
      errorMessage,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      { freezeId, step: "unexpected" }
    );
  }
}
