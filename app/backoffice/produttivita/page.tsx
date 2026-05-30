"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Home } from "lucide-react";

import { PRODUTTIVITA_TESTI } from "@/constants/produttivita";
import { SAL_STATI, SAL_TESTI } from "@/constants/sal";
import { APP_ROUTES } from "@/constants/routes";

import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadSalCantiere } from "@/services/lavorazioni/loadSalCantiere";

import type { CantiereBackoffice } from "@/types/cantieri";
import type { SalCantiere, SalLavorazione, StatoSalLavorazione } from "@/types/sal";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type RiepilogoProduttivita = {
  lavorazioniCompletate: number;
  lavorazioniInCorso: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMessaggioErrore(error: unknown) {
  return error instanceof Error ? error.message : PRODUTTIVITA_TESTI.ERRORI.GENERICO;
}

function getStatoBadgeVariant(stato: StatoSalLavorazione): BadgeProps["variant"] {
  if (stato === SAL_STATI.COMPLETATA) return "success";
  if (stato === SAL_STATI.IN_CORSO) return "warning";
  return "muted";
}

function getStatoLabel(stato: StatoSalLavorazione) {
  if (stato === SAL_STATI.NON_INIZIATA) return SAL_TESTI.STATI.NON_INIZIATA;
  if (stato === SAL_STATI.COMPLETATA) return SAL_TESTI.STATI.COMPLETATA;
  return SAL_TESTI.STATI.IN_CORSO;
}

function formattaOreUomo(minutiTotali: number) {
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;
  return `${ore}${PRODUTTIVITA_TESTI.UNITA_ORA} ${minuti}${PRODUTTIVITA_TESTI.UNITA_MINUTO}`;
}

function formattaPercentuale(percentuale: number) {
  return `${percentuale}${PRODUTTIVITA_TESTI.SIMBOLO_PERCENTUALE}`;
}

function getRapportoLavorazione(lavorazione: SalLavorazione) {
  if (lavorazione.percentuale_completamento <= 0) {
    return PRODUTTIVITA_TESTI.VALORE_NON_DISPONIBILE;
  }
  const minutiPerPuntoPercentuale = Math.round(
    lavorazione.oreUomoMinuti / lavorazione.percentuale_completamento
  );
  return `${formattaOreUomo(minutiPerPuntoPercentuale)}${PRODUTTIVITA_TESTI.RAPPORTO_SUFFIX}`;
}

function getRiepilogoProduttivita(sal: SalCantiere): RiepilogoProduttivita {
  return sal.lavorazioni.reduce(
    (acc, l) => {
      if (l.stato === SAL_STATI.COMPLETATA) return { ...acc, lavorazioniCompletate: acc.lavorazioniCompletate + 1 };
      if (l.stato === SAL_STATI.IN_CORSO) return { ...acc, lavorazioniInCorso: acc.lavorazioniInCorso + 1 };
      return acc;
    },
    { lavorazioniCompletate: 0, lavorazioniInCorso: 0 }
  );
}

// ─── Local components ─────────────────────────────────────────────────────────

function KpiCard({ label, valore }: { label: string; valore: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-2 font-heading text-3xl font-medium text-text-primary">{valore}</p>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeProduttivitaPage() {
  const toast = useToast();

  const [cantieri, setCantieri] = useState<CantiereBackoffice[]>([]);
  const [cantiereId, setCantiereId] = useState("");
  const [sal, setSal] = useState<SalCantiere | null>(null);
  const [loadingCantieri, setLoadingCantieri] = useState(true);
  const [loadingProduttivita, setLoadingProduttivita] = useState(false);

  const caricaProduttivita = async (nextCantiereId: string) => {
    if (!nextCantiereId) { setSal(null); return; }
    try {
      setLoadingProduttivita(true);
      const dati = await loadSalCantiere(nextCantiereId);
      setSal(dati);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error));
    } finally {
      setLoadingProduttivita(false);
    }
  };

  useEffect(() => {
    let attivo = true;
    const init = async () => {
      try {
        const dati = await loadCantieriBackoffice();
        if (!attivo) return;
        const primoId = dati[0]?.id || "";
        setCantieri(dati);
        setCantiereId(primoId);
        if (primoId) await caricaProduttivita(primoId);
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error));
      } finally {
        if (attivo) setLoadingCantieri(false);
      }
    };
    void init();
    return () => { attivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCantiereChange = (nextCantiereId: string) => {
    setCantiereId(nextCantiereId);
    if (!nextCantiereId) setSal(null);
    void caricaProduttivita(nextCantiereId);
  };

  const loading = loadingCantieri || loadingProduttivita;
  const riepilogo = sal ? getRiepilogoProduttivita(sal) : null;

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            <Link href={APP_ROUTES.BACKOFFICE}>
              <Button variant="secondary" size="sm">{PRODUTTIVITA_TESTI.BACKOFFICE}</Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">{PRODUTTIVITA_TESTI.TIMBRATURE}</Button>
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
            {PRODUTTIVITA_TESTI.BACKOFFICE}
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{PRODUTTIVITA_TESTI.TITOLO}</span>
        </nav>

        <h1 className="font-heading text-2xl font-medium text-text-primary">{PRODUTTIVITA_TESTI.TITOLO}</h1>
        <p className="mt-1 text-sm text-text-muted">{PRODUTTIVITA_TESTI.CARD_DESCRIZIONE}</p>

        {/* Filtro cantiere */}
        <Card className="mt-6 p-5">
          <Select
            label={PRODUTTIVITA_TESTI.CANTIERE}
            value={cantiereId}
            onChange={(e) => handleCantiereChange(e.target.value)}
            disabled={loadingCantieri}
          >
            <option value="">{PRODUTTIVITA_TESTI.SELEZIONA_CANTIERE}</option>
            {cantieri.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </Card>

        {loading && (
          <p className="mt-5 text-sm text-text-muted">{PRODUTTIVITA_TESTI.CARICAMENTO}</p>
        )}

        {!loadingCantieri && cantieri.length === 0 && (
          <Card className="mt-5 p-5">
            <p className="text-sm text-text-muted">{PRODUTTIVITA_TESTI.NESSUN_CANTIERE}</p>
          </Card>
        )}

        {!loading && sal && riepilogo && (
          <>
            {/* KPI */}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label={PRODUTTIVITA_TESTI.AVANZAMENTO_MEDIO} valore={formattaPercentuale(sal.avanzamentoTotale)} />
              <KpiCard label={PRODUTTIVITA_TESTI.ORE_UOMO_TOTALI} valore={formattaOreUomo(sal.oreUomoTotaliMinuti)} />
              <KpiCard label={PRODUTTIVITA_TESTI.LAVORAZIONI_COMPLETATE} valore={String(riepilogo.lavorazioniCompletate)} />
              <KpiCard label={PRODUTTIVITA_TESTI.LAVORAZIONI_IN_CORSO} valore={String(riepilogo.lavorazioniInCorso)} />
            </div>

            {/* Tabella lavorazioni */}
            <Card className="mt-5 overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="font-heading text-lg font-medium text-text-primary">
                  {PRODUTTIVITA_TESTI.LAVORAZIONI}
                </h2>
              </div>

              {sal.lavorazioni.length === 0 ? (
                <p className="px-5 py-4 text-sm text-text-muted">
                  {PRODUTTIVITA_TESTI.NESSUNA_LAVORAZIONE}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg-base">
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{PRODUTTIVITA_TESTI.LAVORAZIONE}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{PRODUTTIVITA_TESTI.PERCENTUALE}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{PRODUTTIVITA_TESTI.STATO}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{PRODUTTIVITA_TESTI.ORE_UOMO}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-text-muted">{PRODUTTIVITA_TESTI.RAPPORTO}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sal.lavorazioni.map((l) => (
                        <tr key={l.id} className="border-b border-border last:border-b-0 hover:bg-bg-base transition-colors duration-150">
                          <td className="px-4 py-3 font-medium text-text-primary">{l.nome}</td>
                          <td className="px-4 py-3 text-text-muted">{formattaPercentuale(l.percentuale_completamento)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={getStatoBadgeVariant(l.stato)} size="sm">
                              {getStatoLabel(l.stato)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-text-muted">{formattaOreUomo(l.oreUomoMinuti)}</td>
                          <td className="px-4 py-3 text-text-muted">{getRapportoLavorazione(l)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
