import type { SupabaseClient } from "@supabase/supabase-js";

import { TIMBRATURE } from "@/constants/stati";
import { romaLocalToUtc } from "@/lib/timezoneRoma";
import type { TipoAttivita } from "@/types/attivita";

export class GiornataLavorataError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function getDataSuccessiva(dataYYYYMMDD: string): string {
  const data = new Date(`${dataYYYYMMDD}T00:00:00Z`);
  data.setUTCDate(data.getUTCDate() + 1);
  return data.toISOString().slice(0, 10);
}

/**
 * Backfill admin di un giorno senza nessuna timbratura ma in cui il
 * dipendente ha davvero lavorato: crea una vera ENTRATA e USCITA (non
 * una richiesta di assenza), così il libro presenze mostra le ore
 * reali. Stessa verifica "giornata vuota" di compilaGiornataVuota.ts,
 * qui limitata a ingresso/uscita nello stesso giorno civile.
 */
export async function creaGiornataLavorata({
  aziendaId,
  dipendenteId,
  data,
  oraIngresso,
  oraUscita,
  cantiereId,
  attivitaTipo,
  supabaseClient,
}: {
  aziendaId: string;
  dipendenteId: string;
  data: string;
  oraIngresso: string;
  oraUscita: string;
  cantiereId: string | null;
  attivitaTipo: TipoAttivita | null;
  supabaseClient: SupabaseClient;
}): Promise<{ entrataId: string; uscitaId: string }> {
  const { data: dipendente } = await supabaseClient
    .from("dipendenti")
    .select("auth_user_id")
    .eq("id", dipendenteId)
    .eq("azienda_id", aziendaId)
    .maybeSingle();

  if (!dipendente?.auth_user_id) {
    throw new GiornataLavorataError("DIPENDENTE_NON_TROVATO", "Dipendente non trovato");
  }

  const ingressoUtc = romaLocalToUtc(data, oraIngresso);
  const uscitaUtc = romaLocalToUtc(data, oraUscita);

  if (uscitaUtc.getTime() <= ingressoUtc.getTime()) {
    throw new GiornataLavorataError(
      "ORARIO_NON_VALIDO",
      "L'orario di uscita deve essere dopo l'orario di ingresso"
    );
  }
  if (uscitaUtc.getTime() > Date.now()) {
    throw new GiornataLavorataError("ORARIO_FUTURO", "L'orario non può essere nel futuro");
  }

  const inizioGiornoUtc = romaLocalToUtc(data, "00:00").toISOString();
  const fineGiornoUtc = romaLocalToUtc(getDataSuccessiva(data), "00:00").toISOString();

  const { count: timbratureCount } = await supabaseClient
    .from("timbrature")
    .select("id", { count: "exact", head: true })
    .eq("user_id", dipendente.auth_user_id)
    .gte("created_at", inizioGiornoUtc)
    .lt("created_at", fineGiornoUtc);

  if ((timbratureCount ?? 0) > 0) {
    throw new GiornataLavorataError(
      "GIORNATA_NON_VUOTA",
      "Questa giornata ha già delle timbrature registrate"
    );
  }

  const { data: entrata, error: erroreEntrata } = await supabaseClient
    .from("timbrature")
    .insert({
      user_id: dipendente.auth_user_id,
      cantiere_id: cantiereId,
      attivita_tipo: attivitaTipo,
      tipo: TIMBRATURE.ENTRATA,
      azienda_id: aziendaId,
      created_at: ingressoUtc.toISOString(),
    })
    .select("id")
    .single();

  if (erroreEntrata || !entrata) {
    throw erroreEntrata || new Error("Inserimento entrata fallito");
  }

  const { data: uscita, error: erroreUscita } = await supabaseClient
    .from("timbrature")
    .insert({
      user_id: dipendente.auth_user_id,
      cantiere_id: cantiereId,
      attivita_tipo: attivitaTipo,
      tipo: TIMBRATURE.USCITA,
      azienda_id: aziendaId,
      created_at: uscitaUtc.toISOString(),
    })
    .select("id")
    .single();

  if (erroreUscita || !uscita) {
    throw erroreUscita || new Error("Inserimento uscita fallito");
  }

  return { entrataId: entrata.id, uscitaId: uscita.id };
}
