"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { getMessaggioErrore } from "@/lib/errors";
import { creaCliente } from "@/services/clienti/creaCliente";
import { cercaClientiSimili } from "@/services/clienti/cercaClientiSimili";
import type { Cliente } from "@/types/clienti";

type Props = {
  label: string;
  placeholder: string;
  /** Testo corrente (ragione sociale, anche libero) */
  value: string;
  /** Cliente agganciato (null se testo libero) */
  selectedId: string | null;
  options: Cliente[];
  disabled?: boolean;
  onSearchChange: (value: string) => void;
  onSelect: (cliente: Cliente) => void;
  /** Notifica creazione nuovo cliente (già salvato a DB) */
  onCreate: (cliente: Cliente) => void;
  onError: (messaggio: string) => void;
};

export function SelectCliente({
  label,
  placeholder,
  value,
  selectedId,
  options,
  disabled,
  onSearchChange,
  onSelect,
  onCreate,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [aperto, setAperto] = useState(false);
  const [creazione, setCreazione] = useState(false);
  // Anti-doppioni: candidati simili in attesa di conferma
  const [simili, setSimili] = useState<Cliente[] | null>(null);

  const clienteSelezionato = useMemo(
    () => options.find((c) => c.id === selectedId) || null,
    [options, selectedId]
  );

  const opzioniFiltrate = useMemo(() => {
    const ricerca = value.trim().toLowerCase();
    const labelSelezionata =
      clienteSelezionato?.ragione_sociale.toLowerCase() ?? "";
    if (!ricerca || ricerca === labelSelezionata) return options;
    return options.filter((cliente) =>
      cliente.ragione_sociale.toLowerCase().includes(ricerca)
    );
  }, [options, value, clienteSelezionato]);

  const nomeNuovo = value.trim();
  const esisteEsatto = options.some(
    (c) => c.ragione_sociale.toLowerCase() === nomeNuovo.toLowerCase()
  );

  const chiudiDropdown = useCallback(() => {
    setAperto(false);
    setSimili(null);
  }, []);

  useEffect(() => {
    if (!aperto) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        chiudiDropdown();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") chiudiDropdown();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [aperto, chiudiDropdown]);

  const eseguiCreazione = async () => {
    try {
      setCreazione(true);
      const nuovo = await creaCliente({
        ragioneSociale: nomeNuovo,
        daVerificare: true,
      });
      onCreate(nuovo);
      chiudiDropdown();
      inputRef.current?.blur();
    } catch (error: unknown) {
      onError(getMessaggioErrore(error, "Errore creazione cliente"));
    } finally {
      setCreazione(false);
    }
  };

  const handleCreaClick = async () => {
    if (!nomeNuovo || creazione) return;

    try {
      setCreazione(true);
      // Anti-doppioni soft: prima di creare, cerca nomi simili
      const candidati = await cercaClientiSimili({ nome: nomeNuovo });
      const candidatiDiversi = candidati.filter(
        (c) => c.ragione_sociale.toLowerCase() !== nomeNuovo.toLowerCase()
      );

      if (candidatiDiversi.length > 0) {
        setSimili(candidatiDiversi);
        setCreazione(false);
        return;
      }
    } catch {
      // la ricerca simili è best-effort: in errore si procede a creare
    }

    await eseguiCreazione();
  };

  const selezionaCliente = (cliente: Cliente) => {
    onSelect(cliente);
    chiudiDropdown();
    inputRef.current?.blur();
  };

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
            setSimili(null);
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
          {simili ? (
            <>
              <div className="border-b border-border bg-warning-50 px-3 py-2 text-xs font-medium text-text-primary">
                Forse intendi:
              </div>
              {simili.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selezionaCliente(cliente)}
                  className="block w-full border-b border-border px-3 py-2.5 text-left text-sm text-text-primary transition-colors duration-150 hover:bg-bg-subtle"
                >
                  <span className="block font-medium">
                    {cliente.ragione_sociale}
                  </span>
                  {cliente.email && (
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {cliente.email}
                    </span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void eseguiCreazione()}
                disabled={creazione}
                className="block w-full px-3 py-2.5 text-left text-sm font-medium text-brand-500 transition-colors duration-150 hover:bg-bg-subtle disabled:opacity-50"
              >
                {creazione ? "Creazione..." : `Crea comunque «${nomeNuovo}»`}
              </button>
            </>
          ) : (
            <>
              {/* Voce dedicata sempre in cima: crea un nuovo cliente */}
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (nomeNuovo && !esisteEsatto) {
                    void handleCreaClick();
                  } else {
                    inputRef.current?.focus();
                  }
                }}
                disabled={creazione}
                className="flex w-full items-center gap-2 border-b border-border bg-brand-50/40 px-3 py-2.5 text-left text-sm font-medium text-brand-500 transition-colors duration-150 hover:bg-brand-50 disabled:opacity-50"
              >
                <Plus className="h-4 w-4 shrink-0" />
                {creazione
                  ? "Creazione..."
                  : nomeNuovo && !esisteEsatto
                    ? `Crea nuovo cliente «${nomeNuovo}»`
                    : "Nuovo cliente — scrivi la ragione sociale"}
              </button>

              {opzioniFiltrate.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selezionaCliente(cliente)}
                  className={cn(
                    "block w-full border-b border-border px-3 py-2.5 text-left text-sm",
                    "transition-colors duration-150 last:border-b-0 hover:bg-bg-subtle",
                    selectedId === cliente.id
                      ? "bg-brand-50 text-brand-500"
                      : "text-text-primary"
                  )}
                >
                  <span className="block font-medium">
                    {cliente.ragione_sociale}
                  </span>
                  {cliente.email && (
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {cliente.email}
                    </span>
                  )}
                </button>
              ))}

              {opzioniFiltrate.length === 0 && !nomeNuovo && (
                <div className="px-3 py-3 text-sm text-text-muted">
                  Nessun cliente in anagrafica
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
