import type { SupabaseClient } from "@supabase/supabase-js";

import type { RimborsoKmRiga } from "@/types/rimborsiKm";

type DipendenteRow = {
  id: string;
  nome: string;
  cognome: string;
  usa_auto_propria: boolean;
  tariffa_km_rimborso: number | null;
  veicolo_descrizione: string;
};

type NotaChilometriRow = {
  dipendente_id: string;
  km: number;
};

function getPrimoGiornoMese(anno: number, mese: number): string {
  return `${anno}-${String(mese).padStart(2, "0")}-01`;
}

function getPrimoGiornoMeseSuccessivo(anno: number, mese: number): string {
  const data = new Date(Date.UTC(anno, mese - 1, 1));
  data.setUTCMonth(data.getUTCMonth() + 1);
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export async function loadRimborsiKmMensili({
  aziendaId,
  anno,
  mese,
  supabaseClient,
  dipendenteId,
}: {
  aziendaId: string;
  anno: number;
  mese: number;
  supabaseClient: SupabaseClient;
  /** Se impostato, limita il risultato al solo dipendente indicato (vista "i miei rimborsi"). */
  dipendenteId?: string;
}): Promise<RimborsoKmRiga[]> {
  const dataInizio = getPrimoGiornoMese(anno, mese);
  const dataFineEsclusiva = getPrimoGiornoMeseSuccessivo(anno, mese);

  let queryDipendenti = supabaseClient
    .from("dipendenti")
    .select("id, nome, cognome, usa_auto_propria, tariffa_km_rimborso, veicolo_descrizione")
    .eq("azienda_id", aziendaId)
    .eq("usa_auto_propria", true);
  let queryKm = supabaseClient
    .from("note_chilometri")
    .select("dipendente_id, km")
    .eq("azienda_id", aziendaId)
    .gte("data", dataInizio)
    .lt("data", dataFineEsclusiva);

  if (dipendenteId) {
    queryDipendenti = queryDipendenti.eq("id", dipendenteId);
    queryKm = queryKm.eq("dipendente_id", dipendenteId);
  }

  const [{ data: dipendentiData, error: dipendentiError }, { data: kmData, error: kmError }] =
    await Promise.all([queryDipendenti, queryKm]);

  if (dipendentiError) throw dipendentiError;
  if (kmError) throw kmError;

  const dipendenti = (dipendentiData || []) as DipendenteRow[];
  const noteChilometri = (kmData || []) as NotaChilometriRow[];

  const kmTotaliPerDipendente = new Map<string, number>();
  for (const nota of noteChilometri) {
    kmTotaliPerDipendente.set(
      nota.dipendente_id,
      (kmTotaliPerDipendente.get(nota.dipendente_id) || 0) + nota.km
    );
  }

  return dipendenti
    .map((dipendente) => {
      const kmTotali = kmTotaliPerDipendente.get(dipendente.id) || 0;
      return {
        dipendenteId: dipendente.id,
        dipendente: `${dipendente.cognome} ${dipendente.nome}`.trim(),
        veicoloDescrizione: dipendente.veicolo_descrizione,
        kmTotali,
        tariffaKmRimborso: dipendente.tariffa_km_rimborso,
        rimborso:
          dipendente.tariffa_km_rimborso !== null
            ? Math.round(kmTotali * dipendente.tariffa_km_rimborso * 100) / 100
            : null,
      };
    })
    .filter((riga) => riga.kmTotali > 0)
    .sort((a, b) => a.dipendente.localeCompare(b.dipendente));
}
