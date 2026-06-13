import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  SalFreezeExportCommittente,
  SalFreezeFotoPreview,
  SalFreezeLavorazione,
  SalFreezeMensile,
} from "@/types/salFreeze";

type SupabaseClient = typeof supabaseAdmin;

type SalFreezeFotoExportRow = {
  id: string;
  freeze_id: string;
  storage_path_snapshot: string;
  descrizione: string;
  data_riferimento: string;
  selected_at: string | null;
  ordine: number;
};

type SalFreezeExportStep =
  | "freeze"
  | "cantiere"
  | "lavorazioni"
  | "foto";

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export class SalFreezeExportError extends Error {
  readonly step: SalFreezeExportStep;
  readonly code: string | null;
  readonly isSalFreezeExportError = true;

  constructor(
    step: SalFreezeExportStep,
    error: unknown
  ) {
    const errorMessage = getErroreSupabase(error);
    super(errorMessage);
    Object.setPrototypeOf(
      this,
      SalFreezeExportError.prototype
    );
    this.name = "SalFreezeExportError";
    this.step = step;
    this.code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as SupabaseErrorLike).code === "string"
        ? (error as SupabaseErrorLike).code || null
        : null;
  }
}

export function isSalFreezeExportError(
  error: unknown
): error is SalFreezeExportError {
  if (error instanceof SalFreezeExportError) {
    return true;
  }

  if (typeof error !== "object" || error === null) {
    return false;
  }

  const record = error as Record<string, unknown>;

  return (
    record.isSalFreezeExportError === true ||
    record.name === "SalFreezeExportError"
  );
}

const SELECT_SAL_FREEZE_MENSILE =
  "id, cantiere_id, period_start, period_end, freeze_at, created_by, note, metadata, annullato_at, annullato_by";
const SELECT_SAL_FREEZE_LAVORAZIONI =
  "id, freeze_id, lavorazione_id, lavorazione_nome_snapshot, percentuale_precedente, percentuale_attuale, delta_percentuale, ore_uomo_minuti, ordine, created_at";
const SELECT_SAL_FREEZE_FOTO =
  "id, freeze_id, storage_path_snapshot, descrizione, data_riferimento, selected_at, ordine";
const SELECT_CANTIERE =
  "id, nome";

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

function getPreviewUrlDaSnapshot(
  storagePathSnapshot: string
) {
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
  supabaseClient,
}: {
  foto: SalFreezeFotoExportRow[];
  supabaseClient: SupabaseClient;
}): Promise<SalFreezeFotoPreview[]> {
  return Promise.all(
    foto.map(async (item) => {
      const directPreview = getPreviewUrlDaSnapshot(
        item.storage_path_snapshot
      );

      if (directPreview) {
        return {
          ...item,
          preview_url: directPreview,
        };
      }

      const storage = estraiStoragePath(
        item.storage_path_snapshot
      );

      if (!storage) {
        console.warn("[sal-freeze-export-photo-warning]", {
          storagePathSnapshot: item.storage_path_snapshot,
        });

        return {
          ...item,
          preview_url: null,
        };
      }

      const { data, error } = await supabaseClient.storage
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

function throwExportStepError(
  step: SalFreezeExportStep,
  error: unknown
): never {
  throw new SalFreezeExportError(step, error);
}

export async function loadSalFreezeExportCommittente({
  freezeId,
  includeFoto = true,
  supabaseClient = supabaseAdmin,
}: {
  freezeId: string;
  includeFoto?: boolean;
  supabaseClient?: SupabaseClient;
}): Promise<SalFreezeExportCommittente | null> {
  if (!freezeId) {
    return null;
  }

  const freezeResult = await supabaseClient
    .from("sal_freeze_mensili")
    .select(SELECT_SAL_FREEZE_MENSILE)
    .eq("id", freezeId)
    .is("annullato_at", null)
    .maybeSingle();

  if (freezeResult.error) {
    throwExportStepError("freeze", freezeResult.error);
  }

  const freeze = freezeResult.data as
    | SalFreezeMensile
    | null;

  if (!freeze) {
    return null;
  }

  const cantiereQuery = supabaseClient
    .from("cantieri")
    .select(SELECT_CANTIERE)
    .eq("id", freeze.cantiere_id)
    .maybeSingle();
  const lavorazioniQuery = supabaseClient
    .from("sal_freeze_lavorazioni")
    .select(SELECT_SAL_FREEZE_LAVORAZIONI)
    .eq("freeze_id", freezeId)
    .order("ordine", { ascending: true });
  const collaborazioniQuery = supabaseClient
    .from("sal_freeze_collaborazioni")
    .select(
      "azienda_collaboratrice_nome, cantiere_collaboratore_nome, lavorazione_nome, percentuale_completamento, ordine"
    )
    .eq("freeze_id", freezeId)
    .order("ordine", { ascending: true });
  const fotoQuery = includeFoto
    ? supabaseClient
        .from("sal_freeze_foto")
        .select(SELECT_SAL_FREEZE_FOTO)
        .eq("freeze_id", freezeId)
        .order("ordine", { ascending: true })
        .order("selected_at", { ascending: true })
        .limit(6)
    : null;

  const [cantiereResult, lavorazioniResult, collaborazioniResult, fotoResult] =
    await Promise.all([
      cantiereQuery,
      lavorazioniQuery,
      collaborazioniQuery,
      fotoQuery,
    ]);

  if (cantiereResult.error) {
    throwExportStepError("cantiere", cantiereResult.error);
  }

  if (lavorazioniResult.error) {
    throwExportStepError(
      "lavorazioni",
      lavorazioniResult.error
    );
  }

  if (collaborazioniResult.error) {
    throwExportStepError(
      "lavorazioni",
      collaborazioniResult.error
    );
  }

  if (includeFoto && fotoResult?.error) {
    throwExportStepError("foto", fotoResult.error);
  }

  const foto = includeFoto
    ? await aggiungiPreviewFoto({
        foto:
          (fotoResult?.data || []) as SalFreezeFotoExportRow[],
        supabaseClient,
      })
    : [];

  return {
    freeze,
    cantiere:
      (cantiereResult.data as { id: string; nome: string } | null) ||
      null,
    lavorazioni: (lavorazioniResult.data ||
      []) as SalFreezeLavorazione[],
    collaborazioni: (collaborazioniResult.data ||
      []) as SalFreezeExportCommittente["collaborazioni"],
    foto,
  };
}
