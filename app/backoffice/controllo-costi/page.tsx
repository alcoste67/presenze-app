"use client";

import Link from "next/link";
import React, { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Home, Plus, Trash2, Upload } from "lucide-react";

import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { APP_ROUTES } from "@/constants/routes";
import { supabase } from "@/lib/supabase";
import { getMessaggioErrore } from "@/lib/errors";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import type { CantiereBackoffice } from "@/types/cantieri";

// ─── Types ────────────────────────────────────────────────────────────────────

type ContrattoForm = {
  importo_contratto: string;
  importo_extra_lavori: string;
  data_firma: string;
  note: string;
};

type DashboardData = {
  ricavi: {
    importo_contratto: number;
    importo_extra_lavori: number;
    totale: number;
  };
  costi: {
    manodopera: number;
    macchinari: number;
    materiali: number;
    totale: number;
  };
  margine: number;
  margine_percentuale: number | null;
};

type MaterialeImportRow = {
  descrizione: string;
  fornitore?: string | null;
  quantita?: number | null;
  prezzo_unitario: number;
  numero_ddt?: string | null;
  data_acquisto?: string | null;
};

type MaterialeRow = {
  id: string;
  descrizione: string;
  fornitore: string | null;
  quantita: number;
  prezzo_unitario: number;
  data_acquisto: string | null;
  numero_ddt: string | null;
  created_at: string;
};

type MaterialeForm = {
  descrizione: string;
  fornitore: string;
  quantita: string;
  prezzo_unitario: string;
  data_acquisto: string;
  numero_ddt: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTRATTO_VUOTO: ContrattoForm = {
  importo_contratto: "",
  importo_extra_lavori: "",
  data_firma: "",
  note: "",
};

const MATERIALE_VUOTO: MaterialeForm = {
  descrizione: "",
  fornitore: "",
  quantita: "1",
  prezzo_unitario: "",
  data_acquisto: "",
  numero_ddt: "",
};

const LABEL_TEXTAREA =
  "w-full px-3 py-2 text-sm rounded-md border border-border bg-bg-card text-text-primary " +
  "placeholder:text-text-subtle outline-none resize-none " +
  "transition-colors duration-150 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formattaEuro(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function formattaData(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("it-IT").format(new Date(`${iso}T00:00:00`));
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessione non valida");
  return {
    [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${session.access_token}`,
    [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RigaPL({
  label,
  valore,
  bold,
  positivo,
  negativo,
}: {
  label: string;
  valore: number;
  bold?: boolean;
  positivo?: boolean;
  negativo?: boolean;
}) {
  const colore = positivo
    ? "text-green-600"
    : negativo
      ? "text-red-600"
      : "text-text-primary";
  return (
    <div
      className={`flex justify-between py-1.5 text-sm ${bold ? "font-semibold" : ""}`}
    >
      <span className="text-text-secondary">{label}</span>
      <span className={colore}>{formattaEuro(valore)}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeControlloCostiPage() {
  const toast = useToast();

  // Cantieri
  const [cantieri, setCantieri] = useState<CantiereBackoffice[]>([]);
  const [cantiereId, setCantiereId] = useState("");
  const [loadingCantieri, setLoadingCantieri] = useState(true);

  // Contratto
  const [contratto, setContratto] = useState<ContrattoForm>(CONTRATTO_VUOTO);
  const [loadingContratto, setLoadingContratto] = useState(false);
  const [salvataggioContratto, setSalvataggioContratto] = useState(false);

  // Dashboard
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Materiali
  const [materiali, setMateriali] = useState<MaterialeRow[]>([]);
  const [loadingMateriali, setLoadingMateriali] = useState(false);
  const [eliminazioneId, setEliminazioneId] = useState<string | null>(null);

  // Modal aggiungi materiale
  const [modalAperta, setModalAperta] = useState(false);
  const [formMateriale, setFormMateriale] = useState<MaterialeForm>(MATERIALE_VUOTO);
  const [salvaggioMateriale, setSalvaggioMateriale] = useState(false);

  // DDT import
  const fileImportRef = useRef<HTMLInputElement>(null);
  const [previewMateriali, setPreviewMateriali] = useState<MaterialeImportRow[]>([]);
  const [previewSelezionate, setPreviewSelezionate] = useState<Set<number>>(new Set());
  const [importandoMateriali, setImportandoMateriali] = useState(false);
  const [confermandoImport, setConfermandoImport] = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const caricaContratto = useCallback(
    async (cId: string) => {
      if (!cId) { setContratto(CONTRATTO_VUOTO); return; }
      try {
        setLoadingContratto(true);
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${API_ROUTES.CONTROLLO_COSTI_CONTRATTO}?cantiereId=${encodeURIComponent(cId)}`,
          { headers }
        );
        if (!res.ok) throw new Error("Errore caricamento contratto");
        const data = await res.json() as Record<string, unknown> | null;
        setContratto({
          importo_contratto: data?.importo_contratto != null ? String(data.importo_contratto) : "",
          importo_extra_lavori: data?.importo_extra_lavori != null ? String(data.importo_extra_lavori) : "",
          data_firma: typeof data?.data_firma === "string" ? data.data_firma : "",
          note: typeof data?.note === "string" ? data.note : "",
        });
      } catch (error: unknown) {
        toast.error(getMessaggioErrore(error, "Errore caricamento contratto"));
      } finally {
        setLoadingContratto(false);
      }
    },
    [toast]
  );

  const caricaDashboard = useCallback(
    async (cId: string) => {
      if (!cId) { setDashboard(null); return; }
      try {
        setLoadingDashboard(true);
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${API_ROUTES.CONTROLLO_COSTI_DASHBOARD}?cantiereId=${encodeURIComponent(cId)}`,
          { headers }
        );
        if (!res.ok) throw new Error("Errore caricamento dashboard");
        const data = await res.json() as DashboardData;
        setDashboard(data);
      } catch (error: unknown) {
        toast.error(getMessaggioErrore(error, "Errore caricamento P&L"));
      } finally {
        setLoadingDashboard(false);
      }
    },
    [toast]
  );

  const caricaMateriali = useCallback(
    async (cId: string) => {
      if (!cId) { setMateriali([]); return; }
      try {
        setLoadingMateriali(true);
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${API_ROUTES.CONTROLLO_COSTI_MATERIALI}?cantiereId=${encodeURIComponent(cId)}`,
          { headers }
        );
        if (!res.ok) throw new Error("Errore caricamento materiali");
        const data = await res.json() as MaterialeRow[];
        setMateriali(data);
      } catch (error: unknown) {
        toast.error(getMessaggioErrore(error, "Errore caricamento materiali"));
      } finally {
        setLoadingMateriali(false);
      }
    },
    [toast]
  );

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    let attivo = true;
    const init = async () => {
      try {
        const dati = await loadCantieriBackoffice();
        if (!attivo) return;
        const primoId = dati[0]?.id ?? "";
        setCantieri(dati);
        setCantiereId(primoId);
        if (primoId) {
          await Promise.all([
            caricaContratto(primoId),
            caricaDashboard(primoId),
            caricaMateriali(primoId),
          ]);
        }
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, "Errore caricamento cantieri"));
      } finally {
        if (attivo) setLoadingCantieri(false);
      }
    };
    void init();
    return () => { attivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCantiereChange = (nextId: string) => {
    setCantiereId(nextId);
    setDashboard(null);
    setMateriali([]);
    void caricaContratto(nextId);
    void caricaDashboard(nextId);
    void caricaMateriali(nextId);
  };

  const handleSalvaContratto = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cantiereId) return;
    try {
      setSalvataggioContratto(true);
      const headers = await getAuthHeaders();
      const res = await fetch(API_ROUTES.CONTROLLO_COSTI_CONTRATTO, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          cantiere_id: cantiereId,
          importo_contratto: contratto.importo_contratto || null,
          importo_extra_lavori: contratto.importo_extra_lavori || null,
          data_firma: contratto.data_firma || null,
          note: contratto.note || null,
        }),
      });
      if (!res.ok) throw new Error("Errore salvataggio contratto");
      toast.success("Contratto salvato");
      await caricaDashboard(cantiereId);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore salvataggio contratto"));
    } finally {
      setSalvataggioContratto(false);
    }
  };

  const handleAggiungiMateriale = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cantiereId) return;
    if (!formMateriale.descrizione.trim()) {
      toast.error("Descrizione obbligatoria");
      return;
    }
    if (!formMateriale.prezzo_unitario) {
      toast.error("Prezzo unitario obbligatorio");
      return;
    }
    try {
      setSalvaggioMateriale(true);
      const headers = await getAuthHeaders();
      const res = await fetch(API_ROUTES.CONTROLLO_COSTI_MATERIALI, {
        method: "POST",
        headers,
        body: JSON.stringify({
          cantiere_id: cantiereId,
          descrizione: formMateriale.descrizione.trim(),
          fornitore: formMateriale.fornitore || null,
          quantita: formMateriale.quantita ? Number(formMateriale.quantita) : 1,
          prezzo_unitario: Number(formMateriale.prezzo_unitario),
          data_acquisto: formMateriale.data_acquisto || null,
          numero_ddt: formMateriale.numero_ddt || null,
        }),
      });
      if (!res.ok) throw new Error("Errore salvataggio materiale");
      toast.success("Materiale aggiunto");
      setModalAperta(false);
      setFormMateriale(MATERIALE_VUOTO);
      await Promise.all([caricaMateriali(cantiereId), caricaDashboard(cantiereId)]);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore aggiunta materiale"));
    } finally {
      setSalvaggioMateriale(false);
    }
  };

  const handleEliminaMateriale = async (id: string) => {
    if (!window.confirm("Eliminare questo materiale?")) return;
    try {
      setEliminazioneId(id);
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${API_ROUTES.CONTROLLO_COSTI_MATERIALI}/${id}`,
        { method: "DELETE", headers }
      );
      if (!res.ok) throw new Error("Errore eliminazione materiale");
      toast.success("Materiale eliminato");
      await Promise.all([caricaMateriali(cantiereId), caricaDashboard(cantiereId)]);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore eliminazione materiale"));
    } finally {
      setEliminazioneId(null);
    }
  };

  const chiudiModal = () => {
    setModalAperta(false);
    setFormMateriale(MATERIALE_VUOTO);
  };

  const handleImportaDaDDT = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileImportRef.current) fileImportRef.current.value = "";
    if (!file || !cantiereId) return;
    try {
      setImportandoMateriali(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessione non valida");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_ROUTES.CONTROLLO_COSTI_MATERIALI}/importa`, {
        method: "POST",
        headers: { [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${session.access_token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Errore estrazione materiali");
      const data = await res.json() as MaterialeImportRow[];
      if (data.length === 0) {
        toast.error("Nessun materiale trovato nel documento");
        return;
      }
      setPreviewMateriali(data);
      setPreviewSelezionate(new Set(data.map((_, i) => i)));
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore importazione DDT"));
    } finally {
      setImportandoMateriali(false);
    }
  };

  const confermaImportMateriali = async () => {
    if (!cantiereId || previewSelezionate.size === 0) return;
    try {
      setConfermandoImport(true);
      const headers = await getAuthHeaders();
      const righe = previewMateriali.filter((_, i) => previewSelezionate.has(i));
      await Promise.all(
        righe.map((m) =>
          fetch(API_ROUTES.CONTROLLO_COSTI_MATERIALI, {
            method: "POST",
            headers,
            body: JSON.stringify({
              cantiere_id: cantiereId,
              descrizione: m.descrizione,
              fornitore: m.fornitore ?? null,
              quantita: m.quantita ?? 1,
              prezzo_unitario: m.prezzo_unitario,
              data_acquisto: m.data_acquisto ?? null,
              numero_ddt: m.numero_ddt ?? null,
            }),
          })
        )
      );
      toast.success(`${righe.length} materiali importati`);
      setPreviewMateriali([]);
      setPreviewSelezionate(new Set());
      await Promise.all([caricaMateriali(cantiereId), caricaDashboard(cantiereId)]);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore importazione materiali"));
    } finally {
      setConfermandoImport(false);
    }
  };

  const togglePreviewRow = (idx: number) => {
    setPreviewSelezionate((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const toggleTuttePreview = () => {
    setPreviewSelezionate((prev) =>
      prev.size === previewMateriali.length
        ? new Set()
        : new Set(previewMateriali.map((_, i) => i))
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            <Link href={APP_ROUTES.BACKOFFICE}>
              <Button variant="secondary" size="sm">Back-office</Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">Timbrature</Button>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-[1100px] px-6 py-6">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link href={APP_ROUTES.BACKOFFICE} className="hover:text-text-primary transition-colors duration-150">
            Back-office
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">Controllo Costi</span>
        </nav>

        <h1 className="font-heading text-2xl font-medium text-text-primary">Controllo Costi</h1>
        <p className="mt-1 text-sm text-text-muted">P&amp;L per cantiere: ricavi, costi manodopera, macchinari e materiali.</p>

        {/* 1. Selector cantiere */}
        <Card className="mt-6 p-5">
          <Select
            label="Cantiere"
            value={cantiereId}
            onChange={(e) => handleCantiereChange(e.target.value)}
            disabled={loadingCantieri}
          >
            <option value="">— Seleziona cantiere —</option>
            {cantieri.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </Card>

        {cantiereId && (
          <>
            {/* 2 + 3. Contratto e Dashboard affiancati */}
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              {/* Contratto */}
              <Card className="p-5">
                <h2 className="font-heading text-lg font-medium text-text-primary mb-4">Contratto</h2>
                <form onSubmit={(e) => void handleSalvaContratto(e)} className="flex flex-col gap-4">
                  <Input
                    label="Importo contratto (€)"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={contratto.importo_contratto}
                    onChange={(e) =>
                      setContratto((c) => ({ ...c, importo_contratto: e.target.value }))
                    }
                    disabled={loadingContratto}
                  />
                  <Input
                    label="Extra lavori (€)"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={contratto.importo_extra_lavori}
                    onChange={(e) =>
                      setContratto((c) => ({ ...c, importo_extra_lavori: e.target.value }))
                    }
                    disabled={loadingContratto}
                  />
                  <Input
                    label="Data firma"
                    type="date"
                    value={contratto.data_firma}
                    onChange={(e) =>
                      setContratto((c) => ({ ...c, data_firma: e.target.value }))
                    }
                    disabled={loadingContratto}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-text-primary">Note</label>
                    <textarea
                      rows={3}
                      className={LABEL_TEXTAREA}
                      value={contratto.note}
                      onChange={(e) =>
                        setContratto((c) => ({ ...c, note: e.target.value }))
                      }
                      disabled={loadingContratto}
                    />
                  </div>
                  <Button
                    type="submit"
                    loading={salvataggioContratto}
                    disabled={loadingContratto}
                    className="self-start"
                  >
                    Salva contratto
                  </Button>
                </form>
              </Card>

              {/* Dashboard P&L */}
              <Card className="p-5">
                <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
                  P&amp;L
                </h2>

                {loadingDashboard && (
                  <p className="text-sm text-text-muted">Calcolo in corso…</p>
                )}

                {!loadingDashboard && !dashboard && (
                  <p className="text-sm text-text-muted">Nessun dato disponibile.</p>
                )}

                {!loadingDashboard && dashboard && (
                  <div>
                    {/* Ricavi */}
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Ricavi
                    </p>
                    <div className="rounded-md border border-border bg-bg-base px-3 py-1 mb-3">
                      <RigaPL label="Importo contratto" valore={dashboard.ricavi.importo_contratto} />
                      <RigaPL label="Extra lavori" valore={dashboard.ricavi.importo_extra_lavori} />
                      <div className="border-t border-border mt-1 pt-1">
                        <RigaPL label="Totale ricavi" valore={dashboard.ricavi.totale} bold positivo={dashboard.ricavi.totale > 0} />
                      </div>
                    </div>

                    {/* Costi */}
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
                      Costi
                    </p>
                    <div className="rounded-md border border-border bg-bg-base px-3 py-1 mb-3">
                      <RigaPL label="Manodopera (ore×costo)" valore={dashboard.costi.manodopera} />
                      <RigaPL label="Macchinari (ore×costo)" valore={dashboard.costi.macchinari} />
                      <RigaPL label="Materiali" valore={dashboard.costi.materiali} />
                      <div className="border-t border-border mt-1 pt-1">
                        <RigaPL label="Totale costi" valore={dashboard.costi.totale} bold negativo={dashboard.costi.totale > 0} />
                      </div>
                    </div>

                    {/* Margine */}
                    <div className="rounded-md border border-border bg-bg-base px-3 py-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm font-semibold text-text-primary">Margine</span>
                        <div className="text-right">
                          <span
                            className={`text-base font-semibold ${dashboard.margine >= 0 ? "text-green-600" : "text-red-600"}`}
                          >
                            {formattaEuro(dashboard.margine)}
                          </span>
                          {dashboard.margine_percentuale !== null && (
                            <span
                              className={`ml-2 text-sm ${dashboard.margine >= 0 ? "text-green-600" : "text-red-600"}`}
                            >
                              ({dashboard.margine_percentuale}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>

            {/* 4. Materiali */}
            <Card className="mt-5 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div>
                  <h2 className="font-heading text-lg font-medium text-text-primary">Materiali</h2>
                  {!loadingMateriali && (
                    <p className="text-xs text-text-muted mt-0.5">{materiali.length} voci</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileImportRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => void handleImportaDaDDT(e)}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Upload className="h-4 w-4" />}
                    loading={importandoMateriali}
                    onClick={() => fileImportRef.current?.click()}
                  >
                    Importa da DDT/Fattura
                  </Button>
                  <Button
                    size="sm"
                    icon={<Plus className="h-4 w-4" />}
                    onClick={() => setModalAperta(true)}
                  >
                    Aggiungi materiale
                  </Button>
                </div>
              </div>

              {loadingMateriali && (
                <p className="px-5 py-4 text-sm text-text-muted">Caricamento…</p>
              )}

              {!loadingMateriali && materiali.length === 0 && (
                <p className="px-5 py-4 text-sm text-text-muted">
                  Nessun materiale registrato.
                </p>
              )}

              {materiali.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg-base">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Descrizione</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Fornitore</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">DDT</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Qtà</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Prezzo unit.</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Totale</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {materiali.map((m) => (
                        <tr
                          key={m.id}
                          className="border-b border-border last:border-b-0 hover:bg-bg-base transition-colors duration-150"
                        >
                          <td className="px-4 py-3 font-medium text-text-primary">{m.descrizione}</td>
                          <td className="px-4 py-3 text-text-muted">{m.fornitore ?? "—"}</td>
                          <td className="px-4 py-3 text-text-muted">{formattaData(m.data_acquisto)}</td>
                          <td className="px-4 py-3 text-text-muted">{m.numero_ddt ?? "—"}</td>
                          <td className="px-4 py-3 text-right text-text-muted">{m.quantita}</td>
                          <td className="px-4 py-3 text-right text-text-muted">{formattaEuro(m.prezzo_unitario)}</td>
                          <td className="px-4 py-3 text-right font-medium text-text-primary">
                            {formattaEuro(m.quantita * m.prezzo_unitario)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 className="h-4 w-4 text-error-500" />}
                              loading={eliminazioneId === m.id}
                              onClick={() => void handleEliminaMateriale(m.id)}
                              aria-label={`Elimina ${m.descrizione}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* 5. Anteprima importazione DDT */}
            {previewMateriali.length > 0 && (
              <Card className="mt-5 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div>
                    <h2 className="font-heading text-lg font-medium text-text-primary">Anteprima importazione</h2>
                    <p className="text-xs text-text-muted mt-0.5">
                      {previewSelezionate.size} di {previewMateriali.length} righe selezionate
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => { setPreviewMateriali([]); setPreviewSelezionate(new Set()); }}
                    >
                      Annulla
                    </Button>
                    <Button
                      size="sm"
                      loading={confermandoImport}
                      disabled={previewSelezionate.size === 0}
                      onClick={() => void confermaImportMateriali()}
                    >
                      Importa selezionati
                    </Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg-base">
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={previewSelezionate.size === previewMateriali.length && previewMateriali.length > 0}
                            onChange={toggleTuttePreview}
                            className="rounded border-border"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Descrizione</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Fornitore</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">Data</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">DDT</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Qtà</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Prezzo unit.</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">Totale</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewMateriali.map((m, idx) => (
                        <tr
                          key={idx}
                          className={`border-b border-border last:border-b-0 cursor-pointer transition-colors duration-150 ${
                            previewSelezionate.has(idx) ? "bg-brand-50" : "hover:bg-bg-base"
                          }`}
                          onClick={() => togglePreviewRow(idx)}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={previewSelezionate.has(idx)}
                              onChange={() => togglePreviewRow(idx)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-border"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-text-primary">{m.descrizione}</td>
                          <td className="px-4 py-3 text-text-muted">{m.fornitore ?? "—"}</td>
                          <td className="px-4 py-3 text-text-muted">{formattaData(m.data_acquisto ?? null)}</td>
                          <td className="px-4 py-3 text-text-muted">{m.numero_ddt ?? "—"}</td>
                          <td className="px-4 py-3 text-right text-text-muted">{m.quantita ?? 1}</td>
                          <td className="px-4 py-3 text-right text-text-muted">{formattaEuro(m.prezzo_unitario)}</td>
                          <td className="px-4 py-3 text-right font-medium text-text-primary">
                            {formattaEuro((m.quantita ?? 1) * m.prezzo_unitario)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Modal aggiungi materiale */}
      {modalAperta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) chiudiModal(); }}
        >
          <Card className="w-full max-w-lg p-6">
            <h3 className="font-heading text-lg font-medium text-text-primary mb-5">
              Aggiungi materiale
            </h3>
            <form onSubmit={(e) => void handleAggiungiMateriale(e)} className="flex flex-col gap-4">
              <Input
                label="Descrizione *"
                placeholder="es. Ferro tondo Ø12"
                value={formMateriale.descrizione}
                onChange={(e) =>
                  setFormMateriale((f) => ({ ...f, descrizione: e.target.value }))
                }
              />
              <Input
                label="Fornitore"
                placeholder="es. Ferramenta Rossi"
                value={formMateriale.fornitore}
                onChange={(e) =>
                  setFormMateriale((f) => ({ ...f, fornitore: e.target.value }))
                }
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Quantità"
                  type="number"
                  step="0.001"
                  min="0"
                  value={formMateriale.quantita}
                  onChange={(e) =>
                    setFormMateriale((f) => ({ ...f, quantita: e.target.value }))
                  }
                />
                <Input
                  label="Prezzo unitario (€) *"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formMateriale.prezzo_unitario}
                  onChange={(e) =>
                    setFormMateriale((f) => ({ ...f, prezzo_unitario: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Data acquisto"
                  type="date"
                  value={formMateriale.data_acquisto}
                  onChange={(e) =>
                    setFormMateriale((f) => ({ ...f, data_acquisto: e.target.value }))
                  }
                />
                <Input
                  label="N° DDT"
                  placeholder="es. 00123"
                  value={formMateriale.numero_ddt}
                  onChange={(e) =>
                    setFormMateriale((f) => ({ ...f, numero_ddt: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="submit" loading={salvaggioMateriale}>
                  Salva
                </Button>
                <Button type="button" variant="secondary" onClick={chiudiModal}>
                  Annulla
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
