import { supabase } from "@/lib/supabase";
import { throwErroreSupabase } from "@/services/rapportiIntervento/errors";
import { RAPPORTI_INTERVENTO_STATI } from "@/constants/rapportiIntervento";

type SupabaseClient = typeof supabase;

export type AnteprimaMerge = {
  cantieri: number;
  rapportiBozza: number;
  rapportiBloccati: number;
};

/** Cosa verrà spostato (e cosa no) unendo il duplicato alla destinazione. */
export async function anteprimaMergeClienti({
  clienteDaUnireId,
  supabaseClient = supabase,
}: {
  clienteDaUnireId: string;
  supabaseClient?: SupabaseClient;
}): Promise<AnteprimaMerge> {
  const [cantieriResult, bozzeResult, bloccatiResult] = await Promise.all([
    supabaseClient
      .from("cantieri")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteDaUnireId),
    supabaseClient
      .from("rapporti_intervento")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteDaUnireId)
      .eq("stato", RAPPORTI_INTERVENTO_STATI.BOZZA),
    supabaseClient
      .from("rapporti_intervento")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteDaUnireId)
      .neq("stato", RAPPORTI_INTERVENTO_STATI.BOZZA),
  ]);

  for (const result of [cantieriResult, bozzeResult, bloccatiResult]) {
    if (result.error) {
      throwErroreSupabase("Anteprima merge clienti", result.error);
    }
  }

  return {
    cantieri: cantieriResult.count ?? 0,
    rapportiBozza: bozzeResult.count ?? 0,
    rapportiBloccati: bloccatiResult.count ?? 0,
  };
}

export type EsitoMerge = {
  /** true se il duplicato è stato eliminato, false se solo disattivato */
  eliminato: boolean;
};

/**
 * Unisce il cliente duplicato alla destinazione:
 * - cantieri e rapporti in BOZZA vengono ricollegati alla destinazione;
 * - i rapporti FIRMATO/INVIATO sono immutabili (lock DB) e restano legati
 *   al duplicato, che in quel caso viene disattivato (non eliminato) per
 *   preservare lo storico;
 * - email/telefono/indirizzo mancanti sulla destinazione vengono ereditati.
 */
export async function unisciClienti({
  clienteDaUnireId,
  clienteDestinazioneId,
  supabaseClient = supabase,
}: {
  clienteDaUnireId: string;
  clienteDestinazioneId: string;
  supabaseClient?: SupabaseClient;
}): Promise<EsitoMerge> {
  if (clienteDaUnireId === clienteDestinazioneId) {
    throw new Error("Seleziona un cliente diverso da quello da unire");
  }

  const [duplicatoResult, destinazioneResult] = await Promise.all([
    supabaseClient
      .from("clienti")
      .select("id, ragione_sociale, email, telefono, indirizzo")
      .eq("id", clienteDaUnireId)
      .maybeSingle(),
    supabaseClient
      .from("clienti")
      .select("id, ragione_sociale, email, telefono, indirizzo")
      .eq("id", clienteDestinazioneId)
      .maybeSingle(),
  ]);

  if (duplicatoResult.error) {
    throwErroreSupabase("Lettura cliente da unire", duplicatoResult.error);
  }
  if (destinazioneResult.error) {
    throwErroreSupabase("Lettura cliente destinazione", destinazioneResult.error);
  }

  const duplicato = duplicatoResult.data;
  const destinazione = destinazioneResult.data;
  if (!duplicato || !destinazione) {
    throw new Error("Cliente non trovato");
  }

  // 1. Ricollega i cantieri
  const { error: erroreCantieri } = await supabaseClient
    .from("cantieri")
    .update({ cliente_id: clienteDestinazioneId })
    .eq("cliente_id", clienteDaUnireId);

  if (erroreCantieri) {
    throwErroreSupabase("Merge cantieri cliente", erroreCantieri);
  }

  // 2. Ricollega i rapporti in BOZZA (i firmati/inviati sono immutabili)
  const { error: erroreBozze } = await supabaseClient
    .from("rapporti_intervento")
    .update({ cliente_id: clienteDestinazioneId })
    .eq("cliente_id", clienteDaUnireId)
    .eq("stato", RAPPORTI_INTERVENTO_STATI.BOZZA);

  if (erroreBozze) {
    throwErroreSupabase("Merge rapporti cliente", erroreBozze);
  }

  // 3. La destinazione eredita i recapiti mancanti
  const eredita: Record<string, string> = {};
  if (!destinazione.email && duplicato.email) eredita.email = duplicato.email;
  if (!destinazione.telefono && duplicato.telefono)
    eredita.telefono = duplicato.telefono;
  if (!destinazione.indirizzo && duplicato.indirizzo)
    eredita.indirizzo = duplicato.indirizzo;

  if (Object.keys(eredita).length > 0) {
    // L'email del duplicato deve liberarsi prima (indice univoco)
    if (eredita.email) {
      const { error } = await supabaseClient
        .from("clienti")
        .update({ email: null })
        .eq("id", clienteDaUnireId);
      if (error) throwErroreSupabase("Merge recapiti cliente", error);
    }

    const { error } = await supabaseClient
      .from("clienti")
      .update(eredita)
      .eq("id", clienteDestinazioneId);
    if (error) throwErroreSupabase("Merge recapiti cliente", error);
  }

  // 4. Rapporti bloccati rimasti? Disattiva il duplicato, altrimenti elimina
  const { count: rapportiResidui, error: erroreResidui } = await supabaseClient
    .from("rapporti_intervento")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", clienteDaUnireId);

  if (erroreResidui) {
    throwErroreSupabase("Verifica rapporti residui", erroreResidui);
  }

  if ((rapportiResidui ?? 0) > 0) {
    const { error } = await supabaseClient
      .from("clienti")
      .update({
        attivo: false,
        note: `Unito a «${destinazione.ragione_sociale}» — mantenuto per i rapporti firmati`,
      })
      .eq("id", clienteDaUnireId);

    if (error) {
      throwErroreSupabase("Disattivazione cliente unito", error);
    }
    return { eliminato: false };
  }

  const { error: erroreDelete } = await supabaseClient
    .from("clienti")
    .delete()
    .eq("id", clienteDaUnireId);

  if (erroreDelete) {
    throwErroreSupabase("Eliminazione cliente unito", erroreDelete);
  }

  return { eliminato: true };
}
