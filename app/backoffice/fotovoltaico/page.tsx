"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileUp, Home, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { MODULI_FOTOVOLTAICI_TESTI } from "@/constants/moduliFotovoltaici";

import { aggiornaModuloFotovoltaico } from "@/services/moduliFotovoltaici/aggiornaModuloFotovoltaico";
import { creaModuloFotovoltaico } from "@/services/moduliFotovoltaici/creaModuloFotovoltaico";
import { eliminaModuloFotovoltaico } from "@/services/moduliFotovoltaici/eliminaModuloFotovoltaico";
import { estraiModuloDaScheda } from "@/services/moduliFotovoltaici/estraiModuloDaScheda";
import { loadModuliFotovoltaiciAdmin } from "@/services/moduliFotovoltaici/loadModuliFotovoltaiciAdmin";

import type {
  ModuloFotovoltaico,
  ModuloFotovoltaicoInput,
} from "@/types/moduliFotovoltaici";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getMessaggioErrore } from "@/lib/errors";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModuloForm = {
  marca: string;
  modello: string;
  potenza_wp: string;
  lunghezza_mm: string;
  larghezza_mm: string;
  spessore_mm: string;
  peso_kg: string;
  attivo: boolean;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FORM_INIZIALE: ModuloForm = {
  marca: "",
  modello: "",
  potenza_wp: "",
  lunghezza_mm: "",
  larghezza_mm: "",
  spessore_mm: "",
  peso_kg: "",
  attivo: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseNumeroDecimale(value: string) {
  if (!value.trim()) return null;
  const numero = Number(value.trim().replace(",", "."));
  return Number.isFinite(numero) && numero >= 0 ? numero : null;
}

function preparaPayload(
  form: ModuloForm
): { payload: ModuloFotovoltaicoInput } | { errore: string } {
  const marca = form.marca.trim();
  if (!marca) return { errore: MODULI_FOTOVOLTAICI_TESTI.ERRORI.MARCA_OBBLIGATORIA };

  const modello = form.modello.trim();
  if (!modello) return { errore: MODULI_FOTOVOLTAICI_TESTI.ERRORI.MODELLO_OBBLIGATORIO };

  const potenzaWp = parseNumeroDecimale(form.potenza_wp);
  if (!potenzaWp || potenzaWp <= 0) {
    return { errore: MODULI_FOTOVOLTAICI_TESTI.ERRORI.POTENZA_NON_VALIDA };
  }

  const lunghezzaMm = parseNumeroDecimale(form.lunghezza_mm);
  const larghezzaMm = parseNumeroDecimale(form.larghezza_mm);
  if (!lunghezzaMm || lunghezzaMm <= 0 || !larghezzaMm || larghezzaMm <= 0) {
    return { errore: MODULI_FOTOVOLTAICI_TESTI.ERRORI.DIMENSIONI_NON_VALIDE };
  }

  return {
    payload: {
      marca,
      modello,
      potenza_wp: potenzaWp,
      lunghezza_mm: lunghezzaMm,
      larghezza_mm: larghezzaMm,
      spessore_mm: parseNumeroDecimale(form.spessore_mm),
      peso_kg: parseNumeroDecimale(form.peso_kg),
      attivo: form.attivo,
    },
  };
}

function formatPotenza(wp: number): string {
  return `${new Intl.NumberFormat("it-IT").format(wp)} Wp`;
}

function formatDimensioni(m: ModuloFotovoltaico): string {
  const base = `${m.lunghezza_mm} × ${m.larghezza_mm} mm`;
  return m.spessore_mm ? `${base} × ${m.spessore_mm} mm` : base;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeFotovoltaicoPage() {
  const toast = useToast();
  const inputFileRef = useRef<HTMLInputElement>(null);

  const [moduli, setModuli] = useState<ModuloFotovoltaico[]>([]);
  const [form, setForm] = useState<ModuloForm>(FORM_INIZIALE);
  const [moduloInModificaId, setModuloInModificaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [importazione, setImportazione] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const [confirmDeleteModulo, setConfirmDeleteModulo] = useState<ModuloFotovoltaico | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const moduliFiltrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return moduli;
    return moduli.filter((m) => `${m.marca} ${m.modello}`.toLowerCase().includes(q));
  }, [moduli, ricerca]);

  const formTitolo = moduloInModificaId ? "Modifica modulo" : "Nuovo modulo";

  // ── Init ───────────────────────────────────────────────────────────────────

  const caricaModuli = useCallback(async () => {
    try {
      setLoading(true);
      const dati = await loadModuliFotovoltaiciAdmin();
      setModuli(dati);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, MODULI_FOTOVOLTAICI_TESTI.ERRORI.GENERICO));
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void caricaModuli();
  }, [caricaModuli]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setModuloInModificaId(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const risultato = preparaPayload(form);

    if ("errore" in risultato) {
      toast.error(risultato.errore);
      return;
    }

    try {
      setSalvataggio(true);

      if (moduloInModificaId) {
        const aggiornato = await aggiornaModuloFotovoltaico({
          moduloId: moduloInModificaId,
          modulo: risultato.payload,
        });

        setModuli((correnti) => correnti.map((m) => (m.id === aggiornato.id ? aggiornato : m)));

        toast.success(MODULI_FOTOVOLTAICI_TESTI.MESSAGGI.MODULO_AGGIORNATO);
      } else {
        const nuovo = await creaModuloFotovoltaico({ modulo: risultato.payload });
        setModuli((correnti) => [nuovo, ...correnti]);
        toast.success(MODULI_FOTOVOLTAICI_TESTI.MESSAGGI.MODULO_CREATO);
      }

      resetForm();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, MODULI_FOTOVOLTAICI_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggio(false);
    }
  };

  const avviaModifica = (modulo: ModuloFotovoltaico) => {
    setModuloInModificaId(modulo.id);
    setForm({
      marca: modulo.marca,
      modello: modulo.modello,
      potenza_wp: String(modulo.potenza_wp),
      lunghezza_mm: String(modulo.lunghezza_mm),
      larghezza_mm: String(modulo.larghezza_mm),
      spessore_mm: modulo.spessore_mm === null ? "" : String(modulo.spessore_mm),
      peso_kg: modulo.peso_kg === null ? "" : String(modulo.peso_kg),
      attivo: modulo.attivo,
    });
  };

  const handleImportaFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setImportazione(true);
      const preview = await estraiModuloDaScheda(file);

      setModuloInModificaId(null);
      setForm((f) => ({
        ...f,
        marca: preview.marca ?? f.marca,
        modello: preview.modello ?? f.modello,
        potenza_wp: preview.potenza_wp !== undefined ? String(preview.potenza_wp) : f.potenza_wp,
        lunghezza_mm:
          preview.lunghezza_mm !== undefined ? String(preview.lunghezza_mm) : f.lunghezza_mm,
        larghezza_mm:
          preview.larghezza_mm !== undefined ? String(preview.larghezza_mm) : f.larghezza_mm,
        spessore_mm:
          preview.spessore_mm !== undefined ? String(preview.spessore_mm) : f.spessore_mm,
        peso_kg: preview.peso_kg !== undefined ? String(preview.peso_kg) : f.peso_kg,
      }));

      toast.success(MODULI_FOTOVOLTAICI_TESTI.MESSAGGI.DATI_IMPORTATI);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, MODULI_FOTOVOLTAICI_TESTI.ERRORI.AI_ESTRAZIONE_FALLITA));
    } finally {
      setImportazione(false);
    }
  };

  const confirmElimina = (modulo: ModuloFotovoltaico) => {
    setConfirmDeleteModulo(modulo);
  };

  const eseguiElimina = async () => {
    if (!confirmDeleteModulo) return;
    const modulo = confirmDeleteModulo;
    setConfirmDeleteModulo(null);

    try {
      setSalvataggio(true);

      await eliminaModuloFotovoltaico({ moduloId: modulo.id });

      setModuli((correnti) => correnti.filter((m) => m.id !== modulo.id));

      toast.success(MODULI_FOTOVOLTAICI_TESTI.MESSAGGI.MODULO_ELIMINATO);

      if (moduloInModificaId === modulo.id) {
        resetForm();
      }
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, MODULI_FOTOVOLTAICI_TESTI.ERRORI.GENERICO));
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
                {MODULI_FOTOVOLTAICI_TESTI.BACKOFFICE}
              </Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">
                {MODULI_FOTOVOLTAICI_TESTI.TIMBRATURE}
              </Button>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-[1000px] px-6 py-6">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link
            href={APP_ROUTES.BACKOFFICE}
            className="hover:text-text-primary transition-colors duration-150"
          >
            {MODULI_FOTOVOLTAICI_TESTI.BACKOFFICE}
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">
            {MODULI_FOTOVOLTAICI_TESTI.ANAGRAFICA_TITOLO}
          </span>
        </nav>

        {/* Titolo */}
        <h1 className="font-heading text-2xl font-medium text-text-primary">
          {MODULI_FOTOVOLTAICI_TESTI.ANAGRAFICA_TITOLO}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {MODULI_FOTOVOLTAICI_TESTI.ANAGRAFICA_CARD_DESCRIZIONE}
        </p>

        {/* Grid 2 colonne */}
        <div className="mt-6 grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* ── Colonna sinistra: Form ── */}
          <div className="flex flex-col gap-5 min-w-0">
            <Card className="p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="font-heading text-lg font-medium text-text-primary">{formTitolo}</h2>
              </div>

              <input
                ref={inputFileRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => void handleImportaFile(e)}
              />
              <Button
                type="button"
                variant="secondary"
                className="mb-4 w-full"
                loading={importazione}
                disabled={salvataggio}
                icon={!importazione ? <FileUp className="h-4 w-4" /> : undefined}
                onClick={() => inputFileRef.current?.click()}
              >
                {importazione
                  ? MODULI_FOTOVOLTAICI_TESTI.IMPORTA_IN_CORSO
                  : MODULI_FOTOVOLTAICI_TESTI.IMPORTA_DA_SCHEDA}
              </Button>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label={MODULI_FOTOVOLTAICI_TESTI.MARCA}
                  type="text"
                  value={form.marca}
                  onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                  disabled={salvataggio}
                />

                <Input
                  label={MODULI_FOTOVOLTAICI_TESTI.MODELLO}
                  type="text"
                  value={form.modello}
                  onChange={(e) => setForm((f) => ({ ...f, modello: e.target.value }))}
                  disabled={salvataggio}
                />

                <Input
                  label={MODULI_FOTOVOLTAICI_TESTI.POTENZA_WP}
                  type="number"
                  min="0"
                  step="1"
                  value={form.potenza_wp}
                  onChange={(e) => setForm((f) => ({ ...f, potenza_wp: e.target.value }))}
                  disabled={salvataggio}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={MODULI_FOTOVOLTAICI_TESTI.LUNGHEZZA_MM}
                    type="number"
                    min="0"
                    step="1"
                    value={form.lunghezza_mm}
                    onChange={(e) => setForm((f) => ({ ...f, lunghezza_mm: e.target.value }))}
                    disabled={salvataggio}
                  />
                  <Input
                    label={MODULI_FOTOVOLTAICI_TESTI.LARGHEZZA_MM}
                    type="number"
                    min="0"
                    step="1"
                    value={form.larghezza_mm}
                    onChange={(e) => setForm((f) => ({ ...f, larghezza_mm: e.target.value }))}
                    disabled={salvataggio}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={MODULI_FOTOVOLTAICI_TESTI.SPESSORE_MM}
                    type="number"
                    min="0"
                    step="1"
                    value={form.spessore_mm}
                    onChange={(e) => setForm((f) => ({ ...f, spessore_mm: e.target.value }))}
                    disabled={salvataggio}
                  />
                  <Input
                    label={MODULI_FOTOVOLTAICI_TESTI.PESO_KG}
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.peso_kg}
                    onChange={(e) => setForm((f) => ({ ...f, peso_kg: e.target.value }))}
                    disabled={salvataggio}
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
                  {MODULI_FOTOVOLTAICI_TESTI.ATTIVO}
                </label>

                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    loading={salvataggio}
                    disabled={loading}
                    icon={!salvataggio ? <Plus className="h-4 w-4" /> : undefined}
                    className="flex-1"
                  >
                    {moduloInModificaId ? "Salva modifiche" : "Aggiungi modulo"}
                  </Button>

                  {moduloInModificaId && (
                    <Button type="button" variant="secondary" onClick={resetForm} disabled={salvataggio}>
                      {MODULI_FOTOVOLTAICI_TESTI.ANNULLA}
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          </div>

          {/* ── Colonna destra: Lista ── */}
          <Card className="p-5 min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary">
                  {MODULI_FOTOVOLTAICI_TESTI.LISTA_ANAGRAFICA}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">{moduli.length} moduli totali</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                  <input
                    value={ricerca}
                    onChange={(e) => setRicerca(e.target.value)}
                    placeholder="Cerca modulo..."
                    className="h-9 pl-8 pr-3 text-sm border border-border rounded-md bg-bg-card text-text-primary placeholder:text-text-subtle outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors duration-150"
                  />
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void caricaModuli()}
                  disabled={loading || salvataggio}
                >
                  Aggiorna
                </Button>
              </div>
            </div>

            {loading && <p className="text-sm text-text-muted py-4">{MODULI_FOTOVOLTAICI_TESTI.CARICAMENTO}</p>}

            {!loading && moduliFiltrati.length === 0 && (
              <p className="text-sm text-text-muted py-4">
                {ricerca ? "Nessun modulo trovato" : MODULI_FOTOVOLTAICI_TESTI.NESSUNO_ANAGRAFICA}
              </p>
            )}

            {!loading && moduliFiltrati.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">Modulo</th>
                      <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">
                        {MODULI_FOTOVOLTAICI_TESTI.POTENZA_WP}
                      </th>
                      <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">Dimensioni</th>
                      <th className="py-2.5 text-right text-xs font-medium text-text-muted" />
                    </tr>
                  </thead>

                  <tbody>
                    {moduliFiltrati.map((m) => (
                      <tr
                        key={m.id}
                        className={cn(
                          "group border-b border-border last:border-b-0",
                          "transition-colors duration-150 hover:bg-bg-base"
                        )}
                      >
                        <td className="py-3 pr-4 min-w-[160px]">
                          <p className="font-medium text-text-primary">{m.marca}</p>
                          <p className="text-xs text-text-muted mt-0.5">{m.modello}</p>
                          {!m.attivo && (
                            <Badge variant="muted" size="sm" className="mt-0.5">
                              {MODULI_FOTOVOLTAICI_TESTI.DISATTIVO}
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 pr-4">
                          <p className="font-medium text-text-primary">{formatPotenza(m.potenza_wp)}</p>
                        </td>

                        <td className="py-3 pr-4">
                          <p className="text-text-primary">{formatDimensioni(m)}</p>
                          {m.peso_kg && (
                            <p className="text-xs text-text-muted mt-0.5">{m.peso_kg} kg</p>
                          )}
                        </td>

                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-10 w-10 p-0"
                              aria-label={MODULI_FOTOVOLTAICI_TESTI.MODIFICA}
                              onClick={() => avviaModifica(m)}
                              disabled={salvataggio}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-10 w-10 p-0 text-error-500 hover:text-error-500"
                              aria-label={MODULI_FOTOVOLTAICI_TESTI.ELIMINA}
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

      {confirmDeleteModulo && (
        <ConfirmDialog
          title={MODULI_FOTOVOLTAICI_TESTI.ELIMINA}
          message={`Eliminare ${confirmDeleteModulo.marca} ${confirmDeleteModulo.modello}?`}
          confirmLabel={MODULI_FOTOVOLTAICI_TESTI.ELIMINA}
          onConfirm={() => void eseguiElimina()}
          onCancel={() => setConfirmDeleteModulo(null)}
        />
      )}
    </div>
  );
}
