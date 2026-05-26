import { supabase } from "@/lib/supabase";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import {
  SAL_FREEZE_ERRORI,
  SalFreezeError,
} from "@/services/salFreeze/createSalFreeze";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type { SalFreezeMensile } from "@/types/salFreeze";

type SupabaseClient = typeof supabase;

type FreezeAnnullabileRow = Pick<
  SalFreezeMensile,
  | "id"
  | "cantiere_id"
  | "period_start"
  | "period_end"
  | "freeze_at"
  | "created_by"
  | "note"
  | "metadata"
  | "annullato_at"
  | "annullato_by"
>;

const SELECT_FREEZE =
  "id, cantiere_id, period_start, period_end, freeze_at, created_by, note, metadata, annullato_at, annullato_by";

function throwSalFreezeError(
  code: keyof typeof SAL_FREEZE_ERRORI,
  message: string
): never {
  throw new SalFreezeError(
    SAL_FREEZE_ERRORI[code],
    message
  );
}

export async function annullaSalFreeze({
  freezeId,
  accessToken,
  supabaseClient = supabase,
}: {
  freezeId: string;
  accessToken?: string;
  supabaseClient?: SupabaseClient;
}): Promise<FreezeAnnullabileRow> {
  if (!freezeId) {
    throwSalFreezeError(
      "INPUT_NON_VALIDO",
      "Freeze non valido"
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser(accessToken);

  if (authError) {
    throwErroreSupabase(
      "Lettura utente annullamento freeze SAL",
      authError
    );
  }

  if (!user?.email) {
    throwSalFreezeError(
      "ACCESSO_NEGATO",
      "Accesso non autorizzato"
    );
  }

  const utenteAdmin = await isAdmin(
    user.email,
    supabaseClient
  );

  if (!utenteAdmin) {
    throwSalFreezeError(
      "ACCESSO_NEGATO",
      "Accesso non autorizzato"
    );
  }

  const { data: freeze, error: freezeError } =
    await supabaseClient
      .from("sal_freeze_mensili")
      .select(SELECT_FREEZE)
      .eq("id", freezeId)
      .maybeSingle();

  if (freezeError) {
    throwErroreSupabase(
      "Lettura freeze SAL da annullare",
      freezeError
    );
  }

  if (!freeze) {
    throwSalFreezeError(
      "FREEZE_NON_TROVATO",
      "Freeze SAL non trovato"
    );
  }

  if (freeze.annullato_at) {
    throwSalFreezeError(
      "FREEZE_GIA_ANNULLATO",
      "Freeze SAL gia annullato"
    );
  }

  const annullatoAt = new Date().toISOString();

  const { data: freezeAnnullato, error: updateError } =
    await supabaseClient
      .from("sal_freeze_mensili")
      .update({
        annullato_at: annullatoAt,
        annullato_by: user.id,
      })
      .eq("id", freezeId)
      .is("annullato_at", null)
      .select(SELECT_FREEZE)
      .single();

  if (updateError) {
    throwErroreSupabase(
      "Annullamento freeze SAL",
      updateError
    );
  }

  if (!freezeAnnullato) {
    throwSalFreezeError(
      "FREEZE_NON_TROVATO",
      "Freeze SAL non trovato"
    );
  }

  return freezeAnnullato as FreezeAnnullabileRow;
}
