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

const INPUT_CLASS_NAME =
  "h-12 w-full rounded-lg border border-industrial-border bg-industrial-control px-4 pr-10 text-sm font-medium text-industrial-text outline-none transition-colors duration-200 ease-out placeholder:text-industrial-muted-strong focus:border-industrial-orange disabled:cursor-not-allowed disabled:border-industrial-border-soft disabled:bg-[#24252a] disabled:text-industrial-muted-strong";

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
      (cantiere) => cantiere.id === cantiereId
    ) || null;

  const [query, setQuery] = useState("");
  const [aperto, setAperto] = useState(false);

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
    const ricerca = inputValue
      .trim()
      .toLowerCase();

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
    <div ref={containerRef} className="relative">
      <label className="mb-2 block text-[10px] font-medium uppercase tracking-[0.24em] text-[#8C8780]">
        Cantiere
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            const nextQuery = e.target.value;

            setQuery(nextQuery);
            setAperto(true);

            if (cantiereId || !nextQuery) {
              onChange("");
            }
          }}
          onFocus={() => setAperto(true)}
          disabled={disabled}
          placeholder="Cerca cantiere"
          className={INPUT_CLASS_NAME}
        />

        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#8C8780]">
          ▾
        </span>
      </div>

      {aperto && !disabled && (
        <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-industrial-border bg-industrial-surface-strong shadow-[0_16px_36px_rgb(0_0_0/0.18)]">
          {cantieriFiltrati.map((cantiere) => (
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
              className="block w-full border-b border-industrial-border-soft px-3 py-3 text-left text-sm font-medium text-industrial-text transition-colors duration-200 ease-out last:border-b-0 hover:bg-industrial-control hover:text-industrial-orange"
            >
              {cantiere.nome}
            </button>
          ))}

          {cantieriFiltrati.length === 0 && (
            <div className="px-3 py-3 text-sm text-[#8C8780]">
              Nessun cantiere trovato
            </div>
          )}
        </div>
      )}
    </div>
  );
}
