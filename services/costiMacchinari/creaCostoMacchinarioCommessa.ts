import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  CostoMacchinarioCommessa,
  CostoMacchinarioCommessaPubblico,
  CostoMacchinarioCommessaInput,
} from "@/types/costiMacchinari";

type SupabaseClient = typeof supabase;

const SELECT_COSTI_MACCHINARI_ADMIN =
  "id, cantiere_id, rapporto_intervento_id, macchinario_id, tipo_macchinario, descrizione, data_utilizzo, ore_utilizzo, tariffa_oraria, costo_totale, note, created_by, created_at, updated_at";
const SELECT_COSTI_MACCHINARI_PUBBLICO =
  "id, cantiere_id, rapporto_intervento_id, macchinario_id, tipo_macchinario, descrizione, data_utilizzo, ore_utilizzo, note, created_by, created_at, updated_at";

export async function creaCostoMacchinarioCommessa({
  costo,
  includeCosti = true,
  supabaseClient = supabase,
}: {
  costo: CostoMacchinarioCommessaInput;
  includeCosti?: boolean;
  supabaseClient?: SupabaseClient;
}): Promise<
  CostoMacchinarioCommessa | CostoMacchinarioCommessaPubblico
> {
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError) {
    throwErroreSupabase(
      "Lettura utente costi macchinari",
      authError
    );
  }

  const generatedId =
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

  const { error } = await supabaseClient
    .from("costi_macchinari_commessa")
    .insert({
      id: generatedId,
      ...costo,
      created_by: user?.id || null,
    });

  if (error) {
    throwErroreSupabase(
      "Salvataggio costo macchinario",
      error
    );
  }

  if (!includeCosti) {
    const { data, error: publicError } =
      await supabaseClient
        .from("costi_macchinari_pubblici")
        .select(SELECT_COSTI_MACCHINARI_PUBBLICO)
        .eq("id", generatedId)
        .maybeSingle();

    if (publicError) {
      throwErroreSupabase(
        "Lettura costo macchinario pubblico",
        publicError
      );
    }

    if (!data) {
      throw new Error(
        "Costo macchinario non creato"
      );
    }

    return data as CostoMacchinarioCommessaPubblico;
  }

  const { data, error: adminError } =
    await supabaseClient
      .from("costi_macchinari_commessa")
      .select(SELECT_COSTI_MACCHINARI_ADMIN)
      .eq("id", generatedId)
      .maybeSingle();

  if (adminError) {
    throwErroreSupabase(
      "Lettura costo macchinario admin",
      adminError
    );
  }

  if (!data) {
    throw new Error("Costo macchinario non creato");
  }

  return data as CostoMacchinarioCommessa;
}
