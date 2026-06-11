import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";

type SupabaseClient = typeof supabase;

const BUCKET_FOTO_LAVORAZIONI = "foto-lavorazioni";
const TENTATIVI_UPLOAD = 3;
const BACKOFF_BASE_MS = 1500;

function attesa(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Carica una foto compressa su Storage (con retry e backoff) e registra
 * la riga in sal_lavorazioni_foto. Ritorna lo storage_path.
 */
export async function uploadFotoLavorazione({
  blob,
  cantiereId,
  lavorazioneId,
  timbraturaId,
  nota = "",
  supabaseClient = supabase,
}: {
  blob: Blob;
  cantiereId: string;
  lavorazioneId: string;
  timbraturaId: string | null;
  nota?: string;
  supabaseClient?: SupabaseClient;
}): Promise<string> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(
    supabaseClient,
    user.id
  );

  const storagePath = `${aziendaId}/${cantiereId}/${lavorazioneId}/${Date.now()}.jpg`;

  let ultimoErrore: unknown = null;
  for (let tentativo = 1; tentativo <= TENTATIVI_UPLOAD; tentativo++) {
    const { error } = await supabaseClient.storage
      .from(BUCKET_FOTO_LAVORAZIONI)
      .upload(storagePath, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (!error) {
      ultimoErrore = null;
      break;
    }

    ultimoErrore = error;
    if (tentativo < TENTATIVI_UPLOAD) {
      await attesa(BACKOFF_BASE_MS * tentativo);
    }
  }

  if (ultimoErrore) {
    throw new Error(
      "Upload foto non riuscito: controlla la rete e riprova"
    );
  }

  const oggi = new Date().toISOString().slice(0, 10);

  const { error: insertError } = await supabaseClient
    .from("sal_lavorazioni_foto")
    .insert({
      cantiere_id: cantiereId,
      lavorazione_id: lavorazioneId,
      timbratura_id: timbraturaId,
      data_riferimento: oggi,
      storage_path: storagePath,
      nota: nota.trim(),
      descrizione: nota.trim(),
      created_by: user.id,
      azienda_id: aziendaId,
    });

  if (insertError) {
    // Niente riga a DB → rimuovi il file orfano (best effort)
    await supabaseClient.storage
      .from(BUCKET_FOTO_LAVORAZIONI)
      .remove([storagePath]);
    throwErroreSupabase("Registrazione foto", insertError);
  }

  return storagePath;
}

/** URL firmato (1 ora) per visualizzare una foto su Storage. */
export async function getUrlFotoLavorazione({
  storagePath,
  supabaseClient = supabase,
}: {
  storagePath: string;
  supabaseClient?: SupabaseClient;
}): Promise<string> {
  const { data, error } = await supabaseClient.storage
    .from(BUCKET_FOTO_LAVORAZIONI)
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    throw new Error("Foto non disponibile");
  }

  return data.signedUrl;
}
