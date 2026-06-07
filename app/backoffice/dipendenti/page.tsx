"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Home,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { supabase } from "@/lib/supabase";

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
import { getMessaggioErrore } from "@/lib/errors";

// ─── Local types ─────────────────────────────────────────────────────────────

type DipendenteLulEstrato = {
  nome: string;
  cognome: string;
  ral: number;
  qualifica?: string | null;
  ore_settimanali?: number | null;
};

type DipendenteLulRow = DipendenteLulEstrato & {
  dipendenteEsistente: Dipendente | null;
};

type DipendenteFormState = {
  nome: string;
  cognome: string;
  email: string;
  ruolo: RuoloDipendente;
  attivo: boolean;
  tipo_conteggio_ore: TipoConteggioOre;
  costo_orario: string;
  ral: string;
};

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

const FORM_INIZIALE: DipendenteFormState = {
  nome: "",
  cognome: "",
  email: "",
  ruolo: RUOLI_DIPENDENTE.OPERAIO,
  attivo: true,
  tipo_conteggio_ore: TIPO_CONTEGGIO_ORE.REALE,
  costo_orario: "",
  ral: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────


function parseNumericoDecimale(value: string): number | null {
  if (!value.trim()) return null;
  const n = Number(value.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function preparaDipendente(dipendente: DipendenteFormState): DipendenteInput {
  return {
    nome: dipendente.nome.trim(),
    cognome: dipendente.cognome.trim(),
    email: dipendente.email.trim(),
    ruolo: dipendente.ruolo,
    attivo: dipendente.attivo,
    tipo_conteggio_ore: dipendente.tipo_conteggio_ore,
    costo_orario: parseNumericoDecimale(dipendente.costo_orario),
    ral: parseNumericoDecimale(dipendente.ral),
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
  const [form, setForm] = useState<DipendenteFormState>(FORM_INIZIALE);
  const [dipendenteInModificaId, setDipendenteInModificaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const [confirmDeleteDipendente, setConfirmDeleteDipendente] = useState<Dipendente | null>(null);

  // LUL import
  const fileLulRef = useRef<HTMLInputElement>(null);
  const [previewLul, setPreviewLul] = useState<DipendenteLulRow[]>([]);
  const [previewLulSelezionate, setPreviewLulSelezionate] = useState<Set<number>>(new Set());
  const [importandoLul, setImportandoLul] = useState(false);
  const [aggiornandoLul, setAggiornandoLul] = useState(false);

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
      toast.error(getMessaggioErrore(error, "Errore gestione dipendenti"));
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
        toast.error(getMessaggioErrore(error, "Errore gestione dipendenti"));
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
      toast.error(getMessaggioErrore(error, "Errore gestione dipendenti"));
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
      costo_orario: dipendente.costo_orario !== null ? String(dipendente.costo_orario) : "",
      ral: dipendente.ral !== null ? String(dipendente.ral) : "",
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
          costo_orario: dipendente.costo_orario,
          ral: dipendente.ral,
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
          costo_orario: dipendenteAggiornato.costo_orario !== null ? String(dipendenteAggiornato.costo_orario) : "",
          ral: dipendenteAggiornato.ral !== null ? String(dipendenteAggiornato.ral) : "",
        });
      }

      toast.success(
        dipendenteAggiornato.attivo ? "Dipendente attivato" : "Dipendente disattivato"
      );
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore gestione dipendenti"));
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
      toast.error(getMessaggioErrore(error, "Errore gestione dipendenti"));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleImportaLul = async (file: File | undefined) => {
    if (fileLulRef.current) fileLulRef.current.value = "";
    if (!file) return;
    try {
      setImportandoLul(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessione non valida");
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(API_ROUTES.DIPENDENTI_IMPORTA_LUL, {
        method: "POST",
        headers: {
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${session.access_token}`,
        },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { errore?: string } | null;
        throw new Error(err?.errore ?? "Errore importazione LUL");
      }
      const estratti = await res.json() as DipendenteLulEstrato[];
      const rows: DipendenteLulRow[] = estratti.map((d) => ({
        ...d,
        dipendenteEsistente:
          dipendenti.find(
            (dip) =>
              dip.nome.trim().toLowerCase() === d.nome.trim().toLowerCase() &&
              dip.cognome.trim().toLowerCase() === d.cognome.trim().toLowerCase()
          ) ?? null,
      }));
      setPreviewLul(rows);
      setPreviewLulSelezionate(
        new Set(
          rows.reduce<number[]>((acc, r, i) => {
            if (r.dipendenteEsistente) acc.push(i);
            return acc;
          }, [])
        )
      );
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore importazione LUL"));
    } finally {
      setImportandoLul(false);
    }
  };

  const confermaAggiornaDaLul = async () => {
    const righe = previewLul
      .filter((_, i) => previewLulSelezionate.has(i))
      .filter((r) => r.dipendenteEsistente !== null);
    if (righe.length === 0) {
      toast.error("Nessun dipendente trovato selezionato");
      return;
    }
    try {
      setAggiornandoLul(true);
      console.log("[lul] righe da aggiornare:", righe.map((r) => ({ id: r.dipendenteEsistente?.id, ral: r.ral })));
      const risultati = await Promise.all(
        righe.map(async (r) => {
          const d = r.dipendenteEsistente!;
          try {
            const res = await aggiornaDipendente({
              dipendenteId: d.id,
              dipendente: {
                nome: d.nome, cognome: d.cognome, email: d.email,
                ruolo: d.ruolo, attivo: d.attivo, tipo_conteggio_ore: d.tipo_conteggio_ore,
                ral: r.ral,
                costo_orario: Math.round((r.ral * 1.30) / 1720 * 100) / 100,
              },
            });
            console.log("[lul] aggiornato:", d.id, res);
            return res;
          } catch (err) {
            console.error("[lul] errore aggiornamento:", d.id, err);
            throw err;
          }
        })
      );
      console.log("[lul] tutti aggiornati:", risultati.length);
      toast.success(`${righe.length} dipendenti aggiornati`);
      setPreviewLul([]);
      setPreviewLulSelezionate(new Set());
      await caricaDipendenti();
      if (dipendenteInModificaId) {
        const aggiornato = righe.find((r) => r.dipendenteEsistente?.id === dipendenteInModificaId);
        if (aggiornato) {
          setForm((prev) => ({
            ...prev,
            ral: String(aggiornato.ral),
            costo_orario: String(Math.round((aggiornato.ral * 1.30) / 1720 * 100) / 100),
          }));
        }
      }
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore aggiornamento dipendenti"));
    } finally {
      setAggiornandoLul(false);
    }
  };

  const toggleLulRow = (idx: number) => {
    setPreviewLulSelezionate((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            <input
              ref={fileLulRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => void handleImportaLul(e.target.files?.[0])}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<Upload className="h-4 w-4" />}
              loading={importandoLul}
              onClick={() => fileLulRef.current?.click()}
            >
              Importa da LUL
            </Button>
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

              <div className="flex flex-col gap-1">
                <Input
                  label="Costo orario (€/h)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={form.costo_orario}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, costo_orario: e.target.value }))
                  }
                  disabled={salvataggio}
                />
                <p className="text-xs text-text-muted">
                  Inserisci direttamente il costo orario aziendale
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <Input
                  label="RAL annua lorda (€)"
                  type="number"
                  step="100"
                  min="0"
                  placeholder="0"
                  value={form.ral}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ral: e.target.value }))
                  }
                  disabled={salvataggio}
                />
                <p className="text-xs text-text-muted">
                  In alternativa al costo orario — verrà calcolato automaticamente (RAL × 1.30 / 1720h)
                </p>
                {form.ral && !form.costo_orario && (() => {
                  const ralNum = Number(form.ral);
                  if (!Number.isFinite(ralNum) || ralNum <= 0) return null;
                  return (
                    <p className="text-xs font-medium text-brand-600">
                      Costo orario stimato: €{((ralNum * 1.30) / 1720).toFixed(2)}/h
                    </p>
                  );
                })()}
              </div>

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
                          <div className="flex items-center justify-end gap-1">
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

      {/* Modal preview LUL */}
      {previewLul.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-10 overflow-y-auto">
          <Card className="w-full max-w-3xl p-6 mb-10">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h3 className="font-heading text-lg font-medium text-text-primary">
                  Anteprima import LUL
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {previewLul.filter((r) => r.dipendenteEsistente).length} trovati ·{" "}
                  {previewLul.filter((r) => !r.dipendenteEsistente).length} nuovi (non importabili)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={aggiornandoLul}
                  onClick={() => {
                    setPreviewLul([]);
                    setPreviewLulSelezionate(new Set());
                  }}
                >
                  Annulla
                </Button>
                <Button
                  size="sm"
                  loading={aggiornandoLul}
                  disabled={previewLulSelezionate.size === 0}
                  onClick={() => void confermaAggiornaDaLul()}
                >
                  Aggiorna selezionati
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-base">
                    <th className="px-4 py-3" />
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Dipendente
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Qualifica
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">
                      RAL
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">
                      Costo/h stimato
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">
                      Stato
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewLul.map((r, idx) => {
                    const trovato = r.dipendenteEsistente !== null;
                    const costoStimato = (r.ral * 1.30) / 1720;
                    return (
                      <tr
                        key={idx}
                        className={cn(
                          "border-b border-border last:border-b-0 transition-colors duration-150",
                          trovato ? "cursor-pointer hover:bg-bg-base" : "opacity-60"
                        )}
                        onClick={() => { if (trovato) toggleLulRow(idx); }}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={previewLulSelezionate.has(idx)}
                            disabled={!trovato}
                            onChange={() => toggleLulRow(idx)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-border"
                          />
                        </td>
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {r.cognome} {r.nome}
                        </td>
                        <td className="px-4 py-3 text-text-muted">
                          {r.qualifica ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right text-text-muted">
                          {new Intl.NumberFormat("it-IT", {
                            style: "currency",
                            currency: "EUR",
                          }).format(r.ral)}
                        </td>
                        <td className="px-4 py-3 text-right text-text-muted">
                          €{costoStimato.toFixed(2)}/h
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={trovato ? "success" : "muted"} size="sm">
                            {trovato ? "Trovato" : "Nuovo"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
