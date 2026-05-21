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
          className="h-12 w-full rounded-none border border-[#2B2B2F] bg-[#0F0F10] px-4 pr-10 text-sm font-medium text-[#FAFAF7] outline-none transition-colors placeholder:text-[#6F6A61] focus:border-[#FF6B1A] disabled:cursor-not-allowed disabled:bg-[#141416] disabled:text-[#8C8780]"
        />

        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#8C8780]">
          ▾
        </span>
      </div>

      {aperto && !disabled && (
        <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto border border-[#2B2B2F] bg-[#161617]">
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
              className="block w-full border-b border-[#222225] px-3 py-3 text-left text-sm font-medium text-[#FAFAF7] transition-colors last:border-b-0 hover:bg-[#1C1C1E]"
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
