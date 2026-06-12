"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";

import { PRODUTTIVITA_TESTI } from "@/constants/produttivita";
import { RAPPORTI_INTERVENTO_TESTI } from "@/constants/rapportiIntervento";
import { APP_ROUTES } from "@/constants/routes";

import { aggiornaCantiere } from "@/services/cantieri/aggiornaCantiere";
import { creaCantiere } from "@/services/cantieri/creaCantiere";
import { eliminaCantiereSeVuoto } from "@/services/cantieri/eliminaCantiereSeVuoto";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadClienti } from "@/services/clienti/loadClienti";
import type { Cliente } from "@/types/clienti";

import {
  type CantiereBackoffice,
  type CantiereInput,
} from "@/types/cantieri";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getMessaggioErrore } from "@/lib/errors";

// ─── Constants ───────────────────────────────────────────────────────────────

const FORM_INIZIALE: CantiereInput = {
  nome: "",
  indirizzo: "",
  lavorazioni: "",
  attivo: true,
  cliente_id: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────


function preparaCantiere(cantiere: CantiereInput): CantiereInput {
  return {
    nome: cantiere.nome.trim(),
    indirizzo: cantiere.indirizzo.trim(),
    lavorazioni: cantiere.lavorazioni.trim(),
    attivo: cantiere.attivo,
    cliente_id: cantiere.cliente_id,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeCantieriPage() {
  const toast = useToast();

  const [cantieri, setCantieri] = useState<CantiereBackoffice[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [form, setForm] = useState<CantiereInput>(FORM_INIZIALE);
  const [cantiereInModificaId, setCantiereInModificaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const [confirmDeleteCantiere, setConfirmDeleteCantiere] = useState<CantiereBackoffice | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const cantieriFiltrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return cantieri;
    return cantieri.filter((c) =>
      `${c.nome} ${c.indirizzo}`.toLowerCase().includes(q)
    );
  }, [cantieri, ricerca]);

  const formTitolo = cantiereInModificaId ? "Modifica cantiere" : "Nuovo cantiere";

  // ── Init ───────────────────────────────────────────────────────────────────

  const caricaCantieri = useCallback(async () => {
    try {
      setLoading(true);
      const dati = await loadCantieriBackoffice();
      setCantieri(dati);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore gestione cantieri"));
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let attivo = true;

    const caricaCantieriIniziali = async () => {
      try {
        const [dati, clientiData] = await Promise.all([
          loadCantieriBackoffice(),
          loadClienti(),
        ]);
        if (!attivo) return;
        setCantieri(dati);
        setClienti(clientiData);
      } catch (error: unknown) {
        if (!attivo) return;
        toast.error(getMessaggioErrore(error, "Errore gestione cantieri"));
      } finally {
        if (attivo) setLoading(false);
      }
    };

    void caricaCantieriIniziali();

    return () => {
      attivo = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setCantiereInModificaId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = preparaCantiere(form);

    if (!payload.nome) {
      toast.error("Inserisci il nome del cantiere");
      return;
    }

    try {
      setSalvataggio(true);

      if (cantiereInModificaId) {
        const cantiereAggiornato = await aggiornaCantiere({
          cantiereId: cantiereInModificaId,
          cantiere: payload,
        });

        setCantieri((correnti) =>
          correnti.map((c) =>
            c.id === cantiereAggiornato.id ? cantiereAggiornato : c
          )
        );

        toast.success("Cantiere aggiornato");
      } else {
        const nuovoCantiere = await creaCantiere(payload);

        setCantieri((correnti) =>
          [...correnti, nuovoCantiere].sort((a, b) => a.nome.localeCompare(b.nome))
        );

        toast.success("Cantiere creato");
      }

      resetForm();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore gestione cantieri"));
    } finally {
      setSalvataggio(false);
    }
  };

  const avviaModifica = (cantiere: CantiereBackoffice) => {
    setCantiereInModificaId(cantiere.id);
    setForm({
      nome: cantiere.nome,
      indirizzo: cantiere.indirizzo,
      lavorazioni: cantiere.lavorazioni,
      attivo: cantiere.attivo,
      cliente_id: cantiere.cliente_id ?? null,
    });
  };

  const approvaCantiere = async (cantiere: CantiereBackoffice) => {
    try {
      setSalvataggio(true);
      const aggiornato = await aggiornaCantiere({
        cantiereId: cantiere.id,
        cantiere: {
          nome: cantiere.nome,
          indirizzo: cantiere.indirizzo,
          lavorazioni: cantiere.lavorazioni,
          attivo: cantiere.attivo,
          cliente_id: cantiere.cliente_id ?? null,
          da_verificare: false,
        },
      });
      setCantieri((correnti) =>
        correnti.map((c) => (c.id === aggiornato.id ? aggiornato : c))
      );
      toast.success("Cantiere approvato");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore gestione cantieri"));
    } finally {
      setSalvataggio(false);
    }
  };

  const toggleAttivo = async (cantiere: CantiereBackoffice) => {
    try {
      setSalvataggio(true);

      const cantiereAggiornato = await aggiornaCantiere({
        cantiereId: cantiere.id,
        cantiere: {
          nome: cantiere.nome,
          indirizzo: cantiere.indirizzo,
          lavorazioni: cantiere.lavorazioni,
          attivo: !cantiere.attivo,
          cliente_id: cantiere.cliente_id ?? null,
        },
      });

      setCantieri((correnti) =>
        correnti.map((c) =>
          c.id === cantiereAggiornato.id ? cantiereAggiornato : c
        )
      );

      if (cantiereInModificaId === cantiereAggiornato.id) {
        setForm({
          nome: cantiereAggiornato.nome,
          indirizzo: cantiereAggiornato.indirizzo,
          lavorazioni: cantiereAggiornato.lavorazioni,
          attivo: cantiereAggiornato.attivo,
          cliente_id: cantiereAggiornato.cliente_id ?? null,
        });
      }

      toast.success(
        cantiereAggiornato.attivo ? "Cantiere attivato" : "Cantiere disattivato"
      );
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore gestione cantieri"));
    } finally {
      setSalvataggio(false);
    }
  };

  const confirmElimina = (cantiere: CantiereBackoffice) => {
    if (cantiere.attivo) {
      toast.error("Disattiva il cantiere prima di eliminarlo");
      return;
    }
    setConfirmDeleteCantiere(cantiere);
  };

  const eseguiElimina = async () => {
    if (!confirmDeleteCantiere) return;
    const cantiere = confirmDeleteCantiere;
    setConfirmDeleteCantiere(null);

    try {
      setSalvataggio(true);

      await eliminaCantiereSeVuoto(cantiere.id);

      if (cantiereInModificaId === cantiere.id) {
        resetForm();
      }

      await caricaCantieri();

      toast.success("Cantiere eliminato");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore gestione cantieri"));
    } finally {
      setSalvataggio(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            <Link href={APP_ROUTES.BACKOFFICE}>
              <Button variant="secondary" size="sm">
                {PRODUTTIVITA_TESTI.BACKOFFICE}
              </Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">
                {RAPPORTI_INTERVENTO_TESTI.TIMBRATURE}
              </Button>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-[1000px] px-6 py-6">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="mb-5 flex items-center gap-1.5 text-sm text-text-muted"
        >
          <Link
            href={APP_ROUTES.HOME}
            className="hover:text-text-primary transition-colors duration-150"
          >
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link
            href={APP_ROUTES.BACKOFFICE}
            className="hover:text-text-primary transition-colors duration-150"
          >
            {PRODUTTIVITA_TESTI.BACKOFFICE}
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">Cantieri</span>
        </nav>

        {/* Titolo */}
        <h1 className="font-heading text-2xl font-medium text-text-primary">Cantieri</h1>
        <p className="mt-1 text-sm text-text-muted">Gestione anagrafica cantieri</p>

        {/* Grid 2 colonne */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">

          {/* ── Colonna sinistra: Form ── */}
          <Card className="p-5">
            <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
              {formTitolo}
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Nome"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                disabled={salvataggio}
              />

              <Input
                label="Indirizzo"
                value={form.indirizzo}
                onChange={(e) => setForm((f) => ({ ...f, indirizzo: e.target.value }))}
                disabled={salvataggio}
              />

              <Select
                label="Cliente"
                value={form.cliente_id ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cliente_id: e.target.value || null }))
                }
                disabled={salvataggio}
              >
                <option value="">Nessun cliente</option>
                {clienti.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.ragione_sociale}
                  </option>
                ))}
              </Select>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-text-primary">
                  Lavorazioni
                </label>
                <textarea
                  value={form.lavorazioni}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lavorazioni: e.target.value }))
                  }
                  disabled={salvataggio}
                  rows={4}
                  className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-muted resize-none"
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.attivo}
                  onChange={(e) => setForm((f) => ({ ...f, attivo: e.target.checked }))}
                  disabled={salvataggio}
                  className="h-4 w-4 accent-brand-500"
                />
                Attivo
              </label>

              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  loading={salvataggio}
                  icon={!salvataggio ? <Plus className="h-4 w-4" /> : undefined}
                  className="flex-1"
                >
                  {cantiereInModificaId ? "Salva modifiche" : "Aggiungi cantiere"}
                </Button>

                {cantiereInModificaId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetForm}
                    disabled={salvataggio}
                  >
                    Annulla
                  </Button>
                )}
              </div>
            </form>
          </Card>

          {/* ── Colonna destra: Lista ── */}
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary">
                  Lista cantieri
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {cantieri.length} cantieri totali
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <input
                    value={ricerca}
                    onChange={(e) => setRicerca(e.target.value)}
                    placeholder="Cerca cantiere..."
                    className="h-9 pl-8 pr-3 text-sm border border-border rounded-md bg-bg-card text-text-primary placeholder:text-text-subtle outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors duration-150"
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void caricaCantieri()}
                  disabled={loading || salvataggio}
                >
                  Aggiorna
                </Button>
              </div>
            </div>

            {loading && (
              <p className="text-sm text-text-muted py-4">Caricamento...</p>
            )}

            {!loading && cantieriFiltrati.length === 0 && (
              <p className="text-sm text-text-muted py-4">
                {ricerca ? "Nessun cantiere trovato" : "Nessun cantiere"}
              </p>
            )}

            {!loading && cantieriFiltrati.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">
                        Cantiere
                      </th>
                      <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">
                        Lavorazioni
                      </th>
                      <th className="py-2.5 text-right text-xs font-medium text-text-muted" />
                    </tr>
                  </thead>

                  <tbody>
                    {cantieriFiltrati.map((c) => (
                      <tr
                        key={c.id}
                        className={cn(
                          "group border-b border-border last:border-b-0",
                          "transition-colors duration-150 hover:bg-bg-base"
                        )}
                      >
                        <td className="py-3 pr-4 min-w-[160px]">
                          <p className="font-medium text-text-primary">{c.nome}</p>
                          {c.indirizzo && (
                            <p className="text-xs text-text-muted mt-0.5">{c.indirizzo}</p>
                          )}
                          {c.da_verificare && (
                            <span className="mt-0.5 inline-flex items-center gap-2">
                              <Badge variant="warning" size="sm">Da verificare</Badge>
                              <button
                                type="button"
                                onClick={() => void approvaCantiere(c)}
                                disabled={salvataggio}
                                className="text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors disabled:opacity-50"
                              >
                                Approva
                              </button>
                            </span>
                          )}
                          {!c.attivo && (
                            <Badge variant="muted" size="sm" className="mt-0.5">
                              Non attivo
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 pr-4 max-w-[220px]">
                          {c.lavorazioni ? (
                            <p className="text-text-muted truncate" title={c.lavorazioni}>
                              {c.lavorazioni}
                            </p>
                          ) : (
                            <span className="text-text-subtle">—</span>
                          )}
                        </td>

                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label="Modifica"
                              onClick={() => avviaModifica(c)}
                              disabled={salvataggio}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={c.attivo ? "Disattiva" : "Attiva"}
                              onClick={() => void toggleAttivo(c)}
                              disabled={salvataggio}
                            >
                              <Power className="h-4 w-4" />
                            </Button>

                            {!c.attivo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-error-500 hover:text-error-500"
                                aria-label="Elimina"
                                onClick={() => confirmElimina(c)}
                                disabled={salvataggio}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </main>

      {confirmDeleteCantiere && (
        <ConfirmDialog
          title="Elimina cantiere"
          message={`Eliminare definitivamente il cantiere "${confirmDeleteCantiere.nome}"?`}
          confirmLabel="Elimina"
          onConfirm={() => void eseguiElimina()}
          onCancel={() => setConfirmDeleteCantiere(null)}
        />
      )}
    </div>
  );
}
