import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { calcolaOutputPerSalvataggio } from "@/services/checklistFotovoltaico/calcolaOutputPerSalvataggio";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  ChecklistFotovoltaico,
  ChecklistFotovoltaicoInput,
} from "@/types/checklistFotovoltaico";

type SupabaseClient = typeof supabase;

export const SELECT_CHECKLIST_FOTOVOLTAICO =
  "id, azienda_id, ragione_sociale, piva, nome, cognome, via, comune, cap, provincia, telefono, email_cliente, tipo_copertura, orientamento_falda, inclinazione_falda_gradi, superficie_falda_mq, ombreggiamenti_presenti, note_ombreggiamenti, potenza_contatore_kw, quadro_conforme, impianto_a_norma, dichiarazione_conformita, autorizzazioni_necessarie, messa_a_terra, struttura_idonea, opere_adeguamento_necessarie, consumo_f1_kwh, consumo_f2_kwh, consumo_f3_kwh, pompa_calore_attiva, pompa_calore_kwh_anno, auto_elettrica_attiva, auto_elettrica_kwh_anno, induzione_attiva, induzione_kwh_anno, altro_attivo, altro_descrizione, altro_kwh_anno, resa_kwh_per_kwp, fattore_occupazione_falda, margine_batteria, modulo_fotovoltaico_id, fabbisogno_totale_kwh, potenza_consigliata_kwp, potenza_massima_kwp, numero_moduli_max, batteria_consigliata_kwh, materiali, note, luogo, data_sopralluogo, firma_tecnico_data_url, firma_tecnico_nome, firma_tecnico_at, firma_cliente_data_url, firma_cliente_nome, firma_cliente_at, stato, created_by, inviato_il, created_at, updated_at";

async function getCreatedBy(supabaseClient: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error) {
    throwErroreSupabase("Lettura utente checklist fotovoltaico", error);
  }

  return user?.id || null;
}

export async function creaChecklistFotovoltaico(
  input: ChecklistFotovoltaicoInput,
  supabaseClient: SupabaseClient = supabase
): Promise<ChecklistFotovoltaico> {
  const createdBy = await getCreatedBy(supabaseClient);

  if (!createdBy) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(supabaseClient, createdBy);
  const output = await calcolaOutputPerSalvataggio(input, supabaseClient);

  const { data, error } = await supabaseClient
    .from("checklist_fotovoltaico")
    .insert({
      azienda_id: aziendaId,
      ...input,
      ...output,
      created_by: createdBy,
    })
    .select(SELECT_CHECKLIST_FOTOVOLTAICO)
    .single();

  if (error) {
    throwErroreSupabase("Salvataggio checklist fotovoltaico", error);
  }

  return data as ChecklistFotovoltaico;
}
