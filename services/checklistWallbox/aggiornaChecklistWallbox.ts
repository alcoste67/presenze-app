import { supabase } from "@/lib/supabase";
import { CHECKLIST_WALLBOX_STATI, CHECKLIST_WALLBOX_TESTI } from "@/constants/checklistWallbox";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import { SELECT_CHECKLIST_WALLBOX } from "@/services/checklistWallbox/creaChecklistWallbox";
import type { ChecklistWallbox, ChecklistWallboxInput } from "@/types/checklistWallbox";

type SupabaseClient = typeof supabase;

/**
 * Aggiorna una checklist ancora in BOZZA. Non è un'alternativa al lock
 * post-firma: il trigger DB blocca comunque qualunque UPDATE una volta
 * che lo stato è FIRMATO o INVIATO, questo è solo un controllo
 * applicativo per dare un errore leggibile prima di provarci.
 */
export async function aggiornaChecklistWallbox(
  checklistId: string,
  input: ChecklistWallboxInput,
  supabaseClient: SupabaseClient = supabase
): Promise<ChecklistWallbox> {
  const { data, error } = await supabaseClient
    .from("checklist_wallbox")
    .update({
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", checklistId)
    .eq("stato", CHECKLIST_WALLBOX_STATI.BOZZA)
    .select(SELECT_CHECKLIST_WALLBOX)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Aggiornamento checklist wallbox", error);
  }

  if (!data) {
    throw new Error(CHECKLIST_WALLBOX_TESTI.ERRORI.CHECKLIST_FIRMATA);
  }

  return data as ChecklistWallbox;
}
