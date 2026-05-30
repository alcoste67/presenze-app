"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Home,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
} from "lucide-react";

import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import {
  LABEL_TIPO_CONTEGGIO_ORE,
  TIPO_CONTEGGIO_ORE,
  TIPO_CONTEGGIO_ORE_TESTI,
} from "@/constants/tipoConteggioOre";
import { PRODUTTIVITA_TESTI } from "@/constants/produttivita";
import { RAPPORTI_INTERVENTO_TESTI } from "@/constants/rapportiIntervento";
import { APP_ROUTES } from "@/constants/routes";

import { aggiornaDipendente } from "@/services/dipendenti/aggiornaDipendente";
import { creaDipendente } from "@/services/dipendenti/creaDipendente";
import { eliminaDipendenteSeVuoto } from "@/services/dipendenti/eliminaDipendenteSeVuoto";
import { loadDipendenti } from "@/services/dipendenti/loadDipendenti";

import {
  type Dipendente,
  type DipendenteInput,
  type RuoloDipendente,
  type TipoConteggioOre,
} from "@/types/dipendenti";

import { AppHeader } from "@/components/ui/AppHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

// ─── Constants ───────────────────────────────────────────────────────────────

const LABEL_RUOLI_DIPENDENTE: Record<RuoloDipendente, string> = {
  [RUOLI_DIPENDENTE.OPERAIO]: "Operaio",
  [RUOLI_DIPENDENTE.RESPONSABILE]: "Responsabile",
  [RUOLI_DIPENDENTE.UFFICIO]: "Ufficio",
  [RUOLI_DIPENDENTE.ADMIN]: "Admin",
};

const RUOLO_BADGE_VARIANT: Record<RuoloDipendente, BadgeProps["variant"]> = {
  [RUOLI_DIPENDENTE.ADMIN]: "brand",
  [RUOLI_DIPENDENTE.RESPONSABILE]: "info",
  [RUOLI_DIPENDENTE.OPERAIO]: "success",
  [RUOLI_DIPENDENTE.UFFICIO]: "muted",
};

const FORM_INIZIALE: DipendenteInput = {
  nome: "",
  cognome: "",
  email: "",
  ruolo: RUOLI_DIPENDENTE.OPERAIO,
  attivo: true,
  tipo_conteggio_ore: TIPO_CONTEGGIO_ORE.REALE,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMessaggioErrore(error: unknown) {
  return error instanceof Error ? error.message : "Errore gestione dipendenti";
}

function preparaDipendente(dipendente: DipendenteInput): DipendenteInput {
  return {
    nome: dipendente.nome.trim(),
    cognome: dipendente.cognome.trim(),
    email: dipendente.email.trim(),
    ruolo: dipendente.ruolo,
    attivo: dipendente.attivo,
    tipo_conteggio_ore: dipendente.tipo_conteggio_ore,
  };
}

function confrontaDipendenti(primo: Dipendente, secondo: Dipendente) {
  const confrontoCognome = primo.cognome.localeCompare(secondo.cognome);
  if (confrontoCognome !== 0) return confrontoCognome;
  return primo.nome.localeCompare(secondo.nome);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeDipendentiPage() {
  const toast = useToast();

  const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
  const [form, setForm] = useState<DipendenteInput>(FORM_INIZIALE);
  const [dipendenteInModificaId, setDipendenteInModificaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const [confirmDeleteDipendente, setConfirmDeleteDipendente] = useState<Dipendente | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const dipendentiFiltrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return dipendenti;
    return dipendenti.filter((d) =>
      `${d.nome} ${d.cognome} ${d.email}`.toLowerCase().includes(q)
    );
  }, [dipendenti, ricerca]);

  const formTitolo = dipendenteInModificaId ? "Modifica dipendente" : "Nuovo dipendente";

  // ── Init ───────────────────────────────────────────────────────────────────

  const caricaDipendenti = useCallback(async () => {
    try {
      setLoading(true);
      const dati = await loadDipendenti();
      setDipendenti(dati);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error));
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let attivo = true;

    const caricaDipendentiIniziali = async () => {
      try {
        const dati = await loadDipendenti();
        if (!attivo) return;
        setDipendenti(dati);
      } catch (error: unknown) {
        if (!attivo) return;
        toast.error(getMessaggioErrore(error));
      } finally {
        if (attivo) setLoading(false);
      }
    };

    void caricaDipendentiIniziali();

    return () => {
      attivo = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setDipendenteInModificaId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = preparaDipendente(form);

    if (!payload.nome) {
      toast.error("Inserisci il nome");
      return;
    }

    if (!payload.cognome) {
      toast.error("Inserisci il cognome");
      return;
    }

    if (!payload.email) {
      toast.error("Inserisci l'email");
      return;
    }

    try {
      setSalvataggio(true);

      if (dipendenteInModificaId) {
        const dipendenteAggiornato = await aggiornaDipendente({
          dipendenteId: dipendenteInModificaId,
          dipendente: payload,
        });

        setDipendenti((correnti) =>
          correnti
            .map((d) => (d.id === dipendenteAggiornato.id ? dipendenteAggiornato : d))
            .sort(confrontaDipendenti)
        );

        toast.success("Dipendente aggiornato");
      } else {
        const nuovoDipendente = await creaDipendente(payload);

        setDipendenti((correnti) =>
          [...correnti, nuovoDipendente].sort(confrontaDipendenti)
        );

        toast.success("Dipendente creato");
      }

      resetForm();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const avviaModifica = (dipendente: Dipendente) => {
    setDipendenteInModificaId(dipendente.id);
    setForm({
      nome: dipendente.nome,
      cognome: dipendente.cognome,
      email: dipendente.email,
      ruolo: dipendente.ruolo,
      attivo: dipendente.attivo,
      tipo_conteggio_ore: dipendente.tipo_conteggio_ore,
    });
  };

  const toggleAttivo = async (dipendente: Dipendente) => {
    try {
      setSalvataggio(true);

      const dipendenteAggiornato = await aggiornaDipendente({
        dipendenteId: dipendente.id,
        dipendente: {
          nome: dipendente.nome,
          cognome: dipendente.cognome,
          email: dipendente.email,
          ruolo: dipendente.ruolo,
          attivo: !dipendente.attivo,
          tipo_conteggio_ore: dipendente.tipo_conteggio_ore,
        },
      });

      setDipendenti((correnti) =>
        correnti
          .map((d) => (d.id === dipendenteAggiornato.id ? dipendenteAggiornato : d))
          .sort(confrontaDipendenti)
      );

      if (dipendenteInModificaId === dipendenteAggiornato.id) {
        setForm({
          nome: dipendenteAggiornato.nome,
          cognome: dipendenteAggiornato.cognome,
          email: dipendenteAggiornato.email,
          ruolo: dipendenteAggiornato.ruolo,
          attivo: dipendenteAggiornato.attivo,
          tipo_conteggio_ore: dipendenteAggiornato.tipo_conteggio_ore,
        });
      }

      toast.success(
        dipendenteAggiornato.attivo ? "Dipendente attivato" : "Dipendente disattivato"
      );
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const confirmElimina = (dipendente: Dipendente) => {
    if (dipendente.attivo) {
      toast.error("Disattiva il dipendente prima di eliminarlo");
      return;
    }
    setConfirmDeleteDipendente(dipendente);
  };

  const eseguiElimina = async () => {
    if (!confirmDeleteDipendente) return;
    const dipendente = confirmDeleteDipendente;
    setConfirmDeleteDipendente(null);

    try {
      setSalvataggio(true);

      await eliminaDipendenteSeVuoto(dipendente.id);

      if (dipendenteInModificaId === dipendente.id) {
        resetForm();
      }

      await caricaDipendenti();

      toast.success("Dipendente eliminato");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error));
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
          <span className="font-medium text-text-primary">Dipendenti</span>
        </nav>

        {/* Titolo */}
        <h1 className="font-heading text-2xl font-medium text-text-primary">Dipendenti</h1>
        <p className="mt-1 text-sm text-text-muted">Gestione anagrafica e ruoli</p>

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
                onChange={(e) =>
                  setForm((f) => ({ ...f, nome: e.target.value }))
                }
                disabled={salvataggio}
              />

              <Input
                label="Cognome"
                value={form.cognome}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cognome: e.target.value }))
                }
                disabled={salvataggio}
              />

              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                disabled={salvataggio}
              />

              <Select
                label="Ruolo"
                value={form.ruolo}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ruolo: e.target.value as RuoloDipendente }))
                }
                disabled={salvataggio}
              >
                {Object.values(RUOLI_DIPENDENTE).map((ruolo) => (
                  <option key={ruolo} value={ruolo}>
                    {LABEL_RUOLI_DIPENDENTE[ruolo]}
                  </option>
                ))}
              </Select>

              <Select
                label={TIPO_CONTEGGIO_ORE_TESTI.LABEL}
                value={form.tipo_conteggio_ore}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    tipo_conteggio_ore: e.target.value as TipoConteggioOre,
                  }))
                }
                disabled={salvataggio}
              >
                {Object.values(TIPO_CONTEGGIO_ORE).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {LABEL_TIPO_CONTEGGIO_ORE[tipo]}
                  </option>
                ))}
              </Select>

              <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.attivo}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, attivo: e.target.checked }))
                  }
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
                  {dipendenteInModificaId ? "Salva modifiche" : "Aggiungi dipendente"}
                </Button>

                {dipendenteInModificaId && (
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
                  Lista dipendenti
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {dipendenti.length} dipendenti totali
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <input
                    value={ricerca}
                    onChange={(e) => setRicerca(e.target.value)}
                    placeholder="Cerca per nome o email..."
                    className="h-9 pl-8 pr-3 text-sm border border-border rounded-md bg-bg-card text-text-primary placeholder:text-text-subtle outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors duration-150"
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void caricaDipendenti()}
                  disabled={loading || salvataggio}
                >
                  Aggiorna
                </Button>
              </div>
            </div>

            {loading && (
              <p className="text-sm text-text-muted py-4">Caricamento...</p>
            )}

            {!loading && dipendentiFiltrati.length === 0 && (
              <p className="text-sm text-text-muted py-4">
                {ricerca ? "Nessun dipendente trovato" : "Nessun dipendente"}
              </p>
            )}

            {!loading && dipendentiFiltrati.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">
                        Dipendente
                      </th>
                      <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">
                        Ruolo
                      </th>
                      <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">
                        Ore
                      </th>
                      <th className="py-2.5 text-right text-xs font-medium text-text-muted" />
                    </tr>
                  </thead>

                  <tbody>
                    {dipendentiFiltrati.map((d) => (
                      <tr
                        key={d.id}
                        className={cn(
                          "group border-b border-border last:border-b-0",
                          "transition-colors duration-150 hover:bg-bg-base"
                        )}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={`${d.nome} ${d.cognome}`}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-text-primary truncate">
                                {d.nome} {d.cognome}
                              </p>
                              <p className="text-xs text-text-muted truncate">
                                {d.email}
                              </p>
                              {!d.attivo && (
                                <Badge variant="muted" size="sm" className="mt-0.5">
                                  Non attivo
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 pr-4">
                          <Badge variant={RUOLO_BADGE_VARIANT[d.ruolo]} size="sm">
                            {LABEL_RUOLI_DIPENDENTE[d.ruolo]}
                          </Badge>
                        </td>

                        <td className="py-3 pr-4 text-text-muted">
                          {LABEL_TIPO_CONTEGGIO_ORE[d.tipo_conteggio_ore]}
                        </td>

                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label="Modifica"
                              onClick={() => avviaModifica(d)}
                              disabled={salvataggio}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={d.attivo ? "Disattiva" : "Attiva"}
                              onClick={() => void toggleAttivo(d)}
                              disabled={salvataggio}
                            >
                              <Power className="h-4 w-4" />
                            </Button>

                            {!d.attivo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-error-500 hover:text-error-500"
                                aria-label="Elimina"
                                onClick={() => confirmElimina(d)}
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

      {confirmDeleteDipendente && (
        <ConfirmDialog
          title="Elimina dipendente"
          message={`Eliminare definitivamente ${confirmDeleteDipendente.cognome} ${confirmDeleteDipendente.nome}?`}
          confirmLabel="Elimina"
          onConfirm={() => void eseguiElimina()}
          onCancel={() => setConfirmDeleteDipendente(null)}
        />
      )}
    </div>
  );
}
