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
      className="relative"
    >
      <label className="mb-2 block text-sm font-semibold text-slate-700">
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
          className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-11 text-base font-medium text-slate-950 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70 disabled:bg-slate-100 disabled:text-slate-500"
        />

        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
          {aperto ? "^" : "v"}
        </span>
      </div>

      {aperto && !disabled && (
        <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-900/10">
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
                className="block w-full rounded-xl px-3 py-3 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100"
              >
                {cantiere.nome}
              </button>
            )
          )}

          {cantieriFiltrati.length === 0 && (
            <div className="px-3 py-3 text-sm text-slate-500">
              Nessun cantiere trovato
            </div>
          )}
        </div>
      )}
    </div>
  );
}
