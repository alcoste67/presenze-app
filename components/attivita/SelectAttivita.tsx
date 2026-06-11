import { ATTIVITA, LABEL_ATTIVITA } from "@/constants/attivita";
import { TipoAttivita } from "@/types/attivita";

const SELECT_CLASS_NAME =
  "h-10 w-full appearance-none rounded-md border border-border bg-bg-card px-3 pr-8 text-sm text-text-primary outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-muted min-w-0 box-border";

type Props = {
  attivitaTipo: TipoAttivita | "";
  onChange: (attivitaTipo: TipoAttivita | "") => void;
  disabled?: boolean;
};

function ChevronIcon() {
  return (
    <svg
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SelectAttivita({
  attivitaTipo,
  onChange,
  disabled,
}: Props) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-text-primary">
        Attività
      </label>

      <div className="relative">
        <select
          value={attivitaTipo}
          onChange={(e) => onChange(e.target.value as TipoAttivita | "")}
          disabled={disabled}
          className={SELECT_CLASS_NAME}
        >
          <option value="">Seleziona attività</option>

          {Object.values(ATTIVITA).map((attivita) => (
            <option key={attivita} value={attivita}>
              {LABEL_ATTIVITA[attivita]}
            </option>
          ))}
        </select>

        <ChevronIcon />
      </div>
    </div>
  );
}
