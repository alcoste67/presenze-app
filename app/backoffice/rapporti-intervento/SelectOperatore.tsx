"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

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

function getNomeCompleto(dipendente: Dipendente) {
  return `${dipendente.nome} ${dipendente.cognome}`.trim();
}

function getLabelDipendente(dipendente: Dipendente) {
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [aperto, setAperto] = useState(false);

  const opzioneSelezionata = useMemo(
    () => options.find((d) => d.id === selectedId) || null,
    [options, selectedId]
  );

  // Se il campo mostra la voce già selezionata (o è vuoto) proponi TUTTI i
  // nomi; altrimenti filtra per il testo digitato.
  const opzioniFiltrate = useMemo(() => {
    const ricerca = value.trim().toLowerCase();
    const labelSelezionata = opzioneSelezionata
      ? getLabelDipendente(opzioneSelezionata).toLowerCase()
      : "";

    if (!ricerca || ricerca === labelSelezionata) {
      return options;
    }

    return options.filter((dipendente) =>
      getLabelDipendente(dipendente).toLowerCase().includes(ricerca)
    );
  }, [options, value, opzioneSelezionata]);

  // Chiusura su click esterno / Esc: conferma o ripulisce il testo non valido.
  useEffect(() => {
    if (!aperto) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setAperto(false);
        onBlurInvalid();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAperto(false);
        onBlurInvalid();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [aperto, onBlurInvalid]);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-text-muted">
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
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className="w-full rounded-md border border-border bg-bg-card px-3 py-2.5 pr-8 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-muted"
        />

        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
          ▾
        </span>
      </div>

      {aperto && !disabled && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-bg-card shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
          {opzioniFiltrate.map((dipendente) => (
            <button
              key={dipendente.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(dipendente);
                setAperto(false);
                inputRef.current?.blur();
              }}
              className={cn(
                "block w-full border-b border-border px-3 py-2.5 text-left text-sm",
                "transition-colors duration-150 last:border-b-0 hover:bg-bg-subtle",
                selectedId === dipendente.id
                  ? "bg-brand-50 text-brand-500"
                  : "text-text-primary"
              )}
            >
              <span className="block font-medium">
                {getNomeCompleto(dipendente)}
              </span>
              <span className="mt-1 block text-xs text-text-muted">
                {dipendente.email}
              </span>
            </button>
          ))}

          {opzioniFiltrate.length === 0 && (
            <div className="px-3 py-3 text-sm text-text-muted">
              {noResultsLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
