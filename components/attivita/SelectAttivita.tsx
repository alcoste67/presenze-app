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
      <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.24em] text-[#8C8780]">
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
          className="h-12 w-full appearance-none rounded-none border border-[#2B2B2F] bg-[#0F0F10] px-4 pr-10 text-sm font-medium text-[#FAFAF7] outline-none transition-colors focus:border-[#FF6B1A] disabled:cursor-not-allowed disabled:bg-[#141416] disabled:text-[#8C8780]"
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

        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#8C8780]">
          ▾
        </span>
      </div>
    </div>
  );
}
