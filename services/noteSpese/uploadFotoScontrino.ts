import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";

const BUCKET_NOTE_SPESE_SCONTRINI = "note-spese-scontrini";
const TENTATIVI_UPLOAD = 3;
const BACKOFF_BASE_MS = 1500;

function attesa(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Carica la foto compressa dello scontrino su Storage (con retry e
 * backoff) e ritorna lo storage_path da passare a POST /api/note-spese.
 */
export async function uploadFotoScontrino(blob: Blob): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(supabase, user.id);
  const storagePath = `${aziendaId}/${user.id}/${Date.now()}.jpg`;

  let ultimoErrore: unknown = null;
  for (let tentativo = 1; tentativo <= TENTATIVI_UPLOAD; tentativo++) {
    const { error } = await supabase.storage
      .from(BUCKET_NOTE_SPESE_SCONTRINI)
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
    throw ultimoErrore;
  }

  return storagePath;
}
