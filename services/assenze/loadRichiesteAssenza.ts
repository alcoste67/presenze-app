import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  RichiestaAssenza,
  StatoRichiestaAssenza,
} from "@/types/assenze";

const SELECT_RICHIESTA =
  "id, dipendente_id, tipo, data_inizio, data_fine, giornata_intera, ore, stato, nota, approvata_da, approvata_il, created_at";

type RichiestaRow = {
  id: string;
  dipendente_id: string;
  tipo: string;
  data_inizio: string;
  data_fine: string;
  giornata_intera: boolean;
  ore: number | null;
  stato: string;
  nota: string;
  approvata_da: string | null;
  approvata_il: string | null;
  created_at: string;
};

async function loadDipendentiNomiById(
  dipendenteIds: string[],
  supabaseClient: SupabaseClient
): Promise<Map<string, string>> {
  if (dipendenteIds.length === 0) return new Map();

  const { data, error } = await supabaseClient
    .from("dipendenti")
    .select("id, nome, cognome")
    .in("id", dipendenteIds);

  if (error) throw error;

  return new Map(
    (data || []).map((d) => [
      d.id as string,
      `${d.nome} ${d.cognome}`.trim(),
    ])
  );
}

export async function loadRichiesteAssenza({
  aziendaId,
  dipendenteId,
  vedeTutte,
  stato,
  periodo,
  supabaseClient,
}: {
  aziendaId: string;
  dipendenteId: string;
  vedeTutte: boolean;
  stato?: StatoRichiestaAssenza;
  periodo?: { dataInizio: string; dataFine: string };
  supabaseClient: SupabaseClient;
}): Promise<RichiestaAssenza[]> {
  let query = supabaseClient
    .from("richieste_assenza")
    .select(SELECT_RICHIESTA)
    .eq("azienda_id", aziendaId)
    .order("data_inizio", { ascending: true });

  if (!vedeTutte) {
    query = query.eq("dipendente_id", dipendenteId);
  }

  if (stato) {
    query = query.eq("stato", stato);
  }

  if (periodo) {
    query = query
      .gte("data_fine", periodo.dataInizio)
      .lte("data_inizio", periodo.dataFine);
  }

  const { data, error } = await query;

  if (error) throw error;

  const richieste = (data || []) as RichiestaRow[];

  const dipendentiById = await loadDipendentiNomiById(
    Array.from(new Set(richieste.map((r) => r.dipendente_id))),
    supabaseClient
  );

  return richieste.map((r) => ({
    id: r.id,
    dipendenteId: r.dipendente_id,
    dipendenteNome: dipendentiById.get(r.dipendente_id) || "",
    tipo: r.tipo as RichiestaAssenza["tipo"],
    dataInizio: r.data_inizio,
    dataFine: r.data_fine,
    giornataIntera: r.giornata_intera,
    ore: r.ore,
    stato: r.stato as StatoRichiestaAssenza,
    nota: r.nota,
    approvataDaId: r.approvata_da,
    approvataIl: r.approvata_il,
    createdAt: r.created_at,
  }));
}
