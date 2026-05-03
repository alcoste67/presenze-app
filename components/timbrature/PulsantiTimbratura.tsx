import { TIMBRATURE } from "@/constants/stati";
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
      {statoAttuale === "FUORI" && (
        <button
          onClick={() =>
            onTimbratura(TIMBRATURE.ENTRATA)
          }
          disabled={loading}
          className="bg-green-600 text-white rounded-lg p-4 font-semibold"
        >
          {loading
            ? "Salvataggio..."
            : "TIMBRA ENTRATA"}
        </button>
      )}

      {statoAttuale === "DENTRO" && (
        <>
          <button
            onClick={() =>
              onTimbratura(TIMBRATURE.PAUSA)
            }
            disabled={loading}
            className="bg-yellow-500 text-white rounded-lg p-4 font-semibold"
          >
            {loading
              ? "Salvataggio..."
              : "INIZIA PAUSA"}
          </button>

          <button
            onClick={() =>
              onTimbratura(TIMBRATURE.USCITA)
            }
            disabled={loading}
            className="bg-red-600 text-white rounded-lg p-4 font-semibold"
          >
            {loading
              ? "Salvataggio..."
              : "TIMBRA USCITA"}
          </button>
        </>
      )}

      {statoAttuale === "IN_PAUSA" && (
        <button
          onClick={() =>
            onTimbratura(TIMBRATURE.RIENTRO)
          }
          disabled={loading}
          className="bg-blue-600 text-white rounded-lg p-4 font-semibold"
        >
          {loading
            ? "Salvataggio..."
            : "FINE PAUSA"}
        </button>
      )}
    </div>
  );
}
