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
  "h-10 w-full rounded-md border border-border bg-bg-card px-3 pr-9 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-muted min-w-0 box-border";

type Props = {
  cantieri: Cantiere[];
  cantiereId: string;
  onChange: (cantiereId: string) => void;
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

export function SelectCantiere({
  cantieri,
  cantiereId,
  onChange,
  disabled,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const cantiereSelezionato =
    cantieri.find((cantiere) => cantiere.id === cantiereId) || null;

  const [query, setQuery] = useState("");
  const [aperto, setAperto] = useState(false);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setAperto(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAperto(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const inputValue = cantiereSelezionato?.nome || query;

  const cantieriFiltrati = useMemo(() => {
    const ricerca = inputValue.trim().toLowerCase();

    if (!ricerca) {
      return cantieri;
    }

    return cantieri.filter((cantiere) =>
      cantiere.nome.toLowerCase().includes(ricerca)
    );
  }, [cantieri, inputValue]);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-text-primary">
        Cantiere
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            const nextQuery = e.target.value;
            const queryCorrente = cantiereSelezionato?.nome || query;

            if (nextQuery === queryCorrente) {
              return;
            }

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
        <ChevronIcon />
      </div>

      {aperto && !disabled && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-bg-card shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
          {cantieriFiltrati.map((cantiere) => (
            <button
              key={cantiere.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(cantiere.id);
                setQuery("");
                setAperto(false);
                inputRef.current?.blur();
              }}
              className="block w-full border-b border-border px-3 py-2.5 text-left text-sm text-text-primary transition-colors duration-150 last:border-b-0 hover:bg-bg-subtle"
            >
              {cantiere.nome}
            </button>
          ))}

          {cantieriFiltrati.length === 0 && (
            <div className="px-3 py-3 text-sm text-text-muted">
              Nessun cantiere trovato
            </div>
          )}
        </div>
      )}
    </div>
  );
}
