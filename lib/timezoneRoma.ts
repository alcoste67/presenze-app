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
