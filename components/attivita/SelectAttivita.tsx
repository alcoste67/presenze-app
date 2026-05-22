import { ATTIVITA } from "@/constants/attivita";
import { TipoAttivita } from "@/types/attivita";

const SELECT_CLASS_NAME =
  "h-12 w-full appearance-none rounded-lg border border-industrial-border bg-industrial-control px-4 pr-10 text-sm font-medium text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:cursor-not-allowed disabled:border-industrial-border-soft disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong";

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
      <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.24em] text-industrial-muted-strong">
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
          className={SELECT_CLASS_NAME}
        >
          <option value="">Seleziona attività</option>

          {Object.values(ATTIVITA).map((attivita) => (
            <option
              key={attivita}
              value={attivita}
            >
              {attivita}
            </option>
          ))}
        </select>

        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-industrial-muted-strong">
          ▾
        </span>
      </div>
    </div>
  );
}
