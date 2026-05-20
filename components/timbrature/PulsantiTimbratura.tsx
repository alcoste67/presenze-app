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

export function PulsantiTimbratura({
  statoAttuale,
  loading,
  onTimbratura,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      {statoAttuale === STATI.FUORI && (
        <button
          onClick={() =>
            onTimbratura(TIMBRATURE.ENTRATA)
          }
          disabled={loading}
          className="bg-green-600 text-white rounded-lg p-4 font-semibold"
        >
          {loading
            ? TIMBRATURE_TESTI.AZIONI
                .SALVATAGGIO
            : TIMBRATURE_TESTI.AZIONI
                .ENTRATA}
        </button>
      )}

      {statoAttuale === STATI.DENTRO && (
        <>
          <button
            onClick={() =>
              onTimbratura(TIMBRATURE.PAUSA)
            }
            disabled={loading}
            className="bg-yellow-500 text-white rounded-lg p-4 font-semibold"
          >
            {loading
              ? TIMBRATURE_TESTI.AZIONI
                  .SALVATAGGIO
              : TIMBRATURE_TESTI.AZIONI
                  .PAUSA}
          </button>

          <button
            onClick={() =>
              onTimbratura(
                TIMBRATURE.CAMBIO_CANTIERE
              )
            }
            disabled={loading}
            className="bg-blue-600 text-white rounded-lg p-4 font-semibold"
          >
            {loading
              ? TIMBRATURE_TESTI.AZIONI
                  .SALVATAGGIO
              : TIMBRATURE_TESTI.AZIONI
                  .CAMBIO_CANTIERE}
          </button>

          <button
            onClick={() =>
              onTimbratura(TIMBRATURE.USCITA)
            }
            disabled={loading}
            className="bg-red-600 text-white rounded-lg p-4 font-semibold"
          >
            {loading
              ? TIMBRATURE_TESTI.AZIONI
                  .SALVATAGGIO
              : TIMBRATURE_TESTI.AZIONI
                  .USCITA}
          </button>
        </>
      )}

      {statoAttuale === STATI.IN_PAUSA && (
        <button
          onClick={() =>
            onTimbratura(TIMBRATURE.RIENTRO)
          }
          disabled={loading}
          className="bg-blue-600 text-white rounded-lg p-4 font-semibold"
        >
          {loading
            ? TIMBRATURE_TESTI.AZIONI
                .SALVATAGGIO
            : TIMBRATURE_TESTI.AZIONI
                .RIENTRO}
        </button>
      )}
    </div>
  );
}
