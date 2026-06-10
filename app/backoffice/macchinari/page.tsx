"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Home, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { MACCHINARI_TESTI } from "@/constants/macchinari";

import { aggiornaMacchinario } from "@/services/macchinari/aggiornaMacchinario";
import { creaMacchinario } from "@/services/macchinari/creaMacchinario";
import { eliminaMacchinario } from "@/services/macchinari/eliminaMacchinario";
import { loadMacchinariAdmin } from "@/services/macchinari/loadMacchinariAdmin";
import { aggiornaTipoMacchinario } from "@/services/tipiMacchinario/aggiornaTipoMacchinario";
import { creaTipoMacchinario } from "@/services/tipiMacchinario/creaTipoMacchinario";
import { loadTipiMacchinario } from "@/services/tipiMacchinario/loadTipiMacchinario";

import type {
  Macchinario,
  MacchinarioInput,
  TipoMacchinarioRecord,
} from "@/types/macchinari";

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

// ─── Types ────────────────────────────────────────────────────────────────────

type MacchinarioForm = {
  nome: string;
  tipo_id: string;
  descrizione: string;
  costo_orario: string;
  attivo: boolean;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FORM_INIZIALE: MacchinarioForm = {
  nome: "",
  tipo_id: "",
  descrizione: "",
  costo_orario: "",
  attivo: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNumeroDecimale(value: string) {
  if (!value.trim()) return null;
  const numero = Number(value.trim().replace(",", "."));
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

// Label legacy per i vecchi codici (SCAVATORE, PLE, ...) salvati prima
// della tabella tipi_macchinario
function getTipoLabelLegacy(tipo: string) {
  const legacy =
    MACCHINARI_TESTI.CODA_TIPI[
      tipo as keyof typeof MACCHINARI_TESTI.CODA_TIPI
    ];
  return legacy ?? tipo;
}

function preparaPayload(
  form: MacchinarioForm,
  tipi: TipoMacchinarioRecord[]
): { payload: MacchinarioInput } | { errore: string } {
  const nome = form.nome.trim();
  if (!nome) return { errore: MACCHINARI_TESTI.ERRORI.NOME_OBBLIGATORIO };

  const tipoSelezionato = tipi.find((t) => t.id === form.tipo_id);
  if (!tipoSelezionato)
    return { errore: MACCHINARI_TESTI.ERRORI.TIPO_ANAGRAFICA_OBBLIGATORIO };

  return {
    payload: {
      nome,
      tipo: tipoSelezionato.nome,
      tipo_id: tipoSelezionato.id,
      descrizione: form.descrizione.trim(),
      costo_orario: parseNumeroDecimale(form.costo_orario),
      attivo: form.attivo,
    },
  };
}

function formatCostoOrario(costo: number | null): string {
  if (costo === null) return "—";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(costo);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeMacchinariPage() {
  const toast = useToast();

  const [macchinari, setMacchinari] = useState<Macchinario[]>([]);
  const [tipi, setTipi] = useState<TipoMacchinarioRecord[]>([]);
  const [nuovoTipoNome, setNuovoTipoNome] = useState("");
  const [salvataggioTipo, setSalvataggioTipo] = useState(false);
  const [form, setForm] = useState<MacchinarioForm>(FORM_INIZIALE);
  const [macchinarioInModificaId, setMacchinarioInModificaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const [confirmDeleteMacchinario, setConfirmDeleteMacchinario] = useState<Macchinario | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const tipoLabelById = useMemo(
    () => new Map(tipi.map((t) => [t.id, t.nome])),
    [tipi]
  );

  const getTipoLabel = useCallback(
    (m: Macchinario) =>
      (m.tipo_id && tipoLabelById.get(m.tipo_id)) ||
      getTipoLabelLegacy(m.tipo),
    [tipoLabelById]
  );

  const macchinariFiltrarti = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return macchinari;
    return macchinari.filter((m) =>
      `${m.nome} ${getTipoLabel(m)}`.toLowerCase().includes(q)
    );
  }, [macchinari, ricerca, getTipoLabel]);

  const formTitolo = macchinarioInModificaId ? "Modifica macchinario" : "Nuovo macchinario";

  // ── Init ───────────────────────────────────────────────────────────────────

  const caricaMacchinari = useCallback(async () => {
    try {
      setLoading(true);
      const dati = await loadMacchinariAdmin();
      setMacchinari(dati);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO));
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let attivo = true;

    const init = async () => {
      try {
        const [dati, tipiData] = await Promise.all([
          loadMacchinariAdmin(),
          loadTipiMacchinario(),
        ]);
        if (!attivo) return;
        setMacchinari(dati);
        setTipi(tipiData);
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoading(false);
      }
    };

    void init();
    return () => { attivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setMacchinarioInModificaId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const risultato = preparaPayload(form, tipi);

    if ("errore" in risultato) {
      toast.error(risultato.errore);
      return;
    }

    try {
      setSalvataggio(true);

      if (macchinarioInModificaId) {
        const aggiornato = await aggiornaMacchinario({
          macchinarioId: macchinarioInModificaId,
          macchinario: risultato.payload,
        });

        setMacchinari((correnti) =>
          correnti.map((m) => (m.id === aggiornato.id ? aggiornato : m))
        );

        toast.success(MACCHINARI_TESTI.MESSAGGI.MACCHINARIO_AGGIORNATO);
      } else {
        const nuovo = await creaMacchinario({ macchinario: risultato.payload });
        setMacchinari((correnti) => [nuovo, ...correnti]);
        toast.success(MACCHINARI_TESTI.MESSAGGI.MACCHINARIO_CREATO);
      }

      resetForm();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggio(false);
    }
  };

  const avviaModifica = (macchinario: Macchinario) => {
    setMacchinarioInModificaId(macchinario.id);
    setForm({
      nome: macchinario.nome,
      tipo_id: macchinario.tipo_id || "",
      descrizione: macchinario.descrizione,
      costo_orario: macchinario.costo_orario === null ? "" : String(macchinario.costo_orario),
      attivo: macchinario.attivo,
    });
  };

  // ── Handlers tipi macchinario ──────────────────────────────────────────────

  const handleAggiungiTipo = async () => {
    const nome = nuovoTipoNome.trim();
    if (!nome) return;

    try {
      setSalvataggioTipo(true);
      const nuovo = await creaTipoMacchinario({ nome });
      setTipi((correnti) =>
        [...correnti, nuovo].sort((a, b) => a.nome.localeCompare(b.nome))
      );
      setNuovoTipoNome("");
      toast.success(MACCHINARI_TESTI.MESSAGGI.TIPO_CREATO);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggioTipo(false);
    }
  };

  const handleRinominaTipo = async (tipo: TipoMacchinarioRecord) => {
    const nome = window.prompt(MACCHINARI_TESTI.TIPI_RINOMINA_PROMPT, tipo.nome)?.trim();
    if (!nome || nome === tipo.nome) return;

    try {
      setSalvataggioTipo(true);
      const aggiornato = await aggiornaTipoMacchinario({ tipoId: tipo.id, nome });
      setTipi((correnti) =>
        correnti
          .map((t) => (t.id === aggiornato.id ? aggiornato : t))
          .sort((a, b) => a.nome.localeCompare(b.nome))
      );
      toast.success(MACCHINARI_TESTI.MESSAGGI.TIPO_AGGIORNATO);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggioTipo(false);
    }
  };

  const handleToggleTipo = async (tipo: TipoMacchinarioRecord) => {
    try {
      setSalvataggioTipo(true);
      const aggiornato = await aggiornaTipoMacchinario({
        tipoId: tipo.id,
        attivo: !tipo.attivo,
      });
      setTipi((correnti) =>
        correnti.map((t) => (t.id === aggiornato.id ? aggiornato : t))
      );
      toast.success(MACCHINARI_TESTI.MESSAGGI.TIPO_AGGIORNATO);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggioTipo(false);
    }
  };

  const confirmElimina = (macchinario: Macchinario) => {
    setConfirmDeleteMacchinario(macchinario);
  };

  const eseguiElimina = async () => {
    if (!confirmDeleteMacchinario) return;
    const macchinario = confirmDeleteMacchinario;
    setConfirmDeleteMacchinario(null);

    try {
      setSalvataggio(true);

      await eliminaMacchinario({ macchinarioId: macchinario.id });

      setMacchinari((correnti) => correnti.filter((m) => m.id !== macchinario.id));

      toast.success(MACCHINARI_TESTI.MESSAGGI.MACCHINARIO_ELIMINATO);

      if (macchinarioInModificaId === macchinario.id) {
        resetForm();
      }
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO));
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
                {MACCHINARI_TESTI.BACKOFFICE}
              </Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">
                {MACCHINARI_TESTI.TIMBRATURE}
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
            {MACCHINARI_TESTI.BACKOFFICE}
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">
            {MACCHINARI_TESTI.ANAGRAFICA_TITOLO}
          </span>
        </nav>

        {/* Titolo */}
        <h1 className="font-heading text-2xl font-medium text-text-primary">
          {MACCHINARI_TESTI.ANAGRAFICA_TITOLO}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {MACCHINARI_TESTI.ANAGRAFICA_CARD_DESCRIZIONE}
        </p>

        {/* Grid 2 colonne */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">

          {/* ── Colonna sinistra: Form + tipi ── */}
          <div className="flex flex-col gap-5">
          <Card className="p-5">
            <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
              {formTitolo}
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label={MACCHINARI_TESTI.NOME}
                type="text"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                disabled={salvataggio}
              />

              <Select
                label={MACCHINARI_TESTI.TIPO}
                value={form.tipo_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, tipo_id: e.target.value }))
                }
                disabled={salvataggio}
              >
                <option value="">{MACCHINARI_TESTI.TIPO}</option>
                {tipi
                  .filter((t) => t.attivo || t.id === form.tipo_id)
                  .map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>
                      {tipo.nome}
                    </option>
                  ))}
              </Select>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-text-primary">
                  {MACCHINARI_TESTI.DESCRIZIONE}
                </label>
                <textarea
                  value={form.descrizione}
                  onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))}
                  disabled={salvataggio}
                  rows={3}
                  className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-muted resize-none"
                />
              </div>

              <Input
                label={MACCHINARI_TESTI.COSTO_ORARIO}
                type="number"
                min="0"
                step="0.01"
                value={form.costo_orario}
                onChange={(e) => setForm((f) => ({ ...f, costo_orario: e.target.value }))}
                disabled={salvataggio}
              />

              <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.attivo}
                  onChange={(e) => setForm((f) => ({ ...f, attivo: e.target.checked }))}
                  disabled={salvataggio}
                  className="h-4 w-4 accent-brand-500"
                />
                {MACCHINARI_TESTI.ATTIVO}
              </label>

              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  loading={salvataggio}
                  disabled={loading}
                  icon={!salvataggio ? <Plus className="h-4 w-4" /> : undefined}
                  className="flex-1"
                >
                  {macchinarioInModificaId ? "Salva modifiche" : "Aggiungi macchinario"}
                </Button>

                {macchinarioInModificaId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetForm}
                    disabled={salvataggio}
                  >
                    {MACCHINARI_TESTI.ANNULLA}
                  </Button>
                )}
              </div>
            </form>
          </Card>

          {/* ── Tipi macchinario ── */}
          <Card className="p-5">
            <h2 className="font-heading text-lg font-medium text-text-primary mb-1">
              {MACCHINARI_TESTI.TIPI_TITOLO}
            </h2>
            <p className="text-xs text-text-muted mb-4">
              {MACCHINARI_TESTI.TIPI_DESCRIZIONE}
            </p>

            <div className="flex gap-2 mb-4">
              <input
                value={nuovoTipoNome}
                onChange={(e) => setNuovoTipoNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAggiungiTipo();
                  }
                }}
                placeholder={MACCHINARI_TESTI.TIPI_PLACEHOLDER}
                disabled={salvataggioTipo}
                className="h-9 flex-1 min-w-0 px-3 text-sm border border-border rounded-md bg-bg-card text-text-primary placeholder:text-text-subtle outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors duration-150"
              />
              <Button
                size="sm"
                onClick={() => void handleAggiungiTipo()}
                disabled={salvataggioTipo || !nuovoTipoNome.trim()}
                icon={<Plus className="h-4 w-4" />}
              >
                {MACCHINARI_TESTI.TIPI_AGGIUNGI}
              </Button>
            </div>

            {tipi.length === 0 && !loading && (
              <p className="text-sm text-text-muted">{MACCHINARI_TESTI.TIPI_NESSUNO}</p>
            )}

            <ul className="flex flex-col">
              {tipi.map((tipo) => (
                <li
                  key={tipo.id}
                  className="flex items-center justify-between gap-2 border-b border-border last:border-b-0 py-2"
                >
                  <span
                    className={cn(
                      "text-sm",
                      tipo.attivo ? "text-text-primary" : "text-text-subtle line-through"
                    )}
                  >
                    {tipo.nome}
                  </span>
                  <span className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={MACCHINARI_TESTI.TIPI_RINOMINA}
                      onClick={() => void handleRinominaTipo(tipo)}
                      disabled={salvataggioTipo}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleToggleTipo(tipo)}
                      disabled={salvataggioTipo}
                    >
                      {tipo.attivo
                        ? MACCHINARI_TESTI.TIPI_DISATTIVA
                        : MACCHINARI_TESTI.TIPI_RIATTIVA}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          </div>

          {/* ── Colonna destra: Lista ── */}
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary">
                  {MACCHINARI_TESTI.LISTA_ANAGRAFICA}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {macchinari.length} macchinari totali
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <input
                    value={ricerca}
                    onChange={(e) => setRicerca(e.target.value)}
                    placeholder="Cerca macchinario..."
                    className="h-9 pl-8 pr-3 text-sm border border-border rounded-md bg-bg-card text-text-primary placeholder:text-text-subtle outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors duration-150"
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void caricaMacchinari()}
                  disabled={loading || salvataggio}
                >
                  Aggiorna
                </Button>
              </div>
            </div>

            {loading && (
              <p className="text-sm text-text-muted py-4">{MACCHINARI_TESTI.CARICAMENTO}</p>
            )}

            {!loading && macchinariFiltrarti.length === 0 && (
              <p className="text-sm text-text-muted py-4">
                {ricerca ? "Nessun macchinario trovato" : MACCHINARI_TESTI.NESSUNO_ANAGRAFICA}
              </p>
            )}

            {!loading && macchinariFiltrarti.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">
                        Macchinario
                      </th>
                      <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">
                        {MACCHINARI_TESTI.COSTO_ORARIO}
                      </th>
                      <th className="py-2.5 text-right text-xs font-medium text-text-muted" />
                    </tr>
                  </thead>

                  <tbody>
                    {macchinariFiltrarti.map((m) => (
                      <tr
                        key={m.id}
                        className={cn(
                          "group border-b border-border last:border-b-0",
                          "transition-colors duration-150 hover:bg-bg-base"
                        )}
                      >
                        <td className="py-3 pr-4 min-w-[160px]">
                          <p className="font-medium text-text-primary">{m.nome}</p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {getTipoLabel(m)}
                          </p>
                          {m.descrizione && (
                            <p className="text-xs text-text-subtle mt-0.5 truncate max-w-[200px]">
                              {m.descrizione}
                            </p>
                          )}
                          {!m.attivo && (
                            <Badge variant="muted" size="sm" className="mt-0.5">
                              {MACCHINARI_TESTI.DISATTIVO}
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 pr-4">
                          <p className="font-medium text-text-primary">
                            {formatCostoOrario(m.costo_orario)}
                          </p>
                          {m.costo_orario !== null && (
                            <p className="text-xs text-text-muted mt-0.5">
                              {MACCHINARI_TESTI.COSTO_ORARIO_VISIBILE}
                            </p>
                          )}
                        </td>

                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={MACCHINARI_TESTI.MODIFICA}
                              onClick={() => avviaModifica(m)}
                              disabled={salvataggio}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-error-500 hover:text-error-500"
                              aria-label={MACCHINARI_TESTI.ELIMINA}
                              onClick={() => confirmElimina(m)}
                              disabled={salvataggio}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      {confirmDeleteMacchinario && (
        <ConfirmDialog
          title={MACCHINARI_TESTI.ELIMINA}
          message={`Eliminare ${confirmDeleteMacchinario.nome}?`}
          confirmLabel={MACCHINARI_TESTI.ELIMINA}
          onConfirm={() => void eseguiElimina()}
          onCancel={() => setConfirmDeleteMacchinario(null)}
        />
      )}
    </div>
  );
}
