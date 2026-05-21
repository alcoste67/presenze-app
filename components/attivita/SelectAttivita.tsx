import { ATTIVITA } from "@/constants/attivita";
import { TipoAttivita } from "@/types/attivita";

type Props = {
  attivitaTipo: TipoAttivita | "";
  onChange: (attivitaTipo: TipoAttivita | "") => void;
  disabled?: boolean;
};

export function SelectAttivita({
  attivitaTipo,
  onChange,
  disabled,
}: Props) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        Attività
      </label>

      <div className="relative">
        <select
          value={attivitaTipo}
          onChange={(e) =>
            onChange(
              e.target.value as TipoAttivita | ""
            )
          }
          disabled={disabled}
          className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-11 text-base font-medium text-slate-950 shadow-sm outline-none transition-all duration-200 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 disabled:bg-slate-100 disabled:text-slate-500"
        >
          <option value="">
            Seleziona attività
          </option>

          {Object.values(ATTIVITA).map(
            (attivita) => (
              <option
                key={attivita}
                value={attivita}
              >
                {attivita}
              </option>
            )
          )}
        </select>

        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
          v
        </span>
      </div>
    </div>
  );
}
