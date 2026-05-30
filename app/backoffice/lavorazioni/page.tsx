"use client";

import Link from "next/link";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Home, Pencil, Plus, Power, Search } from "lucide-react";

import { FileInputPicker } from "@/components/backoffice/FileInputPicker";
import {
  LAVORAZIONI_IMPORT,
  LAVORAZIONI_LIMITI,
  LAVORAZIONI_TESTI,
} from "@/constants/lavorazioni";
import { APP_ROUTES } from "@/constants/routes";

import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { aggiornaLavorazioneCantiere } from "@/services/lavorazioni/aggiornaLavorazioneCantiere";
import { creaLavorazioneCantiere } from "@/services/lavorazioni/creaLavorazioneCantiere";
import { creaLavorazioniCantiere } from "@/services/lavorazioni/creaLavorazioniCantiere";
import { estraiLavorazioniDaComputo } from "@/services/lavorazioni/estraiLavorazioniDaComputo";
import { loadLavorazioniCantiere } from "@/services/lavorazioni/loadLavorazioniCantiere";

import type { CantiereBackoffice } from "@/types/cantieri";
import type {
  LavorazioneCantiere,
  LavorazioneCantiereInput,
  LavorazioneCantiereUpdate,
  LavorazioneImportPreview,
} from "@/types/lavorazioni";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type LavorazioneForm = {
  nome: string;
  ordine: string;
  percentuale_completamento: string;
  attiva: boolean;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const FORM_INIZIALE: LavorazioneForm = {
  nome: "",
  ordine: String(LAVORAZIONI_LIMITI.ORDINE_DEFAULT),
  percentuale_completamento: String(LAVORAZIONI_LIMITI.PERCENTUALE_MIN),
  attiva: true,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMessaggioErrore(error: unknown) {
  return error instanceof Error ? error.message : LAVORAZIONI_TESTI.ERRORI.GENERICO;
}

function getNumeroIntero(value: string): number | null {
  const numero = Number(value.trim());
  return Number.isInteger(numero) ? numero : null;
}

function isPercentualeValida(percentuale: number) {
  return (
    percentuale >= LAVORAZIONI_LIMITI.PERCENTUALE_MIN &&
    percentuale <= LAVORAZIONI_LIMITI.PERCENTUALE_MAX
  );
}

function preparaPayload({
  cantiereId,
  form,
}: {
  cantiereId: string;
  form: LavorazioneForm;
}): { payload: LavorazioneCantiereInput } | { errore: string } {
  if (!cantiereId) return { errore: LAVORAZIONI_TESTI.ERRORI.CANTIERE_OBBLIGATORIO };

  const nome = form.nome.trim();
  if (!nome) return { errore: LAVORAZIONI_TESTI.ERRORI.NOME_OBBLIGATORIO };

  const ordine = getNumeroIntero(form.ordine);
  if (ordine === null) return { errore: LAVORAZIONI_TESTI.ERRORI.ORDINE_NON_VALIDO };

  const percentuale = getNumeroIntero(form.percentuale_completamento);
  if (percentuale === null || !isPercentualeValida(percentuale)) {
    return { errore: LAVORAZIONI_TESTI.ERRORI.PERCENTUALE_NON_VALIDA };
  }

  return {
    payload: {
      cantiere_id: cantiereId,
      nome,
      ordine,
      attiva: form.attiva,
      percentuale_completamento: percentuale,
    },
  };
}

function getUpdateDaLavorazione(
  lavorazione: LavorazioneCantiere
): LavorazioneCantiereUpdate {
  return {
    nome: lavorazione.nome,
    ordine: lavorazione.ordine,
    attiva: lavorazione.attiva,
    percentuale_completamento: lavorazione.percentuale_completamento,
  };
}

function ordinaLavorazioni(lavorazioni: LavorazioneCantiere[]) {
  return [...lavorazioni].sort((a, b) => {
    if (a.ordine !== b.ordine) return a.ordine - b.ordine;
    return a.created_at.localeCompare(b.created_at);
  });
}

function getPercentualiDraft(lavorazioni: LavorazioneCantiere[]) {
  return Object.fromEntries(
    lavorazioni.map((l) => [l.id, String(l.percentuale_completamento)])
  );
}

function normalizzaNomeLavorazione(nome: string) {
  return nome.trim().replace(/\s+/g, " ");
}

function getChiaveNome(nome: string) {
  return normalizzaNomeLavorazione(nome).toLowerCase();
}

function normalizzaPreviewImport(
  lavorazioniImport: LavorazioneImportPreview[],
  lavorazioniEsistenti: LavorazioneCantiere[]
) {
  const nomiUsati = new Set(
    lavorazioniEsistenti.map((l) => getChiaveNome(l.nome))
  );

  return [...lavorazioniImport]
    .sort((a, b) => a.ordine - b.ordine)
    .map((l) => normalizzaNomeLavorazione(l.nome))
    .filter((nome) => {
      const chiave = getChiaveNome(nome);
      if (!chiave || nomiUsati.has(chiave)) return false;
      nomiUsati.add(chiave);
      return true;
    })
    .slice(0, LAVORAZIONI_LIMITI.IMPORT_MAX_LAVORAZIONI)
    .map((nome, index) => ({ nome, ordine: index + 1 }));
}

function getProssimoOrdine(lavorazioni: LavorazioneCantiere[]) {
  if (lavorazioni.length === 0) return 1;
  return Math.max(...lavorazioni.map((l) => l.ordine)) + 1;
}

function getProgressBarClass(percentuale: number): string {
  if (percentuale === 0) return "";
  if (percentuale <= 30) return "bg-warning-500";
  if (percentuale <= 70) return "bg-info-500";
  if (percentuale <= 99) return "bg-brand-500";
  return "bg-success-500";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeLavorazioniPage() {
  const toast = useToast();

  const [cantieri, setCantieri] = useState<CantiereBackoffice[]>([]);
  const [cantiereId, setCantiereId] = useState("");
  const [lavorazioni, setLavorazioni] = useState<LavorazioneCantiere[]>([]);
  const [percentualiDraft, setPercentualiDraft] = useState<Record<string, string>>({});
  const [form, setForm] = useState<LavorazioneForm>(FORM_INIZIALE);
  const [fileComputo, setFileComputo] = useState<File | null>(null);
  const [previewImport, setPreviewImport] = useState<LavorazioneImportPreview[]>([]);
  const [lavorazioneInModificaId, setLavorazioneInModificaId] = useState<string | null>(null);
  const [loadingCantieri, setLoadingCantieri] = useState(true);
  const [loadingLavorazioni, setLoadingLavorazioni] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [estrazioneImport, setEstrazioneImport] = useState(false);
  const [salvataggioImport, setSalvataggioImport] = useState(false);
  const [ricerca, setRicerca] = useState("");

  // ── Derived ──────────────────────────────────────────────────────────────

  const lavorazioniFiltrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return lavorazioni;
    return lavorazioni.filter((l) => l.nome.toLowerCase().includes(q));
  }, [lavorazioni, ricerca]);

  const formTitolo = lavorazioneInModificaId
    ? LAVORAZIONI_TESTI.MODIFICA_LAVORAZIONE
    : LAVORAZIONI_TESTI.NUOVA_LAVORAZIONE;
  const loading = loadingCantieri || loadingLavorazioni;
  const bloccoImport = estrazioneImport || salvataggioImport;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setLavorazioneInModificaId(null);
  };

  const resetImport = () => {
    setFileComputo(null);
    setPreviewImport([]);
  };

  const aggiornaLavorazioneInLista = (lavorazioneAggiornata: LavorazioneCantiere) => {
    setLavorazioni((correnti) =>
      ordinaLavorazioni(
        correnti.map((l) => (l.id === lavorazioneAggiornata.id ? lavorazioneAggiornata : l))
      )
    );
    setPercentualiDraft((correnti) => ({
      ...correnti,
      [lavorazioneAggiornata.id]: String(lavorazioneAggiornata.percentuale_completamento),
    }));
  };

  // ── Init ─────────────────────────────────────────────────────────────────

  const caricaLavorazioni = useCallback(async (nextCantiereId: string) => {
    if (!nextCantiereId) {
      setLavorazioni([]);
      setPercentualiDraft({});
      return;
    }
    try {
      setLoadingLavorazioni(true);
      const dati = await loadLavorazioniCantiere(nextCantiereId);
      setLavorazioni(dati);
      setPercentualiDraft(getPercentualiDraft(dati));
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error));
    } finally {
      setLoadingLavorazioni(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let attivo = true;
    const init = async () => {
      try {
        const dati = await loadCantieriBackoffice();
        if (!attivo) return;
        setCantieri(dati);
        setCantiereId((corrente) => corrente || dati[0]?.id || "");
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error));
      } finally {
        if (attivo) setLoadingCantieri(false);
      }
    };
    void init();
    return () => { attivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let attivo = true;
    if (!cantiereId) return () => { attivo = false; };

    const init = async () => {
      try {
        setLoadingLavorazioni(true);
        const dati = await loadLavorazioniCantiere(cantiereId);
        if (!attivo) return;
        setLavorazioni(dati);
        setPercentualiDraft(getPercentualiDraft(dati));
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error));
      } finally {
        if (attivo) setLoadingLavorazioni(false);
      }
    };
    void init();
    return () => { attivo = false; };
  }, [cantiereId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCantiereChange = (nextCantiereId: string) => {
    setCantiereId(nextCantiereId);
    if (!nextCantiereId) {
      setLavorazioni([]);
      setPercentualiDraft({});
    }
    resetForm();
    resetImport();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const risultato = preparaPayload({ cantiereId, form });
    if ("errore" in risultato) {
      toast.error(risultato.errore);
      return;
    }

    try {
      setSalvataggio(true);

      if (lavorazioneInModificaId) {
        const lavorazioneAggiornata = await aggiornaLavorazioneCantiere({
          lavorazioneId: lavorazioneInModificaId,
          lavorazione: {
            nome: risultato.payload.nome,
            ordine: risultato.payload.ordine,
            attiva: risultato.payload.attiva,
            percentuale_completamento: risultato.payload.percentuale_completamento,
          },
        });
        aggiornaLavorazioneInLista(lavorazioneAggiornata);
        toast.success(LAVORAZIONI_TESTI.MESSAGGI.AGGIORNATA);
      } else {
        const nuova = await creaLavorazioneCantiere(risultato.payload);
        setLavorazioni((correnti) => ordinaLavorazioni([...correnti, nuova]));
        setPercentualiDraft((correnti) => ({
          ...correnti,
          [nuova.id]: String(nuova.percentuale_completamento),
        }));
        toast.success(LAVORAZIONI_TESTI.MESSAGGI.CREATA);
      }

      resetForm();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleFileComputoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setFileComputo(file);
    setPreviewImport([]);
  };

  const handleEstraiLavorazioniImport = async () => {
    if (!cantiereId) {
      toast.error(LAVORAZIONI_TESTI.ERRORI.CANTIERE_OBBLIGATORIO);
      return;
    }
    if (!fileComputo) {
      toast.error(LAVORAZIONI_TESTI.ERRORI.FILE_CSV_OBBLIGATORIO);
      return;
    }
    try {
      setEstrazioneImport(true);
      const estratte = await estraiLavorazioniDaComputo(fileComputo);
      const preview = normalizzaPreviewImport(estratte, lavorazioni);
      if (preview.length === 0) {
        setPreviewImport([]);
        toast.error(LAVORAZIONI_TESTI.ERRORI.NESSUNA_LAVORAZIONE_IMPORT);
        return;
      }
      setPreviewImport(preview);
      toast.success(LAVORAZIONI_TESTI.MESSAGGI.IMPORT_PRONTO);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error));
    } finally {
      setEstrazioneImport(false);
    }
  };

  const aggiornaPreviewImport = (
    index: number,
    lavorazione: LavorazioneImportPreview
  ) => {
    setPreviewImport((correnti) =>
      correnti.map((l, i) => (i === index ? lavorazione : l))
    );
  };

  const rimuoviPreviewImport = (index: number) => {
    setPreviewImport((correnti) =>
      correnti
        .filter((_, i) => i !== index)
        .map((l, i) => ({ ...l, ordine: i + 1 }))
    );
  };

  const confermaImportLavorazioni = async () => {
    if (!cantiereId) {
      toast.error(LAVORAZIONI_TESTI.ERRORI.CANTIERE_OBBLIGATORIO);
      return;
    }
    const preview = normalizzaPreviewImport(previewImport, lavorazioni);
    if (preview.length === 0) {
      toast.error(LAVORAZIONI_TESTI.ERRORI.IMPORT_NON_VALIDO);
      return;
    }
    try {
      setSalvataggioImport(true);
      const nuove = await creaLavorazioniCantiere({
        cantiereId,
        lavorazioni: preview,
        ordineIniziale: getProssimoOrdine(lavorazioni),
      });
      setLavorazioni((correnti) => ordinaLavorazioni([...correnti, ...nuove]));
      setPercentualiDraft((correnti) => ({
        ...correnti,
        ...getPercentualiDraft(nuove),
      }));
      resetImport();
      toast.success(LAVORAZIONI_TESTI.MESSAGGI.IMPORT_COMPLETATO);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error));
    } finally {
      setSalvataggioImport(false);
    }
  };

  const avviaModifica = (lavorazione: LavorazioneCantiere) => {
    setLavorazioneInModificaId(lavorazione.id);
    setForm({
      nome: lavorazione.nome,
      ordine: String(lavorazione.ordine),
      percentuale_completamento: String(lavorazione.percentuale_completamento),
      attiva: lavorazione.attiva,
    });
  };

  const toggleAttiva = async (lavorazione: LavorazioneCantiere) => {
    try {
      setSalvataggio(true);
      const aggiornata = await aggiornaLavorazioneCantiere({
        lavorazioneId: lavorazione.id,
        lavorazione: { ...getUpdateDaLavorazione(lavorazione), attiva: !lavorazione.attiva },
      });
      aggiornaLavorazioneInLista(aggiornata);
      if (lavorazioneInModificaId === lavorazione.id) {
        setForm((f) => ({ ...f, attiva: aggiornata.attiva }));
      }
      toast.success(
        aggiornata.attiva ? LAVORAZIONI_TESTI.MESSAGGI.ATTIVATA : LAVORAZIONI_TESTI.MESSAGGI.DISATTIVATA
      );
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const aggiornaPercentuale = async (lavorazione: LavorazioneCantiere) => {
    const percentuale = getNumeroIntero(percentualiDraft[lavorazione.id] || "");
    if (percentuale === null || !isPercentualeValida(percentuale)) {
      toast.error(LAVORAZIONI_TESTI.ERRORI.PERCENTUALE_NON_VALIDA);
      return;
    }
    try {
      setSalvataggio(true);
      const aggiornata = await aggiornaLavorazioneCantiere({
        lavorazioneId: lavorazione.id,
        lavorazione: { ...getUpdateDaLavorazione(lavorazione), percentuale_completamento: percentuale },
      });
      aggiornaLavorazioneInLista(aggiornata);
      toast.success(LAVORAZIONI_TESTI.MESSAGGI.PERCENTUALE_AGGIORNATA);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            <Link href={APP_ROUTES.BACKOFFICE}>
              <Button variant="secondary" size="sm">{LAVORAZIONI_TESTI.BACKOFFICE}</Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">{LAVORAZIONI_TESTI.TIMBRATURE}</Button>
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
          <Link href={APP_ROUTES.BACKOFFICE} className="hover:text-text-primary transition-colors duration-150">
            {LAVORAZIONI_TESTI.BACKOFFICE}
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{LAVORAZIONI_TESTI.TITOLO}</span>
        </nav>

        {/* Titolo */}
        <h1 className="font-heading text-2xl font-medium text-text-primary">
          {LAVORAZIONI_TESTI.TITOLO}
        </h1>
        <p className="mt-1 text-sm text-text-muted">{LAVORAZIONI_TESTI.CARD_DESCRIZIONE}</p>

        {/* Selezione cantiere */}
        <Card className="mt-6 p-5">
          <Select
            label={LAVORAZIONI_TESTI.CANTIERE}
            value={cantiereId}
            onChange={(e) => handleCantiereChange(e.target.value)}
            disabled={loadingCantieri}
          >
            <option value="">{LAVORAZIONI_TESTI.SELEZIONA_CANTIERE}</option>
            {cantieri.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </Card>

        {loadingCantieri && (
          <p className="mt-5 text-sm text-text-muted">{LAVORAZIONI_TESTI.CARICAMENTO}</p>
        )}

        {!loadingCantieri && cantieri.length === 0 && (
          <Card className="mt-5 p-5">
            <p className="text-sm text-text-muted">{LAVORAZIONI_TESTI.NESSUN_CANTIERE}</p>
          </Card>
        )}

        {!loadingCantieri && cantieri.length > 0 && (
          <>
            {/* Import CSV — collassabile */}
            <details className="group mt-4">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-bg-card px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary select-none">
                <ChevronRight className="h-4 w-4 transition-transform duration-150 group-open:rotate-90" />
                {LAVORAZIONI_TESTI.IMPORTA_COMPUTO}
              </summary>

              <Card className="mt-2 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-end">
                  <div className="min-w-0 flex-1">
                    <FileInputPicker
                      label={LAVORAZIONI_TESTI.FILE_COMPUTO}
                      buttonLabel={LAVORAZIONI_TESTI.CARICA_FILE}
                      emptyLabel={LAVORAZIONI_TESTI.NESSUN_FILE_SELEZIONATO}
                      selectedFileNames={fileComputo ? [fileComputo.name] : []}
                      accept={LAVORAZIONI_IMPORT.FILE_ACCEPT}
                      disabled={!cantiereId || bloccoImport}
                      onChange={handleFileComputoChange}
                    />
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => void handleEstraiLavorazioniImport()}
                    disabled={!cantiereId || !fileComputo || bloccoImport}
                    loading={estrazioneImport}
                  >
                    {LAVORAZIONI_TESTI.ESTRAI_LAVORAZIONI}
                  </Button>
                </div>

                {previewImport.length > 0 && (
                  <div className="mt-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-text-primary">
                        {LAVORAZIONI_TESTI.ANTEPRIMA_IMPORT}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={resetImport}
                          disabled={bloccoImport}
                        >
                          {LAVORAZIONI_TESTI.ANNULLA}
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          loading={salvataggioImport}
                          disabled={bloccoImport || previewImport.length === 0}
                          onClick={() => void confermaImportLavorazioni()}
                        >
                          {LAVORAZIONI_TESTI.CONFERMA_IMPORT}
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted w-24">
                              {LAVORAZIONI_TESTI.ORDINE}
                            </th>
                            <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">
                              {LAVORAZIONI_TESTI.NOME}
                            </th>
                            <th className="py-2.5 text-right text-xs font-medium text-text-muted" />
                          </tr>
                        </thead>
                        <tbody>
                          {previewImport.map((lavorazione, index) => (
                            <tr key={`${lavorazione.ordine}-${index}`} className="border-b border-border last:border-b-0">
                              <td className="py-2 pr-4">
                                <input
                                  type="number"
                                  min="1"
                                  value={lavorazione.ordine}
                                  onChange={(e) => {
                                    const ordine = Number(e.target.value);
                                    aggiornaPreviewImport(index, {
                                      ...lavorazione,
                                      ordine: Number.isInteger(ordine) ? ordine : LAVORAZIONI_LIMITI.ORDINE_DEFAULT,
                                    });
                                  }}
                                  disabled={bloccoImport}
                                  className="w-20 h-8 px-2 text-sm border border-border rounded-md bg-bg-card text-text-primary outline-none focus:border-brand-500 disabled:bg-bg-subtle"
                                />
                              </td>
                              <td className="py-2 pr-4">
                                <input
                                  value={lavorazione.nome}
                                  onChange={(e) => aggiornaPreviewImport(index, { ...lavorazione, nome: e.target.value })}
                                  disabled={bloccoImport}
                                  className="w-full min-w-48 h-8 px-2 text-sm border border-border rounded-md bg-bg-card text-text-primary outline-none focus:border-brand-500 disabled:bg-bg-subtle"
                                />
                              </td>
                              <td className="py-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => rimuoviPreviewImport(index)}
                                  disabled={bloccoImport}
                                  className="text-error-500 hover:text-error-500"
                                >
                                  {LAVORAZIONI_TESTI.RIMUOVI}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Card>
            </details>

            {/* Grid form + lista */}
            <div className="mt-4 grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">

              {/* ── Form ── */}
              <Card className="p-5">
                <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
                  {formTitolo}
                </h2>
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Input
                    label={LAVORAZIONI_TESTI.NOME}
                    value={form.nome}
                    onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                    disabled={salvataggio}
                  />

                  <Input
                    label={LAVORAZIONI_TESTI.ORDINE}
                    type="number"
                    value={form.ordine}
                    onChange={(e) => setForm((f) => ({ ...f, ordine: e.target.value }))}
                    disabled={salvataggio}
                  />

                  <Input
                    label={LAVORAZIONI_TESTI.PERCENTUALE}
                    type="number"
                    min={LAVORAZIONI_LIMITI.PERCENTUALE_MIN}
                    max={LAVORAZIONI_LIMITI.PERCENTUALE_MAX}
                    value={form.percentuale_completamento}
                    onChange={(e) => setForm((f) => ({ ...f, percentuale_completamento: e.target.value }))}
                    disabled={salvataggio}
                  />

                  <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.attiva}
                      onChange={(e) => setForm((f) => ({ ...f, attiva: e.target.checked }))}
                      disabled={salvataggio}
                      className="h-4 w-4 accent-brand-500"
                    />
                    {LAVORAZIONI_TESTI.ATTIVA}
                  </label>

                  <div className="flex gap-2 pt-1">
                    <Button
                      type="submit"
                      loading={salvataggio}
                      disabled={!cantiereId}
                      icon={!salvataggio ? <Plus className="h-4 w-4" /> : undefined}
                      className="flex-1"
                    >
                      {lavorazioneInModificaId ? "Salva modifiche" : "Aggiungi lavorazione"}
                    </Button>
                    {lavorazioneInModificaId && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={resetForm}
                        disabled={salvataggio}
                      >
                        {LAVORAZIONI_TESTI.ANNULLA}
                      </Button>
                    )}
                  </div>
                </form>
              </Card>

              {/* ── Lista ── */}
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                  <div>
                    <h2 className="font-heading text-lg font-medium text-text-primary">
                      {LAVORAZIONI_TESTI.LISTA_LAVORAZIONI}
                    </h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      {lavorazioni.length} lavorazioni totali
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                      <input
                        value={ricerca}
                        onChange={(e) => setRicerca(e.target.value)}
                        placeholder="Cerca lavorazione..."
                        className="h-9 pl-8 pr-3 text-sm border border-border rounded-md bg-bg-card text-text-primary placeholder:text-text-subtle outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors duration-150"
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void caricaLavorazioni(cantiereId)}
                      disabled={loading || salvataggio}
                    >
                      {LAVORAZIONI_TESTI.AGGIORNA}
                    </Button>
                  </div>
                </div>

                {loadingLavorazioni && (
                  <p className="text-sm text-text-muted py-4">{LAVORAZIONI_TESTI.CARICAMENTO}</p>
                )}

                {!loadingLavorazioni && lavorazioniFiltrate.length === 0 && (
                  <p className="text-sm text-text-muted py-4">
                    {ricerca ? "Nessuna lavorazione trovata" : LAVORAZIONI_TESTI.NESSUNA_LAVORAZIONE}
                  </p>
                )}

                {!loadingLavorazioni && lavorazioniFiltrate.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted">
                            {LAVORAZIONI_TESTI.NOME}
                          </th>
                          <th className="py-2.5 pr-4 text-left text-xs font-medium text-text-muted min-w-[200px]">
                            {LAVORAZIONI_TESTI.PERCENTUALE}
                          </th>
                          <th className="py-2.5 text-right text-xs font-medium text-text-muted" />
                        </tr>
                      </thead>
                      <tbody>
                        {lavorazioniFiltrate.map((l) => {
                          const pct = l.percentuale_completamento;
                          const progressClass = getProgressBarClass(pct);
                          return (
                            <tr
                              key={l.id}
                              className={cn(
                                "group border-b border-border last:border-b-0",
                                "transition-colors duration-150 hover:bg-bg-base"
                              )}
                            >
                              {/* Lavorazione */}
                              <td className="py-3 pr-4">
                                <p className="font-medium text-text-primary">{l.nome}</p>
                                <p className="text-xs text-text-muted mt-0.5">
                                  #{l.ordine}
                                </p>
                                {!l.attiva && (
                                  <Badge variant="muted" size="sm" className="mt-0.5">
                                    {LAVORAZIONI_TESTI.NON_ATTIVO}
                                  </Badge>
                                )}
                              </td>

                              {/* Avanzamento */}
                              <td className="py-3 pr-4">
                                {/* Progress bar */}
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="text-xs font-medium text-text-primary w-8 shrink-0">
                                    {pct}%
                                  </span>
                                  {pct === 100 && (
                                    <span className="text-xs text-success-500">Completata</span>
                                  )}
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-bg-subtle overflow-hidden mb-2">
                                  {pct > 0 && (
                                    <div
                                      className={cn("h-full rounded-full transition-all duration-300", progressClass)}
                                      style={{ width: `${pct}%` }}
                                    />
                                  )}
                                </div>
                                {/* Input inline aggiorna % */}
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min={LAVORAZIONI_LIMITI.PERCENTUALE_MIN}
                                    max={LAVORAZIONI_LIMITI.PERCENTUALE_MAX}
                                    value={percentualiDraft[l.id] ?? ""}
                                    onChange={(e) =>
                                      setPercentualiDraft((correnti) => ({
                                        ...correnti,
                                        [l.id]: e.target.value,
                                      }))
                                    }
                                    disabled={salvataggio}
                                    className="w-16 h-7 px-2 text-xs border border-border rounded-md bg-bg-card text-text-primary outline-none focus:border-brand-500 disabled:bg-bg-subtle"
                                  />
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => void aggiornaPercentuale(l)}
                                    disabled={salvataggio}
                                  >
                                    {LAVORAZIONI_TESTI.AGGIORNA_PERCENTUALE}
                                  </Button>
                                </div>
                              </td>

                              {/* Azioni */}
                              <td className="py-3">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    aria-label={LAVORAZIONI_TESTI.MODIFICA}
                                    onClick={() => avviaModifica(l)}
                                    disabled={salvataggio}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    aria-label={l.attiva ? LAVORAZIONI_TESTI.DISATTIVA : LAVORAZIONI_TESTI.RIATTIVA}
                                    onClick={() => void toggleAttiva(l)}
                                    disabled={salvataggio}
                                  >
                                    <Power className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
