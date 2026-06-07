"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { APP_ROUTES } from "@/constants/routes";
import { API_HEADERS } from "@/constants/api";
import { supabase } from "@/lib/supabase";
import { getMessaggioErrore } from "@/lib/errors";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { isSuperadmin } from "@/services/dipendenti/isSuperadmin";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatoAbbonamento = "trial" | "attivo" | "sospeso" | "scaduto";
type Piano = "base" | "pro" | "enterprise";

type Azienda = {
  id: string;
  nome: string;
  email: string | null;
  stato_abbonamento: StatoAbbonamento;
  piano: Piano | null;
  trial_scadenza: string | null;
  attiva: boolean;
  created_at: string;
};

// ─── Form types ───────────────────────────────────────────────────────────────

type FormNuovaAzienda = {
  nome: string;
  email: string;
  partita_iva: string;
  codice_fiscale: string;
  indirizzo: string;
  telefono: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FORM_NUOVA_AZIENDA_INIZIALE: FormNuovaAzienda = {
  nome: "", email: "", partita_iva: "", codice_fiscale: "", indirizzo: "", telefono: "",
};

const STATO_BADGE: Record<StatoAbbonamento, BadgeProps["variant"]> = {
  trial:   "warning",
  attivo:  "success",
  sospeso: "error",
  scaduto: "muted",
};

const LABEL_STATO: Record<StatoAbbonamento, string> = {
  trial:   "Trial",
  attivo:  "Attivo",
  sospeso: "Sospeso",
  scaduto: "Scaduto",
};

const LABEL_PIANO: Record<Piano, string> = {
  base:       "Base",
  pro:        "Pro",
  enterprise: "Enterprise",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione utente non valida");
  return token;
}

function formattaData(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperadminPage() {
  const router = useRouter();
  const toast = useToast();

  const [autorizzato, setAutorizzato] = useState(false);
  const [caricamento, setCaricamento] = useState(true);
  const [aziende, setAziende] = useState<Azienda[]>([]);
  const [aggiornamento, setAggiornamento] = useState<string | null>(null);
  const [mostraModal, setMostraModal] = useState(false);
  const [formNuova, setFormNuova] = useState<FormNuovaAzienda>(FORM_NUOVA_AZIENDA_INIZIALE);
  const [creazione, setCreazione] = useState(false);
  const [erroreNome, setErroreNome] = useState<string | undefined>(undefined);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deleteModalAzienda, setDeleteModalAzienda] = useState<Azienda | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);

  // ── Auth + caricamento ────────────────────────────────────────────────────

  useEffect(() => {
    let attivo = true;

    const inizializza = async () => {
      try {
        const user = await loadUtenteAuth();
        if (!user?.email) { router.replace(APP_ROUTES.HOME); return; }

        const superadminOk = await isSuperadmin(user.email);
        if (!superadminOk) { router.replace(APP_ROUTES.HOME); return; }

        if (!attivo) return;
        setAutorizzato(true);

        const token = await getAccessToken();
        const res = await fetch("/api/superadmin/aziende", {
          headers: {
            [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
          },
        });
        if (!res.ok) throw new Error("Errore caricamento aziende");

        const data = (await res.json()) as Azienda[];
        if (attivo) setAziende(data);
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, "Errore caricamento"));
      } finally {
        if (attivo) setCaricamento(false);
      }
    };

    void inizializza();
    return () => { attivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Aggiorna azienda ──────────────────────────────────────────────────────

  const aggiornaAzienda = async (
    id: string,
    patch: Partial<Pick<Azienda, "attiva" | "stato_abbonamento" | "piano">>
  ) => {
    try {
      setAggiornamento(id);
      const token = await getAccessToken();
      const res = await fetch(`/api/superadmin/aziende/${id}`, {
        method: "PATCH",
        headers: {
          [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Errore aggiornamento azienda");
      const aggiornata = (await res.json()) as Azienda;
      setAziende((prev) => prev.map((a) => (a.id === id ? aggiornata : a)));
      toast.success("Azienda aggiornata");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore aggiornamento azienda"));
    } finally {
      setAggiornamento(null);
    }
  };

  // ── Nuova azienda ─────────────────────────────────────────────────────────

  const chiudiModal = () => {
    setMostraModal(false);
    setFormNuova(FORM_NUOVA_AZIENDA_INIZIALE);
    setErroreNome(undefined);
  };

  const chiudiDeleteModal = () => {
    setDeleteModalAzienda(null);
    setDeleteInput("");
  };

  const eliminaAzienda = async () => {
    if (!deleteModalAzienda) return;
    try {
      setDeleting(true);
      const token = await getAccessToken();
      const res = await fetch(`/api/superadmin/aziende/${deleteModalAzienda.id}`, {
        method: "DELETE",
        headers: {
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
        },
      });
      if (!res.ok) throw new Error("Errore eliminazione azienda");
      setAziende((prev) => prev.filter((a) => a.id !== deleteModalAzienda.id));
      chiudiDeleteModal();
      toast.success("Azienda eliminata");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore eliminazione azienda"));
    } finally {
      setDeleting(false);
    }
  };

  const creaNuovaAzienda = async (e: FormEvent) => {
    e.preventDefault();
    if (!formNuova.nome.trim()) {
      setErroreNome("Il nome azienda è obbligatorio");
      return;
    }
    setErroreNome(undefined);
    try {
      setCreazione(true);
      const token = await getAccessToken();
      const res = await fetch("/api/superadmin/aziende", {
        method: "POST",
        headers: {
          [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
        },
        body: JSON.stringify({
          nome:           formNuova.nome.trim(),
          email:          formNuova.email.trim() || null,
          partita_iva:    formNuova.partita_iva.trim() || null,
          codice_fiscale: formNuova.codice_fiscale.trim() || null,
          indirizzo:      formNuova.indirizzo.trim() || null,
          telefono:       formNuova.telefono.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Errore creazione azienda");
      const nuova = (await res.json()) as Azienda;
      setAziende((prev) => [nuova, ...prev]);
      chiudiModal();
      toast.success("Azienda creata");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore creazione azienda"));
    } finally {
      setCreazione(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (!autorizzato || caricamento) {
    return (
      <div className="min-h-dvh bg-bg-base flex items-center justify-center">
        <p className="text-sm text-text-muted">Caricamento...</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-bg-base">
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          href="/"
          className="text-sm text-text-muted hover:text-text-primary transition-colors duration-150"
        >
          ← Home
        </Link>

        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-medium text-text-primary">
              Superadmin — Aziende
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              {aziende.length} {aziende.length === 1 ? "azienda registrata" : "aziende registrate"}
            </p>
          </div>
          <Button onClick={() => setMostraModal(true)}>+ Nuova azienda</Button>
        </div>

        <Card className="mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle">
                  {["Azienda", "Stato", "Piano", "Trial scadenza", "Creata", "Attiva", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium text-text-muted"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {aziende.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-text-muted"
                    >
                      Nessuna azienda
                    </td>
                  </tr>
                )}
                {aziende.map((az) => {
                  const loading = aggiornamento === az.id;
                  return (
                    <tr
                      key={az.id}
                      className="border-b border-border last:border-b-0 transition-colors duration-150 hover:bg-bg-base"
                    >
                      {/* Azienda */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{az.nome}</p>
                        {az.email && (
                          <p className="text-xs text-text-muted">{az.email}</p>
                        )}
                      </td>

                      {/* Stato abbonamento */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <Badge variant={STATO_BADGE[az.stato_abbonamento]} size="sm">
                            {LABEL_STATO[az.stato_abbonamento]}
                          </Badge>
                          <select
                            value={az.stato_abbonamento}
                            onChange={(e) =>
                              void aggiornaAzienda(az.id, {
                                stato_abbonamento: e.target.value as StatoAbbonamento,
                              })
                            }
                            disabled={loading}
                            className="h-7 w-28 rounded border border-border bg-bg-card px-1.5 text-xs text-text-primary outline-none focus:border-brand-500 disabled:opacity-50"
                          >
                            <option value="trial">Trial</option>
                            <option value="attivo">Attivo</option>
                            <option value="sospeso">Sospeso</option>
                            <option value="scaduto">Scaduto</option>
                          </select>
                        </div>
                      </td>

                      {/* Piano */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs text-text-secondary">
                            {az.piano ? LABEL_PIANO[az.piano] : "—"}
                          </span>
                          <select
                            value={az.piano ?? "base"}
                            onChange={(e) =>
                              void aggiornaAzienda(az.id, {
                                piano: e.target.value as Piano,
                              })
                            }
                            disabled={loading}
                            className="h-7 w-28 rounded border border-border bg-bg-card px-1.5 text-xs text-text-primary outline-none focus:border-brand-500 disabled:opacity-50"
                          >
                            <option value="base">Base</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        </div>
                      </td>

                      {/* Trial scadenza */}
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {formattaData(az.trial_scadenza)}
                      </td>

                      {/* Creata */}
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {formattaData(az.created_at)}
                      </td>

                      {/* Attiva */}
                      <td className="px-4 py-3">
                        <Badge variant={az.attiva ? "success" : "muted"} size="sm">
                          {az.attiva ? "Sì" : "No"}
                        </Badge>
                      </td>

                      {/* Toggle attiva + Elimina */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant={az.attiva ? "destructive" : "secondary"}
                            size="sm"
                            loading={loading}
                            onClick={() =>
                              void aggiornaAzienda(az.id, { attiva: !az.attiva })
                            }
                          >
                            {az.attiva ? "Disattiva" : "Attiva"}
                          </Button>
                          {confirmingDeleteId === az.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteModalAzienda(az);
                                  setConfirmingDeleteId(null);
                                }}
                                className="rounded border border-error-500 px-2 py-1 text-xs font-medium text-error-500 transition-colors hover:bg-error-500/10"
                              >
                                Sei sicuro?
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingDeleteId(null)}
                                className="text-xs text-text-muted hover:text-text-primary"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmingDeleteId(az.id)}
                              className="rounded p-1 text-text-muted transition-colors hover:text-error-500"
                              aria-label="Elimina azienda"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </main>

      {/* ── Modal elimina azienda ── */}
      {deleteModalAzienda && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) chiudiDeleteModal(); }}
        >
          <Card className="w-full max-w-sm p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading text-lg font-medium text-error-500">
                Elimina azienda
              </h2>
              <button
                type="button"
                onClick={chiudiDeleteModal}
                aria-label="Chiudi"
                className="text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-text-secondary">
              Questa operazione è <strong>irreversibile</strong>. Tutti i dati
              dell&apos;azienda verranno eliminati definitivamente.
            </p>
            <p className="mb-2 text-xs text-text-muted">
              Digita <span className="font-semibold text-text-primary">{deleteModalAzienda.nome}</span> per confermare:
            </p>
            <Input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={deleteModalAzienda.nome}
              disabled={deleting}
              autoFocus
            />
            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={chiudiDeleteModal}
                disabled={deleting}
              >
                Annulla
              </Button>
              <Button
                type="button"
                variant="destructive"
                loading={deleting}
                disabled={deleteInput !== deleteModalAzienda.nome}
                onClick={() => void eliminaAzienda()}
                className="flex-1"
              >
                Elimina definitivamente
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal nuova azienda ── */}
      {mostraModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) chiudiModal(); }}
        >
          <Card className="w-full max-w-md p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-heading text-lg font-medium text-text-primary">
                Nuova azienda
              </h2>
              <button
                type="button"
                onClick={chiudiModal}
                aria-label="Chiudi"
                className="text-text-muted hover:text-text-primary transition-colors duration-150"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => void creaNuovaAzienda(e)} noValidate className="flex flex-col gap-4">
              <Input
                label="Nome azienda *"
                value={formNuova.nome}
                onChange={(e) => setFormNuova((f) => ({ ...f, nome: e.target.value }))}
                error={erroreNome}
                disabled={creazione}
                autoFocus
              />
              <Input
                label="Email"
                type="email"
                value={formNuova.email}
                onChange={(e) => setFormNuova((f) => ({ ...f, email: e.target.value }))}
                disabled={creazione}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Partita IVA"
                  value={formNuova.partita_iva}
                  onChange={(e) => setFormNuova((f) => ({ ...f, partita_iva: e.target.value }))}
                  disabled={creazione}
                />
                <Input
                  label="Codice fiscale"
                  value={formNuova.codice_fiscale}
                  onChange={(e) => setFormNuova((f) => ({ ...f, codice_fiscale: e.target.value }))}
                  disabled={creazione}
                />
              </div>
              <Input
                label="Indirizzo"
                value={formNuova.indirizzo}
                onChange={(e) => setFormNuova((f) => ({ ...f, indirizzo: e.target.value }))}
                disabled={creazione}
              />
              <Input
                label="Telefono"
                type="tel"
                value={formNuova.telefono}
                onChange={(e) => setFormNuova((f) => ({ ...f, telefono: e.target.value }))}
                disabled={creazione}
              />

              <div className="mt-2 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={chiudiModal}
                  disabled={creazione}
                >
                  Annulla
                </Button>
                <Button type="submit" loading={creazione} className="flex-1">
                  Crea azienda
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
