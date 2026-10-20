import type { SupabaseClient } from "@supabase/supabase-js";

export class MalattiaError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export async function registraMalattia({
  aziendaId,
  dipendenteId,
  registrataDa,
  dataInizio,
  dataFine,
  nota,
  supabaseClient,
}: {
  aziendaId: string;
  dipendenteId: string;
  registrataDa: string;
  dataInizio: string;
  dataFine: string;
  nota: string;
  supabaseClient: SupabaseClient;
}): Promise<string> {
  if (dataFine < dataInizio) {
    throw new MalattiaError("INTERVALLO_NON_VALIDO", "Data fine precedente alla data inizio");
  }

  const { data: dipendente } = await supabaseClient
    .from("dipendenti")
    .select("id")
    .eq("id", dipendenteId)
    .eq("azienda_id", aziendaId)
    .maybeSingle();

  if (!dipendente) {
    throw new MalattiaError("DIPENDENTE_NON_TROVATO", "Dipendente non trovato");
  }

  const { count: richiesteCount } = await supabaseClient
    .from("richieste_assenza")
    .select("id", { count: "exact", head: true })
    .eq("dipendente_id", dipendenteId)
    .in("stato", ["IN_ATTESA", "APPROVATA"])
    .lte("data_inizio", dataFine)
    .gte("data_fine", dataInizio);

  if ((richiesteCount ?? 0) > 0) {
    throw new MalattiaError(
      "PERIODO_SOVRAPPOSTO",
      "Esiste già una richiesta ferie/permesso/malattia in questo periodo"
    );
  }

  const adesso = new Date().toISOString();

  const { data: inserita, error } = await supabaseClient
    .from("richieste_assenza")
    .insert({
      azienda_id: aziendaId,
      dipendente_id: dipendenteId,
      tipo: "MALATTIA",
      data_inizio: dataInizio,
      data_fine: dataFine,
      giornata_intera: true,
      ore: null,
      nota,
      stato: "APPROVATA",
      approvata_da: registrataDa,
      approvata_il: adesso,
    })
    .select("id")
    .single();

  if (error || !inserita) {
    throw error || new Error("Inserimento malattia fallito");
  }

  return inserita.id as string;
}
