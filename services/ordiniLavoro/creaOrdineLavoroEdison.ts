import { supabase } from "@/lib/supabase";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import type {
  OrdineLavoroEdison,
  OrdineLavoroEdisonInput,
} from "@/types/ordiniLavoro";

type SupabaseClient = typeof supabase;

export const SELECT_ORDINE_LAVORO_EDISON =
  "id, azienda_id, checklist_wallbox_id, intervento_numero, data, ora_dalle, ora_alle, tecnico_societa, tecnico_nome, cliente_nome_cognome, cliente_indirizzo, cliente_civico, cliente_comune, cliente_cap, cliente_provincia, cliente_telefono, cliente_email, tipologia_24_7, tipologia_caldaia, tipologia_scaldabagno, tipologia_climatizzatore, tipologia_elettrodomestico, tipologia_varie, dettaglio_manodopera_compresa, dettaglio_manodopera_a_pagamento, dettaglio_ore_manodopera_extra, dettaglio_pezzi_ricambio, dettaglio_preventivo, dettaglio_riparazione, dettaglio_manutenzione, dettaglio_impianti, dettaglio_intervento_eseguito, elenco_interventi, prescrizione_sicurezza, prescrizione_motivo, osservazioni, modalita_pagamento, luogo, firma_tecnico_data_url, firma_tecnico_nome, firma_tecnico_at, firma_cliente_data_url, firma_cliente_nome, firma_cliente_at, stato, created_by, inviato_il, created_at, updated_at";

async function getCreatedBy(supabaseClient: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error) {
    throwErroreSupabase("Lettura utente ordine di lavoro", error);
  }

  return user?.id || null;
}

export async function creaOrdineLavoroEdison(
  input: OrdineLavoroEdisonInput,
  supabaseClient: SupabaseClient = supabase
): Promise<OrdineLavoroEdison> {
  const createdBy = await getCreatedBy(supabaseClient);

  if (!createdBy) {
    throw new Error("Non autenticato");
  }

  const aziendaId = await getAziendaIdFromAuthUser(
    supabaseClient,
    createdBy
  );

  const { data, error } = await supabaseClient
    .from("ordini_lavoro_edison")
    .insert({
      azienda_id: aziendaId,
      checklist_wallbox_id: input.checklist_wallbox_id,
      intervento_numero: input.intervento_numero,
      data: input.data,
      ora_dalle: input.ora_dalle,
      ora_alle: input.ora_alle,
      tecnico_societa: input.tecnico_societa,
      tecnico_nome: input.tecnico_nome,
      cliente_nome_cognome: input.cliente_nome_cognome,
      cliente_indirizzo: input.cliente_indirizzo,
      cliente_civico: input.cliente_civico,
      cliente_comune: input.cliente_comune,
      cliente_cap: input.cliente_cap,
      cliente_provincia: input.cliente_provincia,
      cliente_telefono: input.cliente_telefono,
      cliente_email: input.cliente_email,
      tipologia_24_7: input.tipologia_24_7,
      tipologia_caldaia: input.tipologia_caldaia,
      tipologia_scaldabagno: input.tipologia_scaldabagno,
      tipologia_climatizzatore: input.tipologia_climatizzatore,
      tipologia_elettrodomestico: input.tipologia_elettrodomestico,
      tipologia_varie: input.tipologia_varie,
      dettaglio_manodopera_compresa: input.dettaglio_manodopera_compresa,
      dettaglio_manodopera_a_pagamento: input.dettaglio_manodopera_a_pagamento,
      dettaglio_ore_manodopera_extra: input.dettaglio_ore_manodopera_extra,
      dettaglio_pezzi_ricambio: input.dettaglio_pezzi_ricambio,
      dettaglio_preventivo: input.dettaglio_preventivo,
      dettaglio_riparazione: input.dettaglio_riparazione,
      dettaglio_manutenzione: input.dettaglio_manutenzione,
      dettaglio_impianti: input.dettaglio_impianti,
      dettaglio_intervento_eseguito: input.dettaglio_intervento_eseguito,
      elenco_interventi: input.elenco_interventi,
      prescrizione_sicurezza: input.prescrizione_sicurezza,
      prescrizione_motivo: input.prescrizione_motivo,
      osservazioni: input.osservazioni,
      modalita_pagamento: input.modalita_pagamento,
      luogo: input.luogo,
      created_by: createdBy,
    })
    .select(SELECT_ORDINE_LAVORO_EDISON)
    .single();

  if (error) {
    throwErroreSupabase("Salvataggio ordine di lavoro", error);
  }

  return data as OrdineLavoroEdison;
}
