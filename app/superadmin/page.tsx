"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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

// ─── Constants ────────────────────────────────────────────────────────────────

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
        <h1 className="font-heading text-2xl font-medium text-text-primary">
          Superadmin — Aziende
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {aziende.length} {aziende.length === 1 ? "azienda registrata" : "aziende registrate"}
        </p>

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

                      {/* Toggle attiva */}
                      <td className="px-4 py-3">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
