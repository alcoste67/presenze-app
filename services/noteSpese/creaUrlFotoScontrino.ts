import { supabase } from "@/lib/supabase";

const BUCKET_NOTE_SPESE_SCONTRINI = "note-spese-scontrini";
const SCADENZA_URL_SECONDI = 300;

export async function creaUrlFotoScontrino(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NOTE_SPESE_SCONTRINI)
    .createSignedUrl(path, SCADENZA_URL_SECONDI);

  if (error || !data?.signedUrl) {
    throw error || new Error("URL foto scontrino non disponibile");
  }

  return data.signedUrl;
}
