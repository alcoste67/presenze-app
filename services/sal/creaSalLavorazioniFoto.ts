import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  SalLavorazioneFoto,
  SalLavorazioneFotoInput,
} from "@/types/sal";

type SupabaseClient = typeof supabase;

const SELECT_SAL_LAVORAZIONI_FOTO =
  "id, cantiere_id, lavorazione_id, timbratura_id, data_riferimento, immagine_data_url, descrizione, created_by, created_at";

export async function creaSalLavorazioniFoto({
  foto,
  supabaseClient = supabase,
}: {
  foto: SalLavorazioneFotoInput[];
  supabaseClient?: SupabaseClient;
}): Promise<SalLavorazioneFoto[]> {
  if (foto.length === 0) {
    return [];
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError) {
    throwErroreSupabase(
      "Lettura utente SAL foto",
      authError
    );
  }

  const aziendaId = user
    ? await getAziendaIdFromAuthUser(
        supabaseClient,
        user.id
      )
    : null;

  const righe = foto.map((fotoInput) => ({
    ...fotoInput,
    created_by: user?.id || null,
    azienda_id: aziendaId,
  }));

  const { data, error } = await supabaseClient
    .from("sal_lavorazioni_foto")
    .insert(righe)
    .select(SELECT_SAL_LAVORAZIONI_FOTO);

  if (error) {
    throwErroreSupabase(
      "Salvataggio foto SAL",
      error
    );
  }

  return (
    data || []
  ) as SalLavorazioneFoto[];
}
