import type { SupabaseClient } from "@supabase/supabase-js";

import { loadNoteSpese } from "@/services/noteSpese/loadNoteSpese";
import { loadRimborsiKmMensili } from "@/services/noteSpese/loadRimborsiKmMensili";
import type { ReportSpeseRimborsiFiltri, DipendenteReportSpeseRimborsi } from "@/types/reportNoteSpeseRimborsi";

function getPrimoGiornoMese(anno: number, mese: number): string {
  return `${anno}-${String(mese).padStart(2, "0")}-01`;
}

function getUltimoGiornoMese(anno: number, mese: number): string {
  const ultimoGiorno = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
  return `${anno}-${String(mese).padStart(2, "0")}-${String(ultimoGiorno).padStart(2, "0")}`;
}

/**
 * Un rigo per dipendente con, insieme: le sue note spese APPROVATE del
 * mese (il PDF va al consulente per il pagamento, non ha senso includere
 * spese ancora in attesa o rifiutate) e il rimborso chilometrico dello
 * stesso mese. Dipendenti senza nessuna delle due cose quel mese non
 * compaiono (niente pagine vuote).
 */
export async function loadReportSpeseRimborsi(
  filtri: ReportSpeseRimborsiFiltri,
  aziendaId: string,
  supabaseClient: SupabaseClient
): Promise<DipendenteReportSpeseRimborsi[]> {
  const dataInizio = getPrimoGiornoMese(filtri.anno, filtri.mese);
  const dataFine = getUltimoGiornoMese(filtri.anno, filtri.mese);

  const [noteSpese, rimborsiKm] = await Promise.all([
    loadNoteSpese({
      aziendaId,
      dipendenteId: "",
      vedeTutte: true,
      stato: "APPROVATA",
      periodo: { dataInizio, dataFine },
      supabaseClient,
    }),
    loadRimborsiKmMensili({
      aziendaId,
      anno: filtri.anno,
      mese: filtri.mese,
      supabaseClient,
    }),
  ]);

  const righe = new Map<string, DipendenteReportSpeseRimborsi>();

  for (const nota of noteSpese) {
    const riga = righe.get(nota.dipendenteId) || {
      dipendenteId: nota.dipendenteId,
      dipendente: nota.dipendenteNome,
      noteSpese: [],
      totaleNoteSpese: 0,
      rimborsoKm: null,
    };
    riga.noteSpese.push(nota);
    riga.totaleNoteSpese += nota.importo;
    righe.set(nota.dipendenteId, riga);
  }

  for (const rimborso of rimborsiKm) {
    const riga = righe.get(rimborso.dipendenteId) || {
      dipendenteId: rimborso.dipendenteId,
      dipendente: rimborso.dipendente,
      noteSpese: [],
      totaleNoteSpese: 0,
      rimborsoKm: null,
    };
    riga.rimborsoKm = rimborso;
    righe.set(rimborso.dipendenteId, riga);
  }

  return Array.from(righe.values())
    .map((riga) => ({
      ...riga,
      noteSpese: riga.noteSpese.sort((a, b) => a.data.localeCompare(b.data)),
      totaleNoteSpese: Math.round(riga.totaleNoteSpese * 100) / 100,
    }))
    .sort((a, b) => a.dipendente.localeCompare(b.dipendente));
}
