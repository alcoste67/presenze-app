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
    "border-emerald-600 bg-emerald-600 text-white shadow-emerald-900/10 hover:bg-emerald-700",
  avviso:
    "border-amber-500 bg-amber-500 text-white shadow-amber-900/10 hover:bg-amber-600",
  neutro:
    "border-slate-200 bg-white text-slate-950 shadow-slate-900/5 hover:border-slate-300 hover:bg-slate-50",
  pericolo:
    "border-rose-600 bg-rose-600 text-white shadow-rose-900/10 hover:bg-rose-700",
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
      className={`group flex min-h-20 w-full items-center justify-between gap-4 rounded-2xl border px-4 py-4 text-left shadow-lg transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${STILI_PULSANTE[tono]}`}
    >
      <span className="min-w-0">
        <span className="block text-base font-semibold leading-tight">
          {loading
            ? TIMBRATURE_TESTI.AZIONI
                .SALVATAGGIO
            : label}
        </span>
        <span className="mt-1 block text-sm opacity-80">
          {descrizione}
        </span>
      </span>

      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg transition-transform duration-200 group-hover:translate-x-0.5">
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <span aria-hidden="true">{">"}</span>
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
          label={
            TIMBRATURE_TESTI.AZIONI.ENTRATA
          }
          descrizione={
            TIMBRATURE_TESTI
              .AZIONI_DESCRIZIONI.ENTRATA
          }
          tono="primario"
          loading={loading}
          onClick={() =>
            onTimbratura(TIMBRATURE.ENTRATA)
          }
        />
      )}

      {statoAttuale === STATI.DENTRO && (
        <>
          <PulsanteAzione
            label={
              TIMBRATURE_TESTI.AZIONI.PAUSA
            }
            descrizione={
              TIMBRATURE_TESTI
                .AZIONI_DESCRIZIONI.PAUSA
            }
            tono="avviso"
            loading={loading}
            onClick={() =>
              onTimbratura(TIMBRATURE.PAUSA)
            }
          />

          <PulsanteAzione
            label={
              TIMBRATURE_TESTI.AZIONI
                .CAMBIO_CANTIERE
            }
            descrizione={
              TIMBRATURE_TESTI
                .AZIONI_DESCRIZIONI
                .CAMBIO_CANTIERE
            }
            tono="neutro"
            loading={loading}
            onClick={() =>
              onTimbratura(
                TIMBRATURE.CAMBIO_CANTIERE
              )
            }
          />

          <PulsanteAzione
            label={
              TIMBRATURE_TESTI.AZIONI.USCITA
            }
            descrizione={
              TIMBRATURE_TESTI
                .AZIONI_DESCRIZIONI.USCITA
            }
            tono="pericolo"
            loading={loading}
            onClick={() =>
              onTimbratura(TIMBRATURE.USCITA)
            }
          />
        </>
      )}

      {statoAttuale === STATI.IN_PAUSA && (
        <PulsanteAzione
          label={
            TIMBRATURE_TESTI.AZIONI.RIENTRO
          }
          descrizione={
            TIMBRATURE_TESTI
              .AZIONI_DESCRIZIONI.RIENTRO
          }
          tono="primario"
          loading={loading}
          onClick={() =>
            onTimbratura(TIMBRATURE.RIENTRO)
          }
        />
      )}
    </section>
  );
}
