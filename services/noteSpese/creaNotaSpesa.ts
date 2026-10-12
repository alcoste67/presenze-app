import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotaSpesaInput } from "@/types/noteSpese";

export async function creaNotaSpesa({
  aziendaId,
  dipendenteId,
  input,
  supabaseClient,
}: {
  aziendaId: string;
  dipendenteId: string;
  input: NotaSpesaInput;
  supabaseClient: SupabaseClient;
}): Promise<string> {
  const { data, error } = await supabaseClient
    .from("note_spese")
    .insert({
      azienda_id: aziendaId,
      dipendente_id: dipendenteId,
      data: input.data,
      tipo: input.tipo,
      importo: input.importo,
      descrizione: input.descrizione,
      foto_scontrino_path: input.fotoScontrinoPath,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error || new Error("Inserimento nota spesa fallito");
  }

  return data.id as string;
}
