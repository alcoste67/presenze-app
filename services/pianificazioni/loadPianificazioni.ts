import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  PianificazioneLavoro,
  PianificazioniFiltri,
} from "@/types/pianificazioni";

const SELECT_PIANIFICAZIONE =
  "id, cantiere_id, data, note, creato_da, created_at";

type PianificazioneRow = {
  id: string;
  cantiere_id: string;
  data: string;
  note: string;
  creato_da: string;
  created_at: string;
};

async function loadCantieriNomiById(
  cantiereIds: string[],
  supabaseClient: SupabaseClient
): Promise<Map<string, string>> {
  if (cantiereIds.length === 0) return new Map();

  const { data, error } = await supabaseClient
    .from("cantieri")
    .select("id, nome")
    .in("id", cantiereIds);

  if (error) throw error;

  return new Map((data || []).map((c) => [c.id as string, c.nome as string]));
}

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

async function loadMacchinariNomiById(
  macchinarioIds: string[],
  supabaseClient: SupabaseClient
): Promise<Map<string, string>> {
  if (macchinarioIds.length === 0) return new Map();

  const { data, error } = await supabaseClient
    .from("macchinari")
    .select("id, nome")
    .in("id", macchinarioIds);

  if (error) throw error;

  return new Map((data || []).map((m) => [m.id as string, m.nome as string]));
}

async function loadSquadrePerPianificazioni(
  pianificazioneIds: string[],
  supabaseClient: SupabaseClient
): Promise<Map<string, string[]>> {
  if (pianificazioneIds.length === 0) return new Map();

  const { data, error } = await supabaseClient
    .from("pianificazioni_squadra")
    .select("pianificazione_id, dipendente_id")
    .in("pianificazione_id", pianificazioneIds);

  if (error) throw error;

  const mappa = new Map<string, string[]>();
  (data || []).forEach((riga) => {
    const lista = mappa.get(riga.pianificazione_id as string) || [];
    lista.push(riga.dipendente_id as string);
    mappa.set(riga.pianificazione_id as string, lista);
  });

  return mappa;
}

async function loadMacchinariPerPianificazioni(
  pianificazioneIds: string[],
  supabaseClient: SupabaseClient
): Promise<Map<string, string[]>> {
  if (pianificazioneIds.length === 0) return new Map();

  const { data, error } = await supabaseClient
    .from("pianificazioni_macchinari")
    .select("pianificazione_id, macchinario_id")
    .in("pianificazione_id", pianificazioneIds);

  if (error) throw error;

  const mappa = new Map<string, string[]>();
  (data || []).forEach((riga) => {
    const lista = mappa.get(riga.pianificazione_id as string) || [];
    lista.push(riga.macchinario_id as string);
    mappa.set(riga.pianificazione_id as string, lista);
  });

  return mappa;
}

function getValoriUnici(valori: string[]): string[] {
  return Array.from(new Set(valori));
}

export async function loadPianificazioni({
  aziendaId,
  filtri,
  dipendenteId,
  vedeTutte,
  supabaseClient,
}: {
  aziendaId: string;
  filtri: PianificazioniFiltri;
  dipendenteId: string;
  vedeTutte: boolean;
  supabaseClient: SupabaseClient;
}): Promise<PianificazioneLavoro[]> {
  let pianificazioneIdsAmmesse: string[] | null = null;

  if (!vedeTutte) {
    const { data, error } = await supabaseClient
      .from("pianificazioni_squadra")
      .select("pianificazione_id")
      .eq("dipendente_id", dipendenteId);

    if (error) throw error;

    pianificazioneIdsAmmesse = (data || []).map(
      (riga) => riga.pianificazione_id as string
    );

    if (pianificazioneIdsAmmesse.length === 0) {
      return [];
    }
  }

  let query = supabaseClient
    .from("pianificazioni_lavoro")
    .select(SELECT_PIANIFICAZIONE)
    .eq("azienda_id", aziendaId)
    .gte("data", filtri.dataInizio)
    .lte("data", filtri.dataFine)
    .order("data", { ascending: true });

  if (pianificazioneIdsAmmesse) {
    query = query.in("id", pianificazioneIdsAmmesse);
  }

  const { data, error } = await query;

  if (error) throw error;

  const pianificazioni = (data || []) as PianificazioneRow[];

  if (pianificazioni.length === 0) {
    return [];
  }

  const pianificazioneIds = pianificazioni.map((p) => p.id);

  const [squadrePerPianificazione, macchinariPerPianificazione] =
    await Promise.all([
      loadSquadrePerPianificazioni(pianificazioneIds, supabaseClient),
      loadMacchinariPerPianificazioni(pianificazioneIds, supabaseClient),
    ]);

  const tuttiDipendenteIds = getValoriUnici(
    Array.from(squadrePerPianificazione.values()).flat()
  );
  const tuttiMacchinarioIds = getValoriUnici(
    Array.from(macchinariPerPianificazione.values()).flat()
  );
  const tuttiCantiereIds = getValoriUnici(
    pianificazioni.map((p) => p.cantiere_id)
  );

  const [cantieriById, dipendentiById, macchinariById] = await Promise.all([
    loadCantieriNomiById(tuttiCantiereIds, supabaseClient),
    loadDipendentiNomiById(tuttiDipendenteIds, supabaseClient),
    loadMacchinariNomiById(tuttiMacchinarioIds, supabaseClient),
  ]);

  return pianificazioni.map((p) => ({
    id: p.id,
    cantiereId: p.cantiere_id,
    cantiereNome: cantieriById.get(p.cantiere_id) || "",
    data: p.data,
    note: p.note,
    squadra: (squadrePerPianificazione.get(p.id) || []).map(
      (dipendenteId) => ({
        dipendenteId,
        nome: dipendentiById.get(dipendenteId) || "",
      })
    ),
    macchinari: (macchinariPerPianificazione.get(p.id) || []).map(
      (macchinarioId) => ({
        macchinarioId,
        nome: macchinariById.get(macchinarioId) || "",
      })
    ),
    creatoDaId: p.creato_da,
    createdAt: p.created_at,
  }));
}
