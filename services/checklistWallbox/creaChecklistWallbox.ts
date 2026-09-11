import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  ChecklistWallbox,
  ChecklistWallboxInput,
} from "@/types/checklistWallbox";

type SupabaseClient = typeof supabase;

export const SELECT_CHECKLIST_WALLBOX =
  "id, azienda_id, ragione_sociale, piva, nome, cognome, via, comune, cap, provincia, telefono, email_cliente, posizionamento, modalita_posa, potenza_contatore_kw, quadro_conforme, impianto_a_norma, dichiarazione_conformita, autorizzazioni_necessarie, messa_a_terra, installazione_possibile, opere_adeguamento_necessarie, note, materiali, luogo, data_sopralluogo, firma_tecnico_data_url, firma_tecnico_nome, firma_tecnico_at, firma_cliente_data_url, firma_cliente_nome, firma_cliente_at, stato, created_by, inviato_il, created_at, updated_at";

async function getCreatedBy(supabaseClient: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error) {
    throwErroreSupabase("Lettura utente checklist wallbox", error);
  }

  return user?.id || null;
}

export async function creaChecklistWallbox(
  input: ChecklistWallboxInput,
  supabaseClient: SupabaseClient = supabase
): Promise<ChecklistWallbox> {
  const createdBy = await getCreatedBy(supabaseClient);

  if (!createdBy) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(
    supabaseClient,
    createdBy
  );

  const { data, error } = await supabaseClient
    .from("checklist_wallbox")
    .insert({
      azienda_id: aziendaId,
      ragione_sociale: input.ragione_sociale,
      piva: input.piva,
      nome: input.nome,
      cognome: input.cognome,
      via: input.via,
      comune: input.comune,
      cap: input.cap,
      provincia: input.provincia,
      telefono: input.telefono,
      email_cliente: input.email_cliente,
      posizionamento: input.posizionamento,
      modalita_posa: input.modalita_posa,
      potenza_contatore_kw: input.potenza_contatore_kw,
      quadro_conforme: input.quadro_conforme,
      impianto_a_norma: input.impianto_a_norma,
      dichiarazione_conformita: input.dichiarazione_conformita,
      autorizzazioni_necessarie: input.autorizzazioni_necessarie,
      messa_a_terra: input.messa_a_terra,
      installazione_possibile: input.installazione_possibile,
      opere_adeguamento_necessarie: input.opere_adeguamento_necessarie,
      note: input.note,
      materiali: input.materiali,
      luogo: input.luogo,
      data_sopralluogo: input.data_sopralluogo,
      created_by: createdBy,
    })
    .select(SELECT_CHECKLIST_WALLBOX)
    .single();

  if (error) {
    throwErroreSupabase("Salvataggio checklist wallbox", error);
  }

  return data as ChecklistWallbox;
}
