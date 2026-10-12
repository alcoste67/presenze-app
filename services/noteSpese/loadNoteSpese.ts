import type { SupabaseClient } from "@supabase/supabase-js";

import type { NotaSpesa, StatoNotaSpesa } from "@/types/noteSpese";

const SELECT_NOTA_SPESA =
  "id, dipendente_id, data, tipo, importo, descrizione, foto_scontrino_path, stato, nota_rifiuto, approvata_da, approvata_il, created_at";

type NotaSpesaRow = {
  id: string;
  dipendente_id: string;
  data: string;
  tipo: string;
  importo: number;
  descrizione: string;
  foto_scontrino_path: string;
  stato: string;
  nota_rifiuto: string;
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

  return new Map((data || []).map((d) => [d.id as string, `${d.nome} ${d.cognome}`.trim()]));
}

export async function loadNoteSpese({
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
  stato?: StatoNotaSpesa;
  periodo?: { dataInizio: string; dataFine: string };
  supabaseClient: SupabaseClient;
}): Promise<NotaSpesa[]> {
  let query = supabaseClient
    .from("note_spese")
    .select(SELECT_NOTA_SPESA)
    .eq("azienda_id", aziendaId)
    .order("data", { ascending: false });

  if (!vedeTutte) {
    query = query.eq("dipendente_id", dipendenteId);
  }

  if (stato) {
    query = query.eq("stato", stato);
  }

  if (periodo) {
    query = query.gte("data", periodo.dataInizio).lte("data", periodo.dataFine);
  }

  const { data, error } = await query;

  if (error) throw error;

  const righe = (data || []) as NotaSpesaRow[];

  const dipendentiById = await loadDipendentiNomiById(
    Array.from(new Set(righe.map((r) => r.dipendente_id))),
    supabaseClient
  );

  return righe.map((r) => ({
    id: r.id,
    dipendenteId: r.dipendente_id,
    dipendenteNome: dipendentiById.get(r.dipendente_id) || "",
    data: r.data,
    tipo: r.tipo as NotaSpesa["tipo"],
    importo: r.importo,
    descrizione: r.descrizione,
    fotoScontrinoPath: r.foto_scontrino_path,
    stato: r.stato as StatoNotaSpesa,
    notaRifiuto: r.nota_rifiuto,
    approvataDaId: r.approvata_da,
    approvataIl: r.approvata_il,
    createdAt: r.created_at,
  }));
}
