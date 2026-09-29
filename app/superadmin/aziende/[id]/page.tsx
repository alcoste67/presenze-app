"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { APP_ROUTES } from "@/constants/routes";
import { API_HEADERS } from "@/constants/api";
import { supabase } from "@/lib/supabase";
import { getMessaggioErrore } from "@/lib/errors";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatoAbbonamento = "trial" | "attivo" | "sospeso" | "scaduto";
type Piano = "base" | "pro" | "enterprise";

type AziendaDettaglio = {
  id: string;
  nome: string;
  email: string | null;
  partita_iva: string | null;
  codice_fiscale: string | null;
  indirizzo: string | null;
  telefono: string | null;
  stato_abbonamento: StatoAbbonamento;
  piano: Piano | null;
  trial_scadenza: string | null;
  attiva: boolean;
  created_at: string;
};

type Utilizzo = {
  dipendentiTotali: number;
  dipendentiAttivi: number;
  cantieriAttivi: number;
  ultimaTimbraturaAt: string | null;
  ultimoMese: {
    rapportiIntervento: number;
    checklistWallbox: number;
    salFreeze: number;
  };
};

type RispostaDettaglio = {
  azienda: AziendaDettaglio;
  utilizzo: Utilizzo;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATO_BADGE: Record<StatoAbbonamento, BadgeProps["variant"]> = {
  trial: "warning",
  attivo: "success",
  sospeso: "error",
  scaduto: "muted",
};

const LABEL_STATO: Record<StatoAbbonamento, string> = {
  trial: "Trial",
  attivo: "Attivo",
  sospeso: "Sospeso",
  scaduto: "Scaduto",
};

const LABEL_PIANO: Record<Piano, string> = {
  base: "Base",
  pro: "Pro",
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
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formattaDataOra(iso: string | null): string {
  if (!iso) return "Mai";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function CampoAnagrafica({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm text-text-primary">{value?.trim() || "—"}</p>
    </div>
  );
}

function StatUtilizzo({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-4">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 font-heading text-2xl font-medium text-text-primary">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperadminAziendaDettaglioPage() {
  const router = useRouter();
  const toast = useToast();
  const params = useParams<{ id: string }>();
  const aziendaId = params?.id;

  const [autorizzato, setAutorizzato] = useState(false);
  const [caricamento, setCaricamento] = useState(true);
  const [dati, setDati] = useState<RispostaDettaglio | null>(null);

  useEffect(() => {
    let attivo = true;

    const inizializza = async () => {
      if (!aziendaId) return;

      try {
        const user = await loadUtenteAuth();
        if (!user?.email) {
          router.replace(APP_ROUTES.HOME);
          return;
        }

        const token = await getAccessToken();
        const res = await fetch(`/api/superadmin/aziende/${aziendaId}`, {
          headers: {
            [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
          },
        });

        if (res.status === 401 || res.status === 403) {
          router.replace(APP_ROUTES.HOME);
          return;
        }
        if (res.status === 404) {
          if (!attivo) return;
          toast.error("Azienda non trovata");
          router.replace(APP_ROUTES.SUPERADMIN);
          return;
        }
        if (!res.ok) throw new Error("Errore caricamento azienda");

        const payload = (await res.json()) as RispostaDettaglio;
        if (!attivo) return;
        setAutorizzato(true);
        setDati(payload);
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, "Errore caricamento"));
      } finally {
        if (attivo) setCaricamento(false);
      }
    };

    void inizializza();
    return () => {
      attivo = false;
    };
  }, [aziendaId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!autorizzato || caricamento || !dati) {
    return (
      <div className="min-h-dvh bg-bg-base flex items-center justify-center">
        <p className="text-sm text-text-muted">Caricamento...</p>
      </div>
    );
  }

  const { azienda, utilizzo } = dati;

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

        <div className="mt-2 flex items-center gap-3">
          <h1 className="font-heading text-2xl font-medium text-text-primary">
            {azienda.nome}
          </h1>
          <Badge variant={STATO_BADGE[azienda.stato_abbonamento]} size="sm">
            {LABEL_STATO[azienda.stato_abbonamento]}
          </Badge>
          <Badge variant={azienda.attiva ? "success" : "muted"} size="sm">
            {azienda.attiva ? "Attiva" : "Disattivata"}
          </Badge>
        </div>

        {/* ── Anagrafica ── */}
        <Card className="mt-6 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Anagrafica
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <CampoAnagrafica label="Email" value={azienda.email} />
            <CampoAnagrafica label="Telefono" value={azienda.telefono} />
            <CampoAnagrafica label="Partita IVA" value={azienda.partita_iva} />
            <CampoAnagrafica label="Codice fiscale" value={azienda.codice_fiscale} />
            <CampoAnagrafica label="Indirizzo" value={azienda.indirizzo} />
            <CampoAnagrafica
              label="Piano"
              value={azienda.piano ? LABEL_PIANO[azienda.piano] : null}
            />
            <CampoAnagrafica label="Trial scadenza" value={formattaData(azienda.trial_scadenza)} />
            <CampoAnagrafica label="Registrata il" value={formattaData(azienda.created_at)} />
          </div>
        </Card>

        {/* ── Utilizzo ── */}
        <Card className="mt-6 p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Attività
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatUtilizzo
              label="Dipendenti attivi"
              value={`${utilizzo.dipendentiAttivi} / ${utilizzo.dipendentiTotali}`}
            />
            <StatUtilizzo label="Cantieri attivi" value={utilizzo.cantieriAttivi} />
            <StatUtilizzo
              label="Ultima timbratura"
              value={formattaDataOra(utilizzo.ultimaTimbraturaAt)}
            />
            <StatUtilizzo
              label="Rapporti intervento (30gg)"
              value={utilizzo.ultimoMese.rapportiIntervento}
            />
            <StatUtilizzo
              label="Checklist wallbox (30gg)"
              value={utilizzo.ultimoMese.checklistWallbox}
            />
            <StatUtilizzo
              label="SAL freeze (30gg)"
              value={utilizzo.ultimoMese.salFreeze}
            />
          </div>
        </Card>
      </main>
    </div>
  );
}
