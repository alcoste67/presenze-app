"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Dipendente } from "@/types/dipendenti";

type Props = {
  label: string;
  placeholder: string;
  noResultsLabel: string;
  value: string;
  selectedId: string | null;
  options: Dipendente[];
  disabled?: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (dipendente: Dipendente) => void;
  onBlurInvalid: () => void;
};

function getNomeCompleto(
  dipendente: Dipendente
) {
  return `${dipendente.nome} ${dipendente.cognome}`.trim();
}

function getLabelDipendente(
  dipendente: Dipendente
) {
  return `${getNomeCompleto(dipendente)} - ${dipendente.email}`;
}

export function SelectOperatore({
  label,
  placeholder,
  noResultsLabel,
  value,
  selectedId,
  options,
  disabled,
  onSearchChange,
  onSelect,
  onBlurInvalid,
}: Props) {
  const containerRef =
    useRef<HTMLDivElement | null>(null);
  const inputRef =
    useRef<HTMLInputElement | null>(null);
  const selezioneAppenaFattaRef =
    useRef(false);
  const [aperto, setAperto] = useState(false);

  const opzioniFiltrate = useMemo(() => {
    const ricerca = value.trim().toLowerCase();

    if (!ricerca) {
      return options;
    }

    return options.filter((dipendente) =>
      getLabelDipendente(dipendente)
        .toLowerCase()
        .includes(ricerca)
    );
  }, [options, value]);

  useEffect(() => {
    const handlePointerDown = (
      event: PointerEvent
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
      "pointerdown",
      handlePointerDown
    );
    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-industrial-muted">
        {label}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onFocus={() => setAperto(true)}
          onChange={(event) => {
            onSearchChange(event.target.value);
            setAperto(true);
          }}
          onBlur={() => {
            setAperto(false);
            if (selezioneAppenaFattaRef.current) {
              selezioneAppenaFattaRef.current = false;
              return;
            }

            onBlurInvalid();
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-sm text-industrial-text outline-none transition-colors duration-200 ease-out placeholder:text-industrial-muted-strong focus:border-industrial-orange disabled:bg-industrial-surface-strong"
        />

        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-industrial-muted-strong">
          ▾
        </span>
      </div>

      {aperto && !disabled && (
        <div className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-lg border border-industrial-border bg-industrial-surface-strong shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
          {opzioniFiltrate.map((dipendente) => {
            return (
              <button
                key={dipendente.id}
                type="button"
                onMouseDown={(event) =>
                  event.preventDefault()
                }
                onClick={() => {
                  selezioneAppenaFattaRef.current = true;
                  onSelect(dipendente);
                  setAperto(false);
                  inputRef.current?.blur();
                }}
                className={`block w-full border-b border-industrial-border-soft px-3 py-3 text-left text-sm transition-colors duration-200 ease-out last:border-b-0 hover:bg-industrial-control hover:text-industrial-orange ${
                  selectedId === dipendente.id
                    ? "bg-industrial-bg-soft text-industrial-orange"
                    : "text-industrial-text"
                }`}
              >
                <span className="block font-medium">
                  {getNomeCompleto(dipendente)}
                </span>
                <span className="mt-1 block text-xs text-industrial-muted-strong">
                  {dipendente.email}
                </span>
              </button>
            );
          })}

          {opzioniFiltrate.length === 0 && (
            <div className="px-3 py-3 text-sm text-industrial-muted-strong">
              {noResultsLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
