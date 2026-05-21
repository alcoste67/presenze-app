import {
  STATI,
  TIMBRATURE,
  TIMBRATURE_TESTI,
} from "@/constants/stati";
import {
  StatoLavoratore,
  Timbratura,
} from "@/types/timbrature";

type Props = {
  stato: StatoLavoratore;
  ultimaTimbratura: Timbratura | null;
};

const STATO_STILI: Record<
  StatoLavoratore,
  {
    contenitore: string;
    indicatore: string;
    testo: string;
    descrizione: string;
  }
> = {
  [STATI.FUORI]: {
    contenitore:
      "border-slate-200 bg-white",
    indicatore: "bg-slate-400",
    testo: "text-slate-950",
    descrizione:
      TIMBRATURE_TESTI.STATO
        .FUORI_DESCRIZIONE,
  },
  [STATI.DENTRO]: {
    contenitore:
      "border-emerald-200 bg-emerald-50",
    indicatore:
      "bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.14)]",
    testo: "text-emerald-950",
    descrizione:
      TIMBRATURE_TESTI.STATO
        .DENTRO_DESCRIZIONE,
  },
  [STATI.IN_PAUSA]: {
    contenitore:
      "border-amber-200 bg-amber-50",
    indicatore:
      "bg-amber-500 shadow-[0_0_0_6px_rgba(245,158,11,0.14)]",
    testo: "text-amber-950",
    descrizione:
      TIMBRATURE_TESTI.STATO
        .IN_PAUSA_DESCRIZIONE,
  },
};

function formattaOra(data: string) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data));
}

function getUltimaTimbraturaLabel(
  ultimaTimbratura: Timbratura | null
) {
  if (!ultimaTimbratura) {
    return TIMBRATURE_TESTI.STATO
      .NESSUNA_TIMBRATURA;
  }

  const tipo =
    ultimaTimbratura.tipo ===
    TIMBRATURE.CAMBIO_CANTIERE
      ? TIMBRATURE_TESTI.STATO
          .CAMBIO_CANTIERE_LABEL
      : ultimaTimbratura.tipo;

  return `${tipo} ${
    TIMBRATURE_TESTI.STATO
      .ULTIMA_TIMBRATURA_ORA
  } ${formattaOra(ultimaTimbratura.created_at)}`;
}

export function StatoBadge({
  stato,
  ultimaTimbratura,
}: Props) {
  const stile = STATO_STILI[stato];

  return (
    <section
      className={`rounded-2xl border p-4 shadow-sm transition-colors duration-200 ${stile.contenitore}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {TIMBRATURE_TESTI.STATO.TITOLO}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <span
              className={`h-3 w-3 rounded-full ${stile.indicatore}`}
            />
            <h2
              className={`text-3xl font-semibold tracking-tight ${stile.testo}`}
            >
              {stato}
            </h2>
          </div>

          <p className="mt-2 text-sm font-medium text-slate-600">
            {stile.descrizione}
          </p>
        </div>

        <div className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
          {TIMBRATURE_TESTI.STATO.LIVE}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/70 bg-white/70 p-3 text-sm text-slate-600 shadow-sm">
        <span className="font-medium text-slate-900">
          {
            TIMBRATURE_TESTI.STATO
              .ULTIMA_TIMBRATURA
          }
        </span>
        <span className="mt-1 block">
          {getUltimaTimbraturaLabel(
            ultimaTimbratura
          )}
        </span>
      </div>
    </section>
  );
}
