import type { SupabaseClient } from "@supabase/supabase-js";

import { romaLocalToUtc } from "@/lib/timezoneRoma";
import type { TipoAssenzaEsteso } from "@/types/assenze";

export class GiornataVuotaError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function getDataSuccessiva(dataYYYYMMDD: string): string {
  const data = new Date(`${dataYYYYMMDD}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

export async function compilaGiornataVuota({
  aziendaId,
  dipendenteId,
  compilataDa,
  data,
  tipo,
  nota,
  supabaseClient,
}: {
  aziendaId: string;
  dipendenteId: string;
  compilataDa: string;
  data: string;
  tipo: TipoAssenzaEsteso;
  nota: string;
  supabaseClient: SupabaseClient;
}): Promise<string> {
  if (tipo === "ALTRO" && !nota.trim()) {
    throw new GiornataVuotaError("NOTA_OBBLIGATORIA", "Nota obbligatoria per 'Altro'");
  }

  const { data: dipendente } = await supabaseClient
    .from("dipendenti")
    .select("auth_user_id")
    .eq("id", dipendenteId)
    .eq("azienda_id", aziendaId)
    .maybeSingle();

  if (!dipendente) {
    throw new GiornataVuotaError("DIPENDENTE_NON_TROVATO", "Dipendente non trovato");
  }

  const inizioUtc = romaLocalToUtc(data, "00:00").toISOString();
  const fineUtc = romaLocalToUtc(getDataSuccessiva(data), "00:00").toISOString();

  if (dipendente.auth_user_id) {
    const { count: timbratureCount } = await supabaseClient
      .from("timbrature")
      .select("id", { count: "exact", head: true })
      .eq("user_id", dipendente.auth_user_id)
      .gte("created_at", inizioUtc)
      .lt("created_at", fineUtc);

    if ((timbratureCount ?? 0) > 0) {
      throw new GiornataVuotaError(
        "GIORNATA_NON_VUOTA",
        "Questa giornata ha già delle timbrature registrate"
      );
    }
  }

  const { count: richiesteCount } = await supabaseClient
    .from("richieste_assenza")
    .select("id", { count: "exact", head: true })
    .eq("dipendente_id", dipendenteId)
    .in("stato", ["IN_ATTESA", "APPROVATA"])
    .lte("data_inizio", data)
    .gte("data_fine", data);

  if ((richiesteCount ?? 0) > 0) {
    throw new GiornataVuotaError(
      "RICHIESTA_GIA_ESISTENTE",
      "Esiste già una richiesta ferie/permesso per questo giorno"
    );
  }

  const adesso = new Date().toISOString();

  const { data: inserita, error } = await supabaseClient
    .from("richieste_assenza")
    .insert({
      azienda_id: aziendaId,
      dipendente_id: dipendenteId,
      tipo,
      data_inizio: data,
      data_fine: data,
      giornata_intera: true,
      ore: null,
      nota,
      stato: "APPROVATA",
      approvata_da: compilataDa,
      approvata_il: adesso,
    })
    .select("id")
    .single();

  if (error || !inserita) {
    throw error || new Error("Inserimento giornata fallito");
  }

  return inserita.id as string;
}
