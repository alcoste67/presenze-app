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
    <div className="mb-6">
      <label className="block text-sm font-medium mb-2">
        Attività
      </label>

      <select
        value={attivitaTipo}
        onChange={(e) =>
          onChange(
            e.target.value as TipoAttivita | ""
          )
        }
        disabled={disabled}
        className="w-full border rounded-lg p-3"
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
    </div>
  );
}
