type Cantiere = {
  id: string;
  nome: string;
};

type Props = {
  cantieri: Cantiere[];
  cantiereId: string;
  onChange: (cantiereId: string) => void;
  disabled?: boolean;
};

export function SelectCantiere({
  cantieri,
  cantiereId,
  onChange,
  disabled,
}: Props) {
  return (
    <div className="mb-6">
      <label className="block text-sm font-medium mb-2">
        Cantiere
      </label>

      <select
        value={cantiereId}
        onChange={(e) =>
          onChange(e.target.value)
        }
        disabled={disabled}
        className="w-full border rounded-lg p-3"
      >
        <option value="">
          Seleziona cantiere
        </option>

        {cantieri.map((cantiere) => (
          <option
            key={cantiere.id}
            value={cantiere.id}
          >
            {cantiere.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
