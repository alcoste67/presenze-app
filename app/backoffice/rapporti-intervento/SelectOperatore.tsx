"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import type { Dipendente } from "@/types/dipendenti";

const DROPDOWN_OFFSET_Y = 4;
const DROPDOWN_Z_INDEX = 9999;

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

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
  const dropdownRef =
    useRef<HTMLDivElement | null>(null);
  const inputRef =
    useRef<HTMLInputElement | null>(null);
  const selezioneAppenaFattaRef =
    useRef(false);
  const [aperto, setAperto] = useState(false);
  const [dropdownPosition, setDropdownPosition] =
    useState<DropdownPosition | null>(null);
  const portalRoot =
    typeof document === "undefined"
      ? null
      : document.body;

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

  const aggiornaPosizioneDropdown = useCallback(() => {
    const rect =
      containerRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    setDropdownPosition({
      top: rect.bottom + DROPDOWN_OFFSET_Y,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  const apriDropdown = useCallback(() => {
    aggiornaPosizioneDropdown();
    setAperto(true);
  }, [aggiornaPosizioneDropdown]);

  useEffect(() => {
    const handlePointerDown = (
      event: PointerEvent
    ) => {
      const target = event.target as Node;

      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !dropdownRef.current?.contains(target)
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

  useEffect(() => {
    if (!aperto || disabled) {
      return;
    }

    window.addEventListener(
      "resize",
      aggiornaPosizioneDropdown
    );
    window.addEventListener(
      "scroll",
      aggiornaPosizioneDropdown,
      true
    );

    return () => {
      window.removeEventListener(
        "resize",
        aggiornaPosizioneDropdown
      );
      window.removeEventListener(
        "scroll",
        aggiornaPosizioneDropdown,
        true
      );
    };
  }, [aperto, disabled, aggiornaPosizioneDropdown]);

  return (
    <>
      <div ref={containerRef} className="relative">
        <label className="mb-1 block text-xs font-medium text-text-muted">
          {label}
        </label>

        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onFocus={apriDropdown}
            onChange={(event) => {
              onSearchChange(event.target.value);
              apriDropdown();
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
            className="w-full rounded-md border border-border bg-bg-card px-3 py-2.5 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-subtle focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-muted"
          />

          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
            ▾
          </span>
        </div>
      </div>

      {aperto &&
        !disabled &&
        dropdownPosition &&
        portalRoot &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed max-h-64 overflow-auto rounded-md border border-border bg-white shadow-lg"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: DROPDOWN_Z_INDEX,
            }}
          >
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
              );
            })}

            {opzioniFiltrate.length === 0 && (
              <div className="px-3 py-3 text-sm text-text-muted">
                {noResultsLabel}
              </div>
            )}
          </div>,
          portalRoot
        )}
    </>
  );
}
