import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  ChecklistWallbox,
  ChecklistWallboxInput,
} from "@/types/checklistWallbox";

type SupabaseClient = typeof supabase;

export const SELECT_CHECKLIST_WALLBOX =
  "id, azienda_id, ragione_sociale, piva, codice_ditta, nome, cognome, via, comune, cap, provincia, telefono, email_cliente, posizionamento, posizionamento_tipo, modalita_posa, potenza_contatore_kw, stabile_cpi, obbligo_progetto_elettrico, autorizzazioni_necessarie, messa_a_terra, misura_terra_ohm, installazione_possibile, descrizione_percorso_cavi, note, materiali, cavo_altro_descrizione, cavo_altro_quantita, interruttore_altro_descrizione, interruttore_altro_quantita, materiali_altro, planimetria_data_url, luogo, data_sopralluogo, formato_stampa, firma_tecnico_data_url, firma_tecnico_nome, firma_tecnico_at, firma_cliente_data_url, firma_cliente_nome, firma_cliente_at, stato, created_by, inviato_il, created_at, updated_at";

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
      codice_ditta: input.codice_ditta,
      nome: input.nome,
      cognome: input.cognome,
      via: input.via,
      comune: input.comune,
      cap: input.cap,
      provincia: input.provincia,
      telefono: input.telefono,
      email_cliente: input.email_cliente,
      posizionamento: input.posizionamento,
      posizionamento_tipo: input.posizionamento_tipo,
      modalita_posa: input.modalita_posa,
      potenza_contatore_kw: input.potenza_contatore_kw,
      stabile_cpi: input.stabile_cpi,
      obbligo_progetto_elettrico: input.obbligo_progetto_elettrico,
      autorizzazioni_necessarie: input.autorizzazioni_necessarie,
      messa_a_terra: input.messa_a_terra,
      misura_terra_ohm: input.misura_terra_ohm,
      installazione_possibile: input.installazione_possibile,
      descrizione_percorso_cavi: input.descrizione_percorso_cavi,
      note: input.note,
      materiali: input.materiali,
      cavo_altro_descrizione: input.cavo_altro_descrizione,
      cavo_altro_quantita: input.cavo_altro_quantita,
      interruttore_altro_descrizione: input.interruttore_altro_descrizione,
      interruttore_altro_quantita: input.interruttore_altro_quantita,
      materiali_altro: input.materiali_altro,
      planimetria_data_url: input.planimetria_data_url,
      luogo: input.luogo,
      data_sopralluogo: input.data_sopralluogo,
      formato_stampa: input.formato_stampa,
      created_by: createdBy,
    })
    .select(SELECT_CHECKLIST_WALLBOX)
    .single();

  if (error) {
    throwErroreSupabase("Salvataggio checklist wallbox", error);
  }

  return data as ChecklistWallbox;
}
