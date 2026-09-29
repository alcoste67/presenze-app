"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { APP_ROUTES } from "@/constants/routes";
import { API_HEADERS } from "@/constants/api";
import {
  LABEL_MODULI_BACKOFFICE,
  LABEL_PIANI_ABBONAMENTO,
  MODULI_BACKOFFICE,
  PIANI_ABBONAMENTO,
  type ModuloBackoffice,
  type PianoAbbonamento,
} from "@/constants/moduliBackoffice";
import { supabase } from "@/lib/supabase";
import { getMessaggioErrore } from "@/lib/errors";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

type RigaPianoModulo = { piano: PianoAbbonamento; modulo: string; abilitato: boolean };
type AziendaLista = { id: string; nome: string };
type RigaOverride = { modulo: string; abilitato: boolean };
type DettaglioModuliAzienda = {
  piano: PianoAbbonamento | null;
  override: RigaOverride[];
  effettivi: string[];
};

const MODULI_ORDINATI = Object.values(MODULI_BACKOFFICE);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione utente non valida");
  return token;
}

async function chiamaApi<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
    },
  });
  if (!res.ok) {
    const errore = (await res.json().catch(() => null)) as { errore?: string } | null;
    throw Object.assign(new Error(errore?.errore || "Errore chiamata API"), {
      status: res.status,
    });
  }
  return res.json() as Promise<T>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperadminModuliPage() {
  const router = useRouter();
  const toast = useToast();

  const [autorizzato, setAutorizzato] = useState(false);
  const [caricamento, setCaricamento] = useState(true);

  // Griglia piano x modulo
  const [pianoModuli, setPianoModuli] = useState<Map<string, boolean>>(new Map());
  const [salvandoPianoModulo, setSalvandoPianoModulo] = useState<string | null>(null);

  // Override per azienda
  const [aziende, setAziende] = useState<AziendaLista[]>([]);
  const [aziendaSelezionataId, setAziendaSelezionataId] = useState("");
  const [dettaglioAzienda, setDettaglioAzienda] = useState<DettaglioModuliAzienda | null>(null);
  const [caricandoAzienda, setCaricandoAzienda] = useState(false);
  const [salvandoOverride, setSalvandoOverride] = useState<string | null>(null);

  // ── Auth + caricamento iniziale ──────────────────────────────────────────

  useEffect(() => {
    let attivo = true;

    const inizializza = async () => {
      try {
        const user = await loadUtenteAuth();
        if (!user?.email) {
          router.replace(APP_ROUTES.HOME);
          return;
        }

        const [righePiano, listaAziende] = await Promise.all([
          chiamaApi<RigaPianoModulo[]>("/api/superadmin/piano-moduli").catch((err) => {
            if (err?.status === 401 || err?.status === 403) throw err;
            return [] as RigaPianoModulo[];
          }),
          chiamaApi<AziendaLista[]>("/api/superadmin/aziende"),
        ]);

        if (!attivo) return;

        const mappa = new Map<string, boolean>();
        for (const riga of righePiano) {
          mappa.set(`${riga.piano}:${riga.modulo}`, riga.abilitato);
        }

        setPianoModuli(mappa);
        setAziende(listaAziende);
        setAutorizzato(true);
      } catch (error: unknown) {
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403) {
          router.replace(APP_ROUTES.HOME);
          return;
        }
        if (attivo) toast.error(getMessaggioErrore(error, "Errore caricamento"));
      } finally {
        if (attivo) setCaricamento(false);
      }
    };

    void inizializza();
    return () => {
      attivo = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Griglia piano x modulo ───────────────────────────────────────────────

  const abilitatoPerPiano = (piano: PianoAbbonamento, modulo: string): boolean => {
    const chiave = `${piano}:${modulo}`;
    return pianoModuli.has(chiave) ? (pianoModuli.get(chiave) as boolean) : true;
  };

  const toggleModuloPiano = async (piano: PianoAbbonamento, modulo: ModuloBackoffice) => {
    const chiave = `${piano}:${modulo}`;
    const nuovoValore = !abilitatoPerPiano(piano, modulo);

    setSalvandoPianoModulo(chiave);
    try {
      await chiamaApi("/api/superadmin/piano-moduli", {
        method: "PATCH",
        headers: { [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON },
        body: JSON.stringify({ piano, modulo, abilitato: nuovoValore }),
      });
      setPianoModuli((prev) => new Map(prev).set(chiave, nuovoValore));
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore aggiornamento"));
    } finally {
      setSalvandoPianoModulo(null);
    }
  };

  // ── Override per azienda ─────────────────────────────────────────────────

  useEffect(() => {
    if (!aziendaSelezionataId) {
      setDettaglioAzienda(null);
      return;
    }

    let attivo = true;
    const carica = async () => {
      setCaricandoAzienda(true);
      try {
        const dettaglio = await chiamaApi<DettaglioModuliAzienda>(
          `/api/superadmin/aziende/${aziendaSelezionataId}/moduli`
        );
        if (attivo) setDettaglioAzienda(dettaglio);
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, "Errore caricamento azienda"));
      } finally {
        if (attivo) setCaricandoAzienda(false);
      }
    };
    void carica();
    return () => {
      attivo = false;
    };
  }, [aziendaSelezionataId]); // eslint-disable-line react-hooks/exhaustive-deps

  const overridePerModulo = (modulo: string): boolean | null => {
    const riga = dettaglioAzienda?.override.find((o) => o.modulo === modulo);
    return riga ? riga.abilitato : null;
  };

  const impostaOverride = async (modulo: ModuloBackoffice, abilitato: boolean | null) => {
    if (!aziendaSelezionataId) return;
    setSalvandoOverride(modulo);
    try {
      await chiamaApi(`/api/superadmin/aziende/${aziendaSelezionataId}/moduli`, {
        method: "PATCH",
        headers: { [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON },
        body: JSON.stringify({ modulo, abilitato }),
      });
      const dettaglio = await chiamaApi<DettaglioModuliAzienda>(
        `/api/superadmin/aziende/${aziendaSelezionataId}/moduli`
      );
      setDettaglioAzienda(dettaglio);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore aggiornamento"));
    } finally {
      setSalvandoOverride(null);
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
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center gap-4">
          <Link
            href={APP_ROUTES.SUPERADMIN}
            className="text-sm text-text-muted hover:text-text-primary transition-colors duration-150"
          >
            ← Superadmin — Aziende
          </Link>
        </div>

        <h1 className="mt-2 font-heading text-2xl font-medium text-text-primary">
          Moduli backoffice
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Solo visibilità: nasconde le card in /backoffice. Non blocca l&apos;accesso diretto
          alle route dei moduli.
        </p>

        {/* ── Griglia piano x modulo ── */}
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-border bg-bg-subtle px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Default per piano
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-subtle">
                  <th className="px-4 py-2 text-left text-xs font-medium text-text-muted">
                    Modulo
                  </th>
                  {PIANI_ABBONAMENTO.map((piano) => (
                    <th
                      key={piano}
                      className="px-4 py-2 text-center text-xs font-medium text-text-muted"
                    >
                      {LABEL_PIANI_ABBONAMENTO[piano]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MODULI_ORDINATI.map((modulo) => (
                  <tr key={modulo} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2.5 text-text-primary">
                      {LABEL_MODULI_BACKOFFICE[modulo]}
                    </td>
                    {PIANI_ABBONAMENTO.map((piano) => {
                      const chiave = `${piano}:${modulo}`;
                      const abilitato = abilitatoPerPiano(piano, modulo);
                      return (
                        <td key={piano} className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={abilitato}
                            disabled={salvandoPianoModulo === chiave}
                            onChange={() => void toggleModuloPiano(piano, modulo)}
                            className="h-4 w-4 accent-brand-500"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Override per azienda ── */}
        <Card className="mt-6 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Eccezioni per singola azienda
          </h2>

          <Select
            label="Azienda"
            value={aziendaSelezionataId}
            onChange={(e) => setAziendaSelezionataId(e.target.value)}
          >
            <option value="">Seleziona un&apos;azienda...</option>
            {aziende.map((az) => (
              <option key={az.id} value={az.id}>
                {az.nome}
              </option>
            ))}
          </Select>

          {caricandoAzienda && (
            <p className="mt-4 text-sm text-text-muted">Caricamento...</p>
          )}

          {!caricandoAzienda && dettaglioAzienda && (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-xs text-text-muted">
                Piano attuale:{" "}
                {dettaglioAzienda.piano
                  ? LABEL_PIANI_ABBONAMENTO[dettaglioAzienda.piano]
                  : "—"}
              </p>
              {MODULI_ORDINATI.map((modulo) => {
                const override = overridePerModulo(modulo);
                const valore =
                  override === null ? "default" : override ? "attivo" : "disattivo";
                return (
                  <div
                    key={modulo}
                    className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0"
                  >
                    <span className="text-sm text-text-primary">
                      {LABEL_MODULI_BACKOFFICE[modulo]}
                      {!dettaglioAzienda.effettivi.includes(modulo) && (
                        <span className="ml-2 text-xs text-error-500">nascosto</span>
                      )}
                    </span>
                    <select
                      value={valore}
                      disabled={salvandoOverride === modulo}
                      onChange={(e) => {
                        const v = e.target.value;
                        void impostaOverride(
                          modulo,
                          v === "default" ? null : v === "attivo"
                        );
                      }}
                      className="h-8 w-36 rounded border border-border bg-bg-card px-2 text-xs text-text-primary outline-none focus:border-brand-500 disabled:opacity-50"
                    >
                      <option value="default">Usa default piano</option>
                      <option value="attivo">Forza attivo</option>
                      <option value="disattivo">Forza disattivo</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
