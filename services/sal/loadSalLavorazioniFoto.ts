import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { SalLavorazioneFoto } from "@/types/sal";

type SupabaseClient = typeof supabase;

const SELECT_SAL_LAVORAZIONI_FOTO =
  "id, cantiere_id, lavorazione_id, timbratura_id, data_riferimento, immagine_data_url, storage_path, nota, descrizione, created_by, created_at";

const BUCKET_FOTO_LAVORAZIONI = "foto-lavorazioni";
const SCADENZA_URL_SECONDI = 3600;

export async function loadSalLavorazioniFoto({
  cantiereId,
  dataRiferimento,
  limit,
  supabaseClient = supabase,
}: {
  cantiereId: string;
  dataRiferimento?: string;
  limit?: number;
  supabaseClient?: SupabaseClient;
}): Promise<SalLavorazioneFoto[]> {
  if (!cantiereId) {
    return [];
  }

  let query = supabaseClient
    .from("sal_lavorazioni_foto")
    .select(SELECT_SAL_LAVORAZIONI_FOTO)
    .eq("cantiere_id", cantiereId)
    .order("created_at", {
      ascending: false,
    });

  if (dataRiferimento) {
    query = query.eq(
      "data_riferimento",
      dataRiferimento
    );
  }

  if (typeof limit === "number") {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throwErroreSupabase(
      "Lettura foto SAL",
      error
    );
  }

  const foto = (data || []) as SalLavorazioneFoto[];

  // Foto su Storage: risolvi i path in signed URL (batch), mantenendo
  // il campo immagine_data_url come unica sorgente per i consumer.
  const pathDaRisolvere = foto
    .filter((f) => f.storage_path && !f.immagine_data_url)
    .map((f) => f.storage_path as string);

  if (pathDaRisolvere.length > 0) {
    const { data: firmati } = await supabaseClient.storage
      .from(BUCKET_FOTO_LAVORAZIONI)
      .createSignedUrls(pathDaRisolvere, SCADENZA_URL_SECONDI);

    const urlPerPath = new Map(
      (firmati || [])
        .filter((f) => f.signedUrl)
        .map((f) => [f.path, f.signedUrl])
    );

    for (const f of foto) {
      if (f.storage_path && !f.immagine_data_url) {
        f.immagine_data_url = urlPerPath.get(f.storage_path) || "";
      }
    }
  }

  return foto.filter((f) => f.immagine_data_url);
}
