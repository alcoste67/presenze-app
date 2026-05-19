import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  const containerRef =
    useRef<HTMLDivElement | null>(null);
  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const cantiereSelezionato =
    cantieri.find(
      (cantiere) =>
        cantiere.id === cantiereId
    ) || null;

  const [query, setQuery] = useState(
    ""
  );

  const [aperto, setAperto] =
    useState(false);

  useEffect(() => {
    const handleMouseDown = (
      event: MouseEvent
    ) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setAperto(false);
      }
    };

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        setAperto(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleMouseDown
    );
    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleMouseDown
      );
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  const inputValue =
    cantiereSelezionato?.nome || query;

  const cantieriFiltrati = useMemo(() => {
    const ricerca =
      inputValue.trim().toLowerCase();

    if (!ricerca) {
      return cantieri;
    }

    return cantieri.filter((cantiere) =>
      cantiere.nome
        .toLowerCase()
        .includes(ricerca)
    );
  }, [cantieri, inputValue]);

  return (
    <div
      ref={containerRef}
      className="mb-6 relative"
    >
      <label className="block text-sm font-medium mb-2">
        Cantiere
      </label>

      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) =>
          {
            const nextQuery =
              e.target.value;

            setQuery(nextQuery);
            setAperto(true);

            if (
              cantiereId ||
              !nextQuery
            ) {
              onChange("");
            }
          }
        }
        onFocus={() => setAperto(true)}
        disabled={disabled}
        placeholder="Cerca cantiere"
        className="w-full border rounded-lg p-3"
      />

      {aperto && !disabled && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border bg-white shadow">
          {cantieriFiltrati.map(
            (cantiere) => (
              <button
                key={cantiere.id}
                type="button"
                onMouseDown={(e) =>
                  e.preventDefault()
                }
                onClick={() => {
                  onChange(cantiere.id);
                  setQuery("");
                  setAperto(false);
                  inputRef.current?.blur();
                }}
                className="block w-full px-3 py-2 text-left hover:bg-gray-100"
              >
                {cantiere.nome}
              </button>
            )
          )}

          {cantieriFiltrati.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">
              Nessun cantiere trovato
            </div>
          )}
        </div>
      )}
    </div>
  );
}
