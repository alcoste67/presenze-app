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
    indicatore: string;
    testo: string;
    descrizione: string;
  }
> = {
  [STATI.FUORI]: {
    indicatore: "bg-[#8C8780]/50",
    testo: "text-[#FAFAF7]",
    descrizione:
      TIMBRATURE_TESTI.STATO
        .FUORI_DESCRIZIONE,
  },
  [STATI.DENTRO]: {
    indicatore: "bg-industrial-orange",
    testo: "text-[#FAFAF7]",
    descrizione:
      TIMBRATURE_TESTI.STATO
        .DENTRO_DESCRIZIONE,
  },
  [STATI.IN_PAUSA]: {
    indicatore: "bg-industrial-orange-soft",
    testo: "text-[#FAFAF7]",
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
    <section className="relative overflow-hidden rounded-xl border border-industrial-border bg-industrial-surface p-4 text-[#FAFAF7] shadow-[0_18px_42px_rgb(0_0_0/0.14)]">
      {stato === STATI.DENTRO && (
        <div className="absolute inset-y-0 left-0 w-1 bg-industrial-orange" />
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#8C8780]">
            {TIMBRATURE_TESTI.STATO.TITOLO}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${stile.indicatore}`}
            />
            <div className="min-w-0">
              <h2
                className={`display text-3xl font-medium leading-none ${stile.testo}`}
              >
                {stato}
              </h2>
              <p className="mt-1 text-sm text-[#C7C2B7]">
                {stile.descrizione}
              </p>
            </div>
          </div>
        </div>

        <div className="shrink-0 rounded-lg border border-industrial-border-soft bg-industrial-surface-strong px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-[#FAFAF7]">
          {TIMBRATURE_TESTI.STATO.LIVE}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-industrial-border-soft bg-industrial-surface-strong px-3 py-3 text-sm text-[#D7D1C7]">
        <span className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#8C8780]">
          {TIMBRATURE_TESTI.STATO.ULTIMA_TIMBRATURA}
        </span>
        <span className="mt-1 block leading-5">
          {getUltimaTimbraturaLabel(ultimaTimbratura)}
        </span>
      </div>
    </section>
  );
}
