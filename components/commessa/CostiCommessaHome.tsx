"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Package, Plus, Trash2, Upload } from "lucide-react";

import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { supabase } from "@/lib/supabase";
import { getMessaggioErrore } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

// ─── Tipi ───────────────────────────────────────────────────────────────────

type CantiereResp = { id: string; nome: string };

type MaterialeRow = {
  id: string;
  descrizione: string;
  fornitore: string | null;
  quantita: number;
  prezzo_unitario: number;
  numero_ddt: string | null;
  data_acquisto: string | null;
  created_at: string;
};

type MaterialeImportRow = {
  descrizione: string;
  fornitore?: string | null;
  quantita?: number | null;
  prezzo_unitario: number;
  numero_ddt?: string | null;
  data_acquisto?: string | null;
};

type MaterialeForm = {
  descrizione: string;
  fornitore: string;
  quantita: string;
  prezzo_unitario: string;
  numero_ddt: string;
  data_acquisto: string;
};

const FORM_VUOTO: MaterialeForm = {
  descrizione: "",
  fornitore: "",
  quantita: "1",
  prezzo_unitario: "",
  numero_ddt: "",
  data_acquisto: "",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formattaEuro(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(n);
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

// ─── Componente ───────────────────────────────────────────────────────────────

export function CostiCommessaHome() {
  const toast = useToast();

  const [cantieri, setCantieri] = useState<CantiereResp[]>([]);
  const [cantiereId, setCantiereId] = useState("");
  const [caricato, setCaricato] = useState(false);

  const [materiali, setMateriali] = useState<MaterialeRow[]>([]);
  const [loadingMateriali, setLoadingMateriali] = useState(false);

  const [form, setForm] = useState<MaterialeForm>(FORM_VUOTO);
  const [formAperto, setFormAperto] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [eliminazioneId, setEliminazioneId] = useState<string | null>(null);

  const [importando, setImportando] = useState(false);
  const [preview, setPreview] = useState<MaterialeImportRow[]>([]);
  const [confermandoImport, setConfermandoImport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Carica i cantieri di cui sono responsabile ──
  useEffect(() => {
    let attivo = true;
    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(API_ROUTES.COMMESSA_CANTIERI, { headers });
        if (!res.ok) return;
        const data = (await res.json()) as CantiereResp[];
        if (!attivo) return;
        setCantieri(data);
        if (data.length > 0) setCantiereId(data[0].id);
      } catch {
        // silenzioso: se non sono responsabile, la sezione resta nascosta
      } finally {
        if (attivo) setCaricato(true);
      }
    })();
    return () => {
      attivo = false;
    };
  }, []);

  const caricaMateriali = useCallback(
    async (id: string) => {
      if (!id) return;
      try {
        setLoadingMateriali(true);
        const headers = await getAuthHeaders();
        const res = await fetch(
          `${API_ROUTES.CONTROLLO_COSTI_MATERIALI}?cantiereId=${id}`,
          { headers }
        );
        if (!res.ok) throw new Error("Errore caricamento materiali");
        setMateriali((await res.json()) as MaterialeRow[]);
      } catch (error: unknown) {
        toast.error(getMessaggioErrore(error, "Errore caricamento materiali"));
      } finally {
        setLoadingMateriali(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    if (cantiereId) void caricaMateriali(cantiereId);
    else setMateriali([]);
  }, [cantiereId, caricaMateriali]);

  // ── Aggiunta manuale ──
  const handleAggiungi = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cantiereId) return;
    if (!form.descrizione.trim()) {
      toast.error("Descrizione obbligatoria");
      return;
    }
    if (!form.prezzo_unitario) {
      toast.error("Prezzo unitario obbligatorio");
      return;
    }
    try {
      setSalvataggio(true);
      const headers = await getAuthHeaders();
      const res = await fetch(API_ROUTES.CONTROLLO_COSTI_MATERIALI, {
        method: "POST",
        headers,
        body: JSON.stringify({
          cantiere_id: cantiereId,
          descrizione: form.descrizione.trim(),
          fornitore: form.fornitore || null,
          quantita: form.quantita ? Number(form.quantita) : 1,
          prezzo_unitario: Number(form.prezzo_unitario),
          numero_ddt: form.numero_ddt || null,
          data_acquisto: form.data_acquisto || null,
        }),
      });
      if (!res.ok) throw new Error("Errore salvataggio materiale");
      toast.success("Materiale aggiunto");
      setForm(FORM_VUOTO);
      setFormAperto(false);
      await caricaMateriali(cantiereId);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore aggiunta materiale"));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleElimina = async (id: string) => {
    if (!window.confirm("Eliminare questa voce?")) return;
    try {
      setEliminazioneId(id);
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_ROUTES.CONTROLLO_COSTI_MATERIALI}/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) throw new Error("Errore eliminazione");
      toast.success("Voce eliminata");
      await caricaMateriali(cantiereId);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore eliminazione"));
    } finally {
      setEliminazioneId(null);
    }
  };

  // ── Import da DDT/Fattura ──
  const handleImporta = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !cantiereId) return;
    try {
      setImportando(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessione non valida");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("cantiereId", cantiereId);
      const res = await fetch(`${API_ROUTES.CONTROLLO_COSTI_MATERIALI}/importa`, {
        method: "POST",
        headers: {
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${session.access_token}`,
        },
        body: formData,
      });
      if (!res.ok) throw new Error("Errore estrazione materiali");
      const data = (await res.json()) as MaterialeImportRow[];
      if (data.length === 0) {
        toast.error("Nessun materiale trovato nel documento");
        return;
      }
      setPreview(data);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore importazione DDT"));
    } finally {
      setImportando(false);
    }
  };

  const confermaImport = async () => {
    if (!cantiereId || preview.length === 0) return;
    try {
      setConfermandoImport(true);
      const headers = await getAuthHeaders();
      await Promise.all(
        preview.map((m) =>
          fetch(API_ROUTES.CONTROLLO_COSTI_MATERIALI, {
            method: "POST",
            headers,
            body: JSON.stringify({
              cantiere_id: cantiereId,
              descrizione: m.descrizione,
              fornitore: m.fornitore ?? null,
              quantita: m.quantita ?? 1,
              prezzo_unitario: m.prezzo_unitario,
              numero_ddt: m.numero_ddt ?? null,
              data_acquisto: m.data_acquisto ?? null,
            }),
          })
        )
      );
      toast.success(`${preview.length} voci importate`);
      setPreview([]);
      await caricaMateriali(cantiereId);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore importazione materiali"));
    } finally {
      setConfermandoImport(false);
    }
  };

  // Nessun cantiere in responsabilità → non mostrare nulla
  if (!caricato || cantieri.length === 0) return null;

  const totale = materiali.reduce(
    (t, m) => t + m.quantita * m.prezzo_unitario,
    0
  );

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Package className="h-5 w-5 text-brand-500" />
        <h2 className="font-heading text-lg font-medium text-text-primary">
          Costi commessa
        </h2>
      </div>
      <p className="-mt-2 mb-4 text-sm text-text-muted">
        Aggiungi materiali e carica i DDT dei tuoi cantieri.
      </p>

      {cantieri.length > 1 && (
        <Select
          label="Cantiere"
          value={cantiereId}
          onChange={(e) => setCantiereId(e.target.value)}
        >
          {cantieri.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      )}

      {/* Azioni */}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => void handleImporta(e)}
        />
        <Button
          variant="secondary"
          className="flex-1"
          loading={importando}
          icon={!importando ? <Upload className="h-4 w-4" /> : undefined}
          onClick={() => fileRef.current?.click()}
          disabled={!cantiereId}
        >
          Importa da DDT/Fattura
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setFormAperto((v) => !v)}
          disabled={!cantiereId}
        >
          Aggiungi a mano
        </Button>
      </div>

      {/* Anteprima import */}
      {preview.length > 0 && (
        <div className="mt-4 rounded-md border border-border bg-bg-base p-3">
          <p className="mb-2 text-sm font-medium text-text-primary">
            {preview.length} voci trovate nel documento
          </p>
          <ul className="mb-3 max-h-52 space-y-1 overflow-y-auto text-sm">
            {preview.map((m, i) => (
              <li
                key={i}
                className="flex justify-between gap-2 border-b border-border/60 py-1 last:border-0"
              >
                <span className="text-text-secondary">
                  {m.quantita ?? 1}× {m.descrizione}
                </span>
                <span className="whitespace-nowrap text-text-primary">
                  {formattaEuro(m.prezzo_unitario)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              loading={confermandoImport}
              onClick={() => void confermaImport()}
            >
              Conferma e salva
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPreview([])}
              disabled={confermandoImport}
            >
              Annulla
            </Button>
          </div>
        </div>
      )}

      {/* Form manuale */}
      {formAperto && (
        <form
          onSubmit={(e) => void handleAggiungi(e)}
          className="mt-4 flex flex-col gap-3 rounded-md border border-border bg-bg-base p-3"
        >
          <Input
            label="Descrizione"
            value={form.descrizione}
            onChange={(e) => setForm((f) => ({ ...f, descrizione: e.target.value }))}
            disabled={salvataggio}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantità"
              type="number"
              inputMode="decimal"
              value={form.quantita}
              onChange={(e) => setForm((f) => ({ ...f, quantita: e.target.value }))}
              disabled={salvataggio}
            />
            <Input
              label="Prezzo unitario (€)"
              type="number"
              inputMode="decimal"
              value={form.prezzo_unitario}
              onChange={(e) =>
                setForm((f) => ({ ...f, prezzo_unitario: e.target.value }))
              }
              disabled={salvataggio}
            />
          </div>
          <Input
            label="Fornitore"
            value={form.fornitore}
            onChange={(e) => setForm((f) => ({ ...f, fornitore: e.target.value }))}
            disabled={salvataggio}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="N. DDT"
              value={form.numero_ddt}
              onChange={(e) => setForm((f) => ({ ...f, numero_ddt: e.target.value }))}
              disabled={salvataggio}
            />
            <Input
              label="Data"
              type="date"
              value={form.data_acquisto}
              onChange={(e) =>
                setForm((f) => ({ ...f, data_acquisto: e.target.value }))
              }
              disabled={salvataggio}
            />
          </div>
          <Button type="submit" loading={salvataggio}>
            Salva materiale
          </Button>
        </form>
      )}

      {/* Lista materiali */}
      <div className="mt-5">
        {loadingMateriali && (
          <p className="py-3 text-sm text-text-muted">Caricamento...</p>
        )}
        {!loadingMateriali && materiali.length === 0 && (
          <p className="py-3 text-sm text-text-muted">
            Nessun costo registrato per questo cantiere.
          </p>
        )}
        {!loadingMateriali && materiali.length > 0 && (
          <>
            <ul className="divide-y divide-border">
              {materiali.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">
                      {m.descrizione}
                    </p>
                    <p className="text-xs text-text-muted">
                      {m.quantita}× {formattaEuro(m.prezzo_unitario)}
                      {m.fornitore ? ` · ${m.fornitore}` : ""}
                      {m.numero_ddt ? ` · DDT ${m.numero_ddt}` : ""}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-sm font-medium text-text-primary">
                    {formattaEuro(m.quantita * m.prezzo_unitario)}
                  </span>
                  <button
                    type="button"
                    aria-label="Elimina"
                    onClick={() => void handleElimina(m.id)}
                    disabled={eliminazioneId === m.id}
                    className="text-error-500 transition-opacity hover:opacity-80 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold text-text-primary">
              <span>Totale</span>
              <span>{formattaEuro(totale)}</span>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
