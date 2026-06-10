"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { Calendar, Home } from "lucide-react";

import { ATTIVITA } from "@/constants/attivita";
import { TIMBRATURE, TIMBRATURE_TESTI } from "@/constants/stati";
import { APP_ROUTES } from "@/constants/routes";
import { supabase } from "@/lib/supabase";
import {
  calcolaOreLavorate,
  type RisultatoOreLavorate,
} from "@/services/timbrature/calcolaOreLavorate";
import {
  loadStoricoTimbrature,
  type TimbraturaStorico,
} from "@/services/timbrature/loadStoricoTimbrature";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import type { TipoAttivita } from "@/types/attivita";
import type { TipoTimbratura } from "@/types/timbrature";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

// ─── Constants ───────────────────────────────────────────────────────────────

const LABEL_TIMBRATURE: Record<TipoTimbratura, string> = {
  [TIMBRATURE.ENTRATA]: "Entrata",
  [TIMBRATURE.PAUSA]: "Pausa",
  [TIMBRATURE.RIENTRO]: "Rientro",
  [TIMBRATURE.USCITA]: "Uscita",
  [TIMBRATURE.CAMBIO_CANTIERE]: "Cambio cantiere",
};

const TIPO_BADGE_VARIANT: Record<TipoTimbratura, BadgeProps["variant"]> = {
  [TIMBRATURE.ENTRATA]: "success",
  [TIMBRATURE.PAUSA]: "warning",
  [TIMBRATURE.RIENTRO]: "success",
  [TIMBRATURE.USCITA]: "muted",
  [TIMBRATURE.CAMBIO_CANTIERE]: "info",
};

const LABEL_ATTIVITA: Record<TipoAttivita, string> = {
  [ATTIVITA.ACQUISTI]: "Acquisti",
  [ATTIVITA.TRASFERTA]: "Trasferta",
  [ATTIVITA.MAGAZZINO]: "Magazzino",
  [ATTIVITA.UFFICIO]: "Ufficio",
  [ATTIVITA.SOPRALLUOGO]: "Sopralluogo",
  [ATTIVITA.ASSISTENZA]: "Assistenza",
  [ATTIVITA.VISITA_MEDICA]: "Visita medica",
  [ATTIVITA.FORMAZIONE]: "Formazione",
  [ATTIVITA.ALTRO]: "Altro",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getIntervalloOggi() {
  const inizio = new Date();
  inizio.setHours(0, 0, 0, 0);
  const fine = new Date(inizio);
  fine.setDate(fine.getDate() + 1);
  return { dataInizio: inizio.toISOString(), dataFine: fine.toISOString() };
}

function formattaDataOra(data: string) {
  return new Date(data).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formattaOreLavorate(risultato: RisultatoOreLavorate) {
  const ore = Math.floor(risultato.totaleMinuti / 60);
  const minuti = risultato.totaleMinuti % 60;
  return `${ore}h ${minuti}m`;
}

function formattaDestinazione(timbratura: TimbraturaStorico) {
  if (timbratura.cantiere_nome) return timbratura.cantiere_nome;
  if (timbratura.attivita_tipo) return LABEL_ATTIVITA[timbratura.attivita_tipo];
  return "Destinazione non disponibile";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StoricoPage() {
  const toast = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [timbrature, setTimbrature] = useState<TimbraturaStorico[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostraBackoffice, setMostraBackoffice] = useState(false);

  const oreLavorate = calcolaOreLavorate(timbrature);
  const timbratureVisualizzate = [...timbrature].reverse();

  useEffect(() => {
    let attivo = true;

    const caricaStorico = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!attivo) return;

        setUser(user);

        if (!user) {
          setTimbrature([]);
          return;
        }

        if (user.email) {
          void Promise.all([
            isAdmin(user.email),
            isResponsabile(user.email),
          ]).then(([admin, responsabile]) => {
            if (attivo) setMostraBackoffice(admin || responsabile);
          });
        }

        const { dataInizio, dataFine } = getIntervalloOggi();
        const storico = await loadStoricoTimbrature({ userId: user.id, dataInizio, dataFine });
        if (!attivo) return;
        setTimbrature(storico);
      } catch (error: unknown) {
        if (!attivo) return;
        toast.error(error instanceof Error ? error.message : "Errore caricamento storico");
      } finally {
        if (attivo) setLoading(false);
      }
    };

    void caricaStorico();
    return () => { attivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            {mostraBackoffice && (
              <Link href={APP_ROUTES.BACKOFFICE}>
                <Button variant="secondary" size="sm">
                  Back-office
                </Button>
              </Link>
            )}
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">
                {TIMBRATURE_TESTI.UI.APP_TITOLO}
              </Button>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-[640px] px-5 py-6">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{TIMBRATURE_TESTI.UI.STORICO}</span>
        </nav>

        <h1 className="font-heading text-2xl font-medium text-text-primary">
          {TIMBRATURE_TESTI.UI.STORICO}
        </h1>
        <p className="mt-1 text-sm text-text-muted">Le tue timbrature di oggi</p>

        {/* Loading */}
        {loading && (
          <p className="mt-8 text-sm text-text-muted">{TIMBRATURE_TESTI.UI.CARICAMENTO}</p>
        )}

        {/* Non autenticato */}
        {!loading && !user && (
          <div className="mt-8 flex flex-col items-center gap-3 py-12 text-center">
            <Calendar className="h-12 w-12 text-text-subtle" />
            <p className="font-medium text-text-muted">Effettua il login per vedere lo storico</p>
          </div>
        )}

        {/* Autenticato, con timbrature */}
        {!loading && user && timbrature.length > 0 && (
          <>
            {/* KPI ore lavorate */}
            <Card className="mt-5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                    Ore lavorate
                  </p>
                  <p className="mt-1 font-heading text-2xl font-medium text-text-primary">
                    {formattaOreLavorate(oreLavorate)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  {oreLavorate.giornataAperta && (
                    <Badge variant="warning" size="sm">Giornata aperta</Badge>
                  )}
                  {oreLavorate.sequenzaIncompleta && (
                    <Badge variant="error" size="sm">Sequenza incompleta</Badge>
                  )}
                </div>
              </div>
            </Card>

            {/* Lista timbrature */}
            <div className="mt-4 flex flex-col gap-3">
              {timbratureVisualizzate.map((timbratura) => (
                <Card key={timbratura.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={TIPO_BADGE_VARIANT[timbratura.tipo]} size="sm">
                          {LABEL_TIMBRATURE[timbratura.tipo]}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-sm text-text-muted">
                        {formattaDestinazione(timbratura)}
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-sm text-text-muted">
                      {formattaDataOra(timbratura.created_at)}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && user && timbrature.length === 0 && (
          <div className="mt-8 flex flex-col items-center gap-4 py-16 text-center">
            <Calendar className="h-12 w-12 text-text-subtle" />
            <div>
              <p className="font-medium text-text-muted">Nessuna timbratura oggi</p>
              <p className="mt-1 text-sm text-text-subtle">
                Quando timbri, le tue attività appaiono qui
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
