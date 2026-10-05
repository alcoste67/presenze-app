import { supabase } from "@/lib/supabase";
import { ORDINI_LAVORO_STATI, ORDINI_LAVORO_TESTI } from "@/constants/ordiniLavoro";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import { SELECT_ORDINE_LAVORO_EDISON } from "@/services/ordiniLavoro/creaOrdineLavoroEdison";
import type { OrdineLavoroEdison, OrdineLavoroEdisonInput } from "@/types/ordiniLavoro";

type SupabaseClient = typeof supabase;

/**
 * Aggiorna un ordine di lavoro ancora in BOZZA. Non è un'alternativa al
 * lock post-firma: il trigger DB blocca comunque qualunque UPDATE una
 * volta che lo stato è FIRMATO o INVIATO, questo è solo un controllo
 * applicativo per dare un errore leggibile prima di provarci.
 */
export async function aggiornaOrdineLavoroEdison(
  ordineId: string,
  input: OrdineLavoroEdisonInput,
  supabaseClient: SupabaseClient = supabase
): Promise<OrdineLavoroEdison> {
  const { data, error } = await supabaseClient
    .from("ordini_lavoro_edison")
    .update({
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", ordineId)
    .eq("stato", ORDINI_LAVORO_STATI.BOZZA)
    .select(SELECT_ORDINE_LAVORO_EDISON)
    .maybeSingle();

  if (error) {
    throwErroreSupabase("Aggiornamento ordine di lavoro", error);
  }

  if (!data) {
    throw new Error(ORDINI_LAVORO_TESTI.ERRORI.ORDINE_FIRMATO);
  }

  return data as OrdineLavoroEdison;
}
