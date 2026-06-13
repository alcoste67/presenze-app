import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import {
  SAL_FREEZE_ERRORI,
  SalFreezeError,
} from "@/services/salFreeze/createSalFreeze";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { SalFreezeMensile } from "@/types/salFreeze";

type SupabaseClient = typeof supabaseAdmin;

const SELECT_FREEZE =
  "id, cantiere_id, period_start, period_end, freeze_at, created_by, note, metadata, annullato_at, annullato_by, stato, confermato_at, confermato_by";

function throwSalFreezeError(
  code: keyof typeof SAL_FREEZE_ERRORI,
  message: string
): never {
  throw new SalFreezeError(SAL_FREEZE_ERRORI[code], message);
}

// Conferma un SAL periodo: bozza → definitivo. Da qui in poi è immutabile
// (lock enforced a livello DB dalle trigger di task14). Riservato ad ADMIN.
export async function confermaSalFreeze({
  freezeId,
  userEmail,
  userId,
  supabaseClient = supabaseAdmin,
}: {
  freezeId: string;
  userEmail: string;
  userId: string;
  supabaseClient?: SupabaseClient;
}): Promise<SalFreezeMensile> {
  if (!freezeId) {
    throwSalFreezeError("INPUT_NON_VALIDO", "Freeze non valido");
  }

  const utenteAdmin = await isAdmin(userEmail, supabaseAdmin);

  if (!utenteAdmin) {
    throwSalFreezeError("ACCESSO_NEGATO", "Accesso non autorizzato");
  }

  const { data: freeze, error: freezeError } = await supabaseClient
    .from("sal_freeze_mensili")
    .select(SELECT_FREEZE)
    .eq("id", freezeId)
    .maybeSingle();

  if (freezeError) {
    throwErroreSupabase("Lettura SAL periodo da confermare", freezeError);
  }

  if (!freeze) {
    throwSalFreezeError("FREEZE_NON_TROVATO", "SAL periodo non trovato");
  }

  if (freeze.annullato_at) {
    throwSalFreezeError("FREEZE_GIA_ANNULLATO", "SAL periodo gia annullato");
  }

  if (freeze.stato === "definitivo") {
    throwSalFreezeError(
      "FREEZE_GIA_DEFINITIVO",
      "SAL periodo gia confermato come definitivo"
    );
  }

  const { data: freezeConfermato, error: updateError } = await supabaseClient
    .from("sal_freeze_mensili")
    .update({
      stato: "definitivo",
      confermato_at: new Date().toISOString(),
      confermato_by: userId,
    })
    .eq("id", freezeId)
    .eq("stato", "bozza")
    .is("annullato_at", null)
    .select(SELECT_FREEZE)
    .single();

  if (updateError) {
    throwErroreSupabase("Conferma SAL periodo", updateError);
  }

  if (!freezeConfermato) {
    throwSalFreezeError("FREEZE_NON_TROVATO", "SAL periodo non trovato");
  }

  return freezeConfermato as SalFreezeMensile;
}
