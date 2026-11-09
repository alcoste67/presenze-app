import { LABEL_TIPO_ASSENZA_PAGHE, REPORT_PAGHE_LIMITI, REPORT_PAGHE_TESTI } from "@/constants/reportPaghe";
import { TIMBRATURE } from "@/constants/stati";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { calcolaOreLavorate } from "@/services/timbrature/calcolaOreLavorate";
import {
  calcolaMinutiPaghe,
  formattaMinuti,
  getGiornoIsoLocale,
  getUtcDaDataLocale,
} from "@/services/report/loadLibroPresenzeReport";
import type { TipoConteggioOre } from "@/types/dipendenti";
import type { ReportPagheFiltri, ReportPagheRiga, ReportPagheRisposta } from "@/types/reportPaghe";
import type { TipoTimbratura } from "@/types/timbrature";

type TipoAssenzaPaghe = keyof typeof LABEL_TIPO_ASSENZA_PAGHE;

const TIPI_ASSENZA_PAGHE = Object.keys(LABEL_TIPO_ASSENZA_PAGHE) as readonly TipoAssenzaPaghe[];

const TIPI_TIMBRATURA = Object.values(TIMBRATURE) as readonly TipoTimbratura[];

type DipendenteRiga = {
  id: string;
  nome: string;
  cognome: string;
  auth_user_id: string | null;
  tipo_conteggio_ore: TipoConteggioOre;
};

type TimbraturaRow = {
  user_id: string;
  tipo: string;
  created_at: string;
};

type AssenzaRow = {
  dipendente_id: string;
  tipo: string;
  data_inizio: string;
  data_fine: string;
  giornata_intera: boolean;
  ore: number | string | null;
};

type AssenzaGiorno = {
  tipo: TipoAssenzaPaghe;
  giornataIntera: boolean;
  ore: number | null;
};

function pad2(valore: number): string {
  return String(valore).padStart(2, "0");
}

function getGiornoIso(anno: number, mese: number, giorno: number): string {
  return `${anno}-${pad2(mese)}-${pad2(giorno)}`;
}

function getTipoTimbratura(value: string): TipoTimbratura | null {
  return TIPI_TIMBRATURA.includes(value as TipoTimbratura) ? (value as TipoTimbratura) : null;
}

function getTipoAssenzaPaghe(value: string): TipoAssenzaPaghe | null {
  return TIPI_ASSENZA_PAGHE.includes(value as TipoAssenzaPaghe) ? (value as TipoAssenzaPaghe) : null;
}

function getNumeroGiorniMese(anno: number, mese: number): number {
  return new Date(Date.UTC(anno, mese, 0)).getUTCDate();
}

function getDipendenteNome(dipendente: DipendenteRiga): string {
  return `${dipendente.cognome} ${dipendente.nome}`.trim();
}

async function loadDipendentiMese(
  aziendaId: string,
  dipendenteId: string | null
): Promise<DipendenteRiga[]> {
  const base = supabaseAdmin
    .from("dipendenti")
    .select("id, nome, cognome, auth_user_id, tipo_conteggio_ore")
    .eq("azienda_id", aziendaId)
    .eq("attivo", true);

  const query = dipendenteId ? base.eq("id", dipendenteId) : base;

  const { data, error } = await query
    .order("cognome", { ascending: true })
    .order("nome", { ascending: true })
    .limit(REPORT_PAGHE_LIMITI.MAX_DIPENDENTI + 1);

  if (error) {
    throw error;
  }

  return (data || []) as DipendenteRiga[];
}

async function loadTimbratureMese({
  aziendaId,
  authUserIds,
  dataInizioUtc,
  dataFineEsclusivaUtc,
}: {
  aziendaId: string;
  authUserIds: string[];
  dataInizioUtc: string;
  dataFineEsclusivaUtc: string;
}): Promise<TimbraturaRow[]> {
  if (authUserIds.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("timbrature")
    .select("user_id, tipo, created_at")
    .eq("azienda_id", aziendaId)
    .in("user_id", authUserIds)
    .gte("created_at", dataInizioUtc)
    .lt("created_at", dataFineEsclusivaUtc)
    .order("created_at", { ascending: true })
    .limit(REPORT_PAGHE_LIMITI.MAX_TIMBRATURE + 1);

  if (error) {
    throw error;
  }

  return (data || []) as TimbraturaRow[];
}

async function loadAssenzeMese({
  aziendaId,
  dipendenteId,
  dataInizioMese,
  dataFineMese,
}: {
  aziendaId: string;
  dipendenteId: string | null;
  dataInizioMese: string;
  dataFineMese: string;
}): Promise<AssenzaRow[]> {
  const base = supabaseAdmin
    .from("richieste_assenza")
    .select("dipendente_id, tipo, data_inizio, data_fine, giornata_intera, ore")
    .eq("azienda_id", aziendaId)
    .eq("stato", "APPROVATA")
    .lte("data_inizio", dataFineMese)
    .gte("data_fine", dataInizioMese);

  const query = dipendenteId ? base.eq("dipendente_id", dipendenteId) : base;

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return (data || []) as AssenzaRow[];
}

type LavoroGiorno = {
  minuti: number;
  // Timbrature presenti quel giorno ma con sequenza rotta (turno rimasto
  // aperto, pausa mai chiusa...): calcolaOreLavorate conta 0 minuti per la
  // parte anomala, indistinguibile altrimenti da un giorno senza nessuna
  // timbratura — qui invece va segnalato, non lasciato vuoto.
  anomalia: boolean;
};

/** Minuti lavorati (e anomalie di sequenza) per ogni (auth_user_id, giornoIso), dalle timbrature reali del mese. */
function creaMappaMinutiLavorati(timbrature: TimbraturaRow[]): Map<string, LavoroGiorno> {
  const gruppi = new Map<string, { created_at: string; tipo: TipoTimbratura }[]>();

  for (const timbratura of timbrature) {
    const tipo = getTipoTimbratura(timbratura.tipo);
    if (!tipo) continue;

    const giornoIso = getGiornoIsoLocale(new Date(timbratura.created_at));
    const key = `${timbratura.user_id}:${giornoIso}`;
    const gruppo = gruppi.get(key) || [];
    gruppo.push({ created_at: timbratura.created_at, tipo });
    gruppi.set(key, gruppo);
  }

  const lavoroPerGiorno = new Map<string, LavoroGiorno>();
  for (const [key, eventi] of gruppi) {
    const oreReali = calcolaOreLavorate(eventi);
    lavoroPerGiorno.set(key, {
      minuti: oreReali.totaleMinuti,
      anomalia: oreReali.giornataAperta || oreReali.sequenzaIncompleta,
    });
  }

  return lavoroPerGiorno;
}

/** Assenza (se approvata) per ogni (dipendente_id, giornoIso), espandendo gli intervalli sui giorni del mese. */
function creaMappaAssenze({
  assenze,
  anno,
  mese,
  numeroGiorni,
}: {
  assenze: AssenzaRow[];
  anno: number;
  mese: number;
  numeroGiorni: number;
}): Map<string, AssenzaGiorno> {
  const mappa = new Map<string, AssenzaGiorno>();

  for (const assenza of assenze) {
    const tipo = getTipoAssenzaPaghe(assenza.tipo);
    if (!tipo) continue;

    const ore = assenza.ore === null ? null : Number(assenza.ore);

    for (let giorno = 1; giorno <= numeroGiorni; giorno++) {
      const giornoIso = getGiornoIso(anno, mese, giorno);
      if (giornoIso < assenza.data_inizio || giornoIso > assenza.data_fine) continue;

      mappa.set(`${assenza.dipendente_id}:${giornoIso}`, {
        tipo,
        giornataIntera: assenza.giornata_intera,
        ore,
      });
    }
  }

  return mappa;
}

function formattaOre(ore: number): string {
  return Number.isInteger(ore) ? `${ore}h` : `${ore.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}h`;
}

function getValoreCella({
  minutiLavorati,
  anomalia,
  assenza,
}: {
  minutiLavorati: number;
  anomalia: boolean;
  assenza: AssenzaGiorno | undefined;
}): string {
  const lavoratoLabel =
    minutiLavorati > 0
      ? formattaMinuti(minutiLavorati)
      : anomalia
        ? REPORT_PAGHE_TESTI.VALORE_ANOMALIA
        : null;

  if (assenza) {
    // Un'assenza approvata a giornata intera e ore lavorate reali quello
    // stesso giorno non si escludono a vicenda: può succedere (es. ferie
    // approvate ma il dipendente è comunque venuto). Non va nascosto un
    // dato a favore dell'altro in un report che finisce al consulente.
    const assenzaLabel =
      !assenza.giornataIntera && assenza.ore !== null
        ? `${LABEL_TIPO_ASSENZA_PAGHE[assenza.tipo]} ${formattaOre(assenza.ore)}`
        : LABEL_TIPO_ASSENZA_PAGHE[assenza.tipo];

    return lavoratoLabel ? `${lavoratoLabel} + ${assenzaLabel}` : assenzaLabel;
  }

  return lavoratoLabel || "";
}

export async function loadReportPaghe(filtri: ReportPagheFiltri, aziendaId: string): Promise<ReportPagheRisposta> {
  const numeroGiorni = getNumeroGiorniMese(filtri.anno, filtri.mese);
  const dataInizioMese = getGiornoIso(filtri.anno, filtri.mese, 1);
  const dataFineMese = getGiornoIso(filtri.anno, filtri.mese, numeroGiorni);
  const primoGiornoMeseSuccessivo = getGiornoIso(
    filtri.mese === 12 ? filtri.anno + 1 : filtri.anno,
    filtri.mese === 12 ? 1 : filtri.mese + 1,
    1
  );

  const dataInizioUtc = getUtcDaDataLocale(dataInizioMese).toISOString();
  const dataFineEsclusivaUtc = getUtcDaDataLocale(primoGiornoMeseSuccessivo).toISOString();

  const dipendenti = await loadDipendentiMese(aziendaId, filtri.dipendenteId);
  const limiteDipendentiRaggiunto = dipendenti.length > REPORT_PAGHE_LIMITI.MAX_DIPENDENTI;
  const dipendentiLimitati = dipendenti.slice(0, REPORT_PAGHE_LIMITI.MAX_DIPENDENTI);

  const authUserIds = Array.from(
    new Set(dipendentiLimitati.map((d) => d.auth_user_id).filter((id): id is string => Boolean(id)))
  );

  const [timbrature, assenze] = await Promise.all([
    loadTimbratureMese({ aziendaId, authUserIds, dataInizioUtc, dataFineEsclusivaUtc }),
    loadAssenzeMese({ aziendaId, dipendenteId: filtri.dipendenteId, dataInizioMese, dataFineMese }),
  ]);

  const limiteTimbratureRaggiunto = timbrature.length > REPORT_PAGHE_LIMITI.MAX_TIMBRATURE;

  const minutiLavoratiPerGiorno = creaMappaMinutiLavorati(timbrature);
  const assenzePerGiorno = creaMappaAssenze({
    assenze,
    anno: filtri.anno,
    mese: filtri.mese,
    numeroGiorni,
  });

  const righe: ReportPagheRiga[] = dipendentiLimitati.map((dipendente) => {
    let totaleMinutiPaghe = 0;

    const giorni = Array.from({ length: numeroGiorni }, (_, indice) => {
      const giorno = indice + 1;
      const giornoIso = getGiornoIso(filtri.anno, filtri.mese, giorno);

      const lavoroGiorno = dipendente.auth_user_id
        ? minutiLavoratiPerGiorno.get(`${dipendente.auth_user_id}:${giornoIso}`)
        : undefined;
      const minutiReali = lavoroGiorno?.minuti || 0;
      const minutiPaghe = calcolaMinutiPaghe({
        tipoConteggioOre: dipendente.tipo_conteggio_ore,
        totaleMinutiReali: minutiReali,
        presenzaValida: minutiReali > 0,
      });
      totaleMinutiPaghe += minutiPaghe;

      const assenza = assenzePerGiorno.get(`${dipendente.id}:${giornoIso}`);

      return {
        giorno,
        valore: getValoreCella({
          minutiLavorati: minutiPaghe,
          anomalia: Boolean(lavoroGiorno?.anomalia),
          assenza,
        }),
      };
    });

    return {
      dipendenteId: dipendente.id,
      dipendente: getDipendenteNome(dipendente),
      giorni,
      totaleOrePaghe: formattaMinuti(totaleMinutiPaghe),
    };
  });

  return {
    righe,
    numeroGiorni,
    limiteRaggiunto: limiteDipendentiRaggiunto || limiteTimbratureRaggiunto,
  };
}

export const REPORT_PAGHE_ERRORI = REPORT_PAGHE_TESTI.ERRORI;
