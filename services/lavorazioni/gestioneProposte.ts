import { supabase } from "@/lib/supabase";
import type { LavorazioneCantiere } from "@/types/lavorazioni";

type SupabaseClient = typeof supabase;

export type LavorazioneProposta = LavorazioneCantiere & {
  nota_proposta: string;
  cantiere_nome?: string;
};

const SELECT_PROPOSTA =
  "id, cantiere_id, nome, ordine, attiva, percentuale_completamento, stato, nota_proposta, created_at, cantieri(nome)";

/** Proposte in attesa di verifica (tutta l'azienda, RLS). */
export async function loadLavorazioniProposte({
  supabaseClient = supabase,
}: {
  supabaseClient?: SupabaseClient;
} = {}): Promise<LavorazioneProposta[]> {
  const { data, error } = await supabaseClient
    .from("lavorazioni_cantiere")
    .select(SELECT_PROPOSTA)
    .eq("stato", "proposta")
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as unknown as Array<
    LavorazioneProposta & { cantieri: { nome: string } | null }
  >).map(({ cantieri, ...proposta }) => ({
    ...proposta,
    cantiere_nome: cantieri?.nome,
  }));
}

/** Approva la proposta come nuova lavorazione di catalogo. */
export async function approvaLavorazioneProposta({
  lavorazioneId,
  supabaseClient = supabase,
}: {
  lavorazioneId: string;
  supabaseClient?: SupabaseClient;
}): Promise<void> {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  const { error } = await supabaseClient
    .from("lavorazioni_cantiere")
    .update({
      stato: "approvata",
      approvata_da: user?.id || null,
      approvata_il: new Date().toISOString(),
    })
    .eq("id", lavorazioneId);

  if (error) {
    throw error;
  }
}

/** Rifiuta la proposta (resta a DB per lo storico, ma disattivata). */
export async function rifiutaLavorazioneProposta({
  lavorazioneId,
  supabaseClient = supabase,
}: {
  lavorazioneId: string;
  supabaseClient?: SupabaseClient;
}): Promise<void> {
  const { error } = await supabaseClient
    .from("lavorazioni_cantiere")
    .update({ stato: "rifiutata", attiva: false })
    .eq("id", lavorazioneId);

  if (error) {
    throw error;
  }
}

/**
 * Unisce la proposta a una lavorazione esistente: ricollega avanzamenti,
 * foto e righe rapporto alla destinazione, poi elimina la proposta.
 */
export async function unisciLavorazioneProposta({
  propostaId,
  destinazioneId,
  supabaseClient = supabase,
}: {
  propostaId: string;
  destinazioneId: string;
  supabaseClient?: SupabaseClient;
}): Promise<void> {
  if (propostaId === destinazioneId) {
    throw new Error("Seleziona una lavorazione diversa dalla proposta");
  }

  const tabelle = [
    "timbrature_lavorazioni",
    "sal_lavorazioni_foto",
    "rapporti_intervento_lavorazioni",
    "sal_freeze_lavorazioni",
  ] as const;

  for (const tabella of tabelle) {
    const { error } = await supabaseClient
      .from(tabella)
      .update({ lavorazione_id: destinazioneId })
      .eq("lavorazione_id", propostaId);

    if (error) {
      throw error;
    }
  }

  const { error } = await supabaseClient
    .from("lavorazioni_cantiere")
    .delete()
    .eq("id", propostaId);

  if (error) {
    throw error;
  }
}
