// Helper timezone Europe/Rome (CET/CEST) senza dipendenze esterne.
// Serve per i promemoria/correzioni timbratura: l'orario "vero" è quello
// visto dal dipendente in Italia, non l'UTC del server.

const FORMATO_DATA_ROMA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Rome",
});

export function dataRomaDi(valore: string | Date): string {
  return FORMATO_DATA_ROMA.format(new Date(valore));
}

export function dataRomaOggi(): string {
  return dataRomaDi(new Date());
}

export function oraRomaAttuale(): number {
  return Number(
    new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
  );
}

/** Minuti dalla mezzanotte, ora Italia (0-1439) — per soglie non allineate all'ora piena (es. 12:45). */
export function minutiRomaAttuali(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const ore = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minuti = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return ore * 60 + minuti;
}

/** true da lunedì a venerdì (ora Italia) */
export function giornoFerialeRoma(data: Date = new Date()): boolean {
  const giorno = new Date(`${dataRomaDi(data)}T00:00:00Z`).getUTCDay();
  return giorno >= 1 && giorno <= 5;
}

/** Pasquetta (lunedì dell'Angelo): unica festività nazionale a data mobile, calcolata con l'algoritmo di Meeus/Jones/Butcher. */
function pasquettaRoma(anno: number): { mese: number; giorno: number } {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mesePasqua = Math.floor((h + l - 7 * m + 114) / 31);
  const giornoPasqua = ((h + l - 7 * m + 114) % 31) + 1;

  const pasqua = new Date(Date.UTC(anno, mesePasqua - 1, giornoPasqua));
  const pasquetta = new Date(pasqua.getTime() + 24 * 60 * 60 * 1000);
  return { mese: pasquetta.getUTCMonth() + 1, giorno: pasquetta.getUTCDate() };
}

/** Festività nazionali italiane a data fissa: [mese, giorno]. */
const FESTIVITA_FISSE_ROMA = [
  [1, 1], // Capodanno
  [1, 6], // Epifania
  [4, 25], // Liberazione
  [5, 1], // Festa dei lavoratori
  [6, 2], // Festa della Repubblica
  [8, 15], // Ferragosto
  [11, 1], // Ognissanti
  [12, 8], // Immacolata Concezione
  [12, 25], // Natale
  [12, 26], // Santo Stefano
] as const;

/** true se la data (ora Italia) è una festività nazionale italiana */
export function festivoRoma(data: Date = new Date()): boolean {
  const [annoStr, meseStr, giornoStr] = dataRomaDi(data).split("-");
  const anno = Number(annoStr);
  const mese = Number(meseStr);
  const giorno = Number(giornoStr);

  if (FESTIVITA_FISSE_ROMA.some(([m, g]) => m === mese && g === giorno)) {
    return true;
  }

  const pasquetta = pasquettaRoma(anno);
  return pasquetta.mese === mese && pasquetta.giorno === giorno;
}

/** true nei giorni in cui ha senso mostrare/inviare un promemoria di timbratura: feriale e non festivo */
export function giornoLavorativoRoma(data: Date = new Date()): boolean {
  return giornoFerialeRoma(data) && !festivoRoma(data);
}

/**
 * Converte un orario "wall clock" di Roma (es. "2026-09-08", "07:45") nel
 * corrispondente istante UTC, gestendo CET/CEST senza tabelle di offset.
 */
export function romaLocalToUtc(dataYYYYMMDD: string, oraHHMM: string): Date {
  const target = new Date(`${dataYYYYMMDD}T${oraHHMM}:00Z`).getTime();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(target));

  const get = (tipo: string) =>
    Number(parts.find((p) => p.type === tipo)?.value ?? "0");

  const comeAppareARoma = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );

  const offsetMs = comeAppareARoma - target;
  return new Date(target - offsetMs);
}
