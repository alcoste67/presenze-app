import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  SalFreezeDettaglio,
  SalFreezeFoto,
  SalFreezeFotoPreview,
  SalFreezeLavorazione,
  SalFreezeMacchinario,
  SalFreezeMensile,
} from "@/types/salFreeze";

type SupabaseClient = typeof supabase;

const SELECT_SAL_FREEZE_MENSILE =
  "id, cantiere_id, period_start, period_end, freeze_at, created_by, note, metadata, annullato_at, annullato_by";
const SELECT_SAL_FREEZE_LAVORAZIONI =
  "id, freeze_id, lavorazione_id, lavorazione_nome_snapshot, percentuale_precedente, percentuale_attuale, delta_percentuale, ore_uomo_minuti, ordine, created_at";
const SELECT_SAL_FREEZE_FOTO =
  "id, freeze_id, cantiere_id, sal_foto_id, lavorazione_id, data_riferimento, storage_path_snapshot, descrizione, ordine, created_at";
const SELECT_SAL_FREEZE_MACCHINARI =
  "id, freeze_id, macchinario_id, tipo_macchinario_snapshot, descrizione_snapshot, ore_utilizzo, note, ordine, created_at";

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
  supabaseClient,
}: {
  foto: SalFreezeFoto[];
  supabaseClient: SupabaseClient;
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

  const [
    freezeResult,
    lavorazioniResult,
    fotoResult,
    macchinariResult,
  ] = await Promise.all([
    supabaseClient
      .from("sal_freeze_mensili")
      .select(SELECT_SAL_FREEZE_MENSILE)
      .eq("id", freezeId)
      .maybeSingle(),
    supabaseClient
      .from("sal_freeze_lavorazioni")
      .select(SELECT_SAL_FREEZE_LAVORAZIONI)
      .eq("freeze_id", freezeId)
      .order("ordine", { ascending: true }),
    supabaseClient
      .from("sal_freeze_foto")
      .select(SELECT_SAL_FREEZE_FOTO)
      .eq("freeze_id", freezeId)
      .order("ordine", { ascending: true }),
    supabaseClient
      .from("sal_freeze_macchinari")
      .select(SELECT_SAL_FREEZE_MACCHINARI)
      .eq("freeze_id", freezeId)
      .order("ordine", { ascending: true }),
  ]);

  if (freezeResult.error) {
    throwErroreSupabase(
      "Lettura header freeze SAL",
      freezeResult.error
    );
  }

  if (lavorazioniResult.error) {
    throwErroreSupabase(
      "Lettura lavorazioni freeze SAL",
      lavorazioniResult.error
    );
  }

  if (fotoResult.error) {
    throwErroreSupabase(
      "Lettura foto freeze SAL",
      fotoResult.error
    );
  }

  if (macchinariResult.error) {
    throwErroreSupabase(
      "Lettura macchinari freeze SAL",
      macchinariResult.error
    );
  }

  const freeze = freezeResult.data as
    | SalFreezeMensile
    | null;

  if (!freeze) {
    return null;
  }

  const foto = await aggiungiPreviewFoto({
    foto: (fotoResult.data || []) as SalFreezeFoto[],
    supabaseClient,
  });

  return {
    freeze,
    lavorazioni: (lavorazioniResult.data ||
      []) as SalFreezeLavorazione[],
    foto,
    macchinari: (macchinariResult.data ||
      []) as SalFreezeMacchinario[],
  };
}
