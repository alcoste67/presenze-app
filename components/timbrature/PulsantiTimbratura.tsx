import {
  STATI,
  TIMBRATURE,
  TIMBRATURE_TESTI,
} from "@/constants/stati";
import {
  StatoLavoratore,
  TipoTimbratura,
} from "@/types/timbrature";

type Props = {
  statoAttuale: StatoLavoratore;
  loading: boolean;
  onTimbratura: (tipo: TipoTimbratura) => void;
};

type PulsanteAzioneProps = {
  label: string;
  descrizione: string;
  tono: "primario" | "avviso" | "neutro" | "pericolo";
  loading: boolean;
  onClick: () => void;
};

const STILI_PULSANTE = {
  primario:
    "rounded-xl border-industrial-orange bg-industrial-orange text-white hover:border-industrial-orange-hover hover:bg-industrial-orange-hover active:border-industrial-orange-active active:bg-industrial-orange-active",
  avviso:
    "rounded-xl border-industrial-border bg-industrial-control text-industrial-text hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white",
  neutro:
    "rounded-xl border-industrial-border bg-industrial-control text-industrial-text hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white",
  pericolo:
    "rounded-xl border-industrial-border bg-industrial-control text-industrial-text hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white",
} as const;

function PulsanteAzione({
  label,
  descrizione,
  tono,
  loading,
  onClick,
}: PulsanteAzioneProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`group flex min-h-20 w-full items-center justify-between gap-4 border px-4 py-4 text-left transition-colors duration-200 ease-out active:scale-[0.99] disabled:cursor-not-allowed disabled:border-industrial-border-soft disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong disabled:opacity-60 ${STILI_PULSANTE[tono]}`}
    >
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-[0.22em]">
          {loading
            ? TIMBRATURE_TESTI.AZIONI.SALVATAGGIO
            : label}
        </span>
        <span className="mt-1 block text-sm leading-5 text-current/70">
          {descrizione}
        </span>
      </span>

      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current/15 bg-industrial-text text-lg text-white transition-transform duration-200 group-hover:translate-x-0.5">
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <span aria-hidden="true">→</span>
        )}
      </span>
    </button>
  );
}

export function PulsantiTimbratura({
  statoAttuale,
  loading,
  onTimbratura,
}: Props) {
  return (
    <section className="flex flex-col gap-3">
      {statoAttuale === STATI.FUORI && (
        <PulsanteAzione
          label={TIMBRATURE_TESTI.AZIONI.ENTRATA}
          descrizione={TIMBRATURE_TESTI.AZIONI_DESCRIZIONI.ENTRATA}
          tono="primario"
          loading={loading}
          onClick={() => onTimbratura(TIMBRATURE.ENTRATA)}
        />
      )}

      {statoAttuale === STATI.DENTRO && (
        <>
          <PulsanteAzione
            label={TIMBRATURE_TESTI.AZIONI.PAUSA}
            descrizione={TIMBRATURE_TESTI.AZIONI_DESCRIZIONI.PAUSA}
            tono="avviso"
            loading={loading}
            onClick={() => onTimbratura(TIMBRATURE.PAUSA)}
          />

          <PulsanteAzione
            label={TIMBRATURE_TESTI.AZIONI.CAMBIO_CANTIERE}
            descrizione={TIMBRATURE_TESTI.AZIONI_DESCRIZIONI.CAMBIO_CANTIERE}
            tono="neutro"
            loading={loading}
            onClick={() => onTimbratura(TIMBRATURE.CAMBIO_CANTIERE)}
          />

          <PulsanteAzione
            label={TIMBRATURE_TESTI.AZIONI.USCITA}
            descrizione={TIMBRATURE_TESTI.AZIONI_DESCRIZIONI.USCITA}
            tono="pericolo"
            loading={loading}
            onClick={() => onTimbratura(TIMBRATURE.USCITA)}
          />
        </>
      )}

      {statoAttuale === STATI.IN_PAUSA && (
        <PulsanteAzione
          label={TIMBRATURE_TESTI.AZIONI.RIENTRO}
          descrizione={TIMBRATURE_TESTI.AZIONI_DESCRIZIONI.RIENTRO}
          tono="primario"
          loading={loading}
          onClick={() => onTimbratura(TIMBRATURE.RIENTRO)}
        />
      )}
    </section>
  );
}
