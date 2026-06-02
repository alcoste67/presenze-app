"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { FileSpreadsheet, FileText, Home } from "lucide-react";

import { SelectCantiere } from "@/components/cantieri/SelectCantiere";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { COMMESSA_TESTI } from "@/constants/commessa";
import { MACCHINARI_TESTI } from "@/constants/macchinari";
import {
  LABEL_STATI_RAPPORTO_INTERVENTO,
  RAPPORTI_INTERVENTO_STATI,
  RAPPORTI_INTERVENTO_TESTI,
} from "@/constants/rapportiIntervento";
import { APP_ROUTES } from "@/constants/routes";
import { SAL_STATI, SAL_TESTI } from "@/constants/sal";
import { supabase } from "@/lib/supabase";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadDashboardCommessa } from "@/services/commessa/loadDashboardCommessa";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import type { CantiereBackoffice } from "@/types/cantieri";
import type { CostoMacchinarioCommessa } from "@/types/costiMacchinari";
import type { MacchinarioPubblico } from "@/types/macchinari";
import type { StatoRapportoIntervento } from "@/types/rapportiIntervento";
import type { StatoSalLavorazione } from "@/types/sal";
import type { DashboardCommessaData } from "@/services/commessa/loadDashboardCommessa";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { getMessaggioErrore } from "@/lib/errors";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatoDashboard = { loadingCantieri: boolean; loadingDashboard: boolean };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formattaData(data: string) {
  if (!data) return "";
  return new Intl.DateTimeFormat("it-IT").format(new Date(`${data}T00:00:00`));
}

function formattaOre(minutiTotali: number) {
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;
  return `${ore}h ${minuti}m`;
}

function formattaEuro(valore: number | null) {
  if (valore === null) return "";
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(valore);
}

function formattaOreDecimali(valore: number) {
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(valore)} h`;
}

function getStatoSalBadgeVariant(stato: StatoSalLavorazione): BadgeProps["variant"] {
  if (stato === SAL_STATI.COMPLETATA) return "success";
  if (stato === SAL_STATI.IN_CORSO) return "warning";
  return "muted";
}

function getStatoSalLabel(stato: StatoSalLavorazione) {
  if (stato === SAL_STATI.COMPLETATA) return COMMESSA_TESTI.COMPLETATA;
  if (stato === SAL_STATI.IN_CORSO) return COMMESSA_TESTI.IN_CORSO;
  return COMMESSA_TESTI.NON_INIZIATA;
}

function getStatoRapportoBadgeVariant(stato: StatoRapportoIntervento): BadgeProps["variant"] {
  if (stato === RAPPORTI_INTERVENTO_STATI.FIRMATO) return "success";
  if (stato === RAPPORTI_INTERVENTO_STATI.BOZZA) return "muted";
  return "error";
}

function getTipoMacchinarioLabel(tipo: string) {
  return (
    MACCHINARI_TESTI.CODA_TIPI[tipo as keyof typeof MACCHINARI_TESTI.CODA_TIPI] || tipo
  );
}

function getNomeMacchinario(
  costo: CostoMacchinarioCommessa | { macchinario_id: string | null; tipo_macchinario: string },
  macchinari: Map<string, MacchinarioPubblico>
) {
  if (!costo.macchinario_id) return getTipoMacchinarioLabel(costo.tipo_macchinario);
  const macchinario = macchinari.get(costo.macchinario_id);
  return macchinario ? macchinario.nome : getTipoMacchinarioLabel(costo.tipo_macchinario);
}

// ─── Local components ─────────────────────────────────────────────────────────

type KpiTone = "default" | "brand" | "success";

function KpiCard({ label, value, tone = "default" }: { label: string; value: string; tone?: KpiTone }) {
  const accentClass: Record<KpiTone, string> = {
    brand: "bg-brand-500",
    success: "bg-success-500",
    default: "bg-border",
  };
  return (
    <Card className="p-4">
      <div className={`h-1 w-10 rounded-full ${accentClass[tone]}`} />
      <p className="mt-3 text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-2 font-heading text-2xl font-medium text-text-primary">{value}</p>
    </Card>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-4">
        <h2 className="font-heading text-lg font-medium text-text-primary">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {children}
    </Card>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-bg-subtle">
      <div
        className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeCommessaPage() {
  const toast = useToast();

  const [cantieri, setCantieri] = useState<CantiereBackoffice[]>([]);
  const [cantiereId, setCantiereId] = useState("");
  const [dashboard, setDashboard] = useState<DashboardCommessaData | null>(null);
  const [canViewCosti, setCanViewCosti] = useState(false);
  const [loading, setLoading] = useState<StatoDashboard>({
    loadingCantieri: true,
    loadingDashboard: false,
  });
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);

  useEffect(() => {
    let attivo = true;
    const caricaRuolo = async () => {
      try {
        const user = await loadUtenteAuth();
        if (!attivo || !user?.email) return;
        const admin = await isAdmin(user.email);
        if (!attivo) return;
        if (admin) { setCanViewCosti(true); return; }
        const responsabile = await isResponsabile(user.email);
        if (!attivo) return;
        setCanViewCosti(responsabile);
      } catch {
        if (attivo) setCanViewCosti(false);
      }
    };
    void caricaRuolo();
    return () => { attivo = false; };
  }, []);

  useEffect(() => {
    let attivo = true;
    const caricaCantieri = async () => {
      try {
        const dati = await loadCantieriBackoffice();
        if (!attivo) return;
        setCantieri(dati);
        setCantiereId((corrente) => corrente || dati[0]?.id || "");
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, COMMESSA_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoading((c) => ({ ...c, loadingCantieri: false }));
      }
    };
    void caricaCantieri();
    return () => { attivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let attivo = true;
    const caricaDashboard = async () => {
      if (!cantiereId) { setDashboard(null); return; }
      try {
        setLoading((c) => ({ ...c, loadingDashboard: true }));
        const dati = await loadDashboardCommessa({ cantiereId, includeCosti: canViewCosti });
        if (!attivo) return;
        setDashboard(dati);
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, COMMESSA_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoading((c) => ({ ...c, loadingDashboard: false }));
      }
    };
    void caricaDashboard();
    return () => { attivo = false; };
  }, [cantiereId, canViewCosti]); // eslint-disable-line react-hooks/exhaustive-deps

  const cantiereSelezionato = useMemo(
    () => cantieri.find((c) => c.id === cantiereId) || null,
    [cantieri, cantiereId]
  );

  const riepilogo = useMemo(() => {
    const lavorazioni = dashboard?.sal.lavorazioni || [];
    return {
      avanzamento: dashboard?.sal.avanzamentoTotale || 0,
      oreUomo: dashboard?.sal.oreUomoTotaliMinuti || 0,
      completate: lavorazioni.filter((l) => l.stato === SAL_STATI.COMPLETATA).length,
      inCorso: lavorazioni.filter((l) => l.stato === SAL_STATI.IN_CORSO).length,
      foto: dashboard?.numeroFotoSal || 0,
      rapporti: dashboard?.numeroRapportiIntervento || 0,
      oreMacchinari: dashboard?.costiMacchinari.reduce((s, c) => s + (c.ore_utilizzo || 0), 0) || 0,
    };
  }, [dashboard]);

  const macchinariById = useMemo(
    () => new Map(dashboard?.macchinariPubblici.map((m) => [m.id, m]) || []),
    [dashboard]
  );

  const handleExport = useCallback(
    async (route: string, filePrefix: string) => {
      if (!cantiereId) return;
      try {
        if (route.includes("pdf")) setLoadingPdf(true);
        else setLoadingExcel(true);

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error(COMMESSA_TESTI.ERRORI.GENERICO);

        const response = await fetch(
          `${route}?cantiereId=${encodeURIComponent(cantiereId)}`,
          { headers: { [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}` } }
        );

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            typeof payload?.error === "string" ? payload.error : COMMESSA_TESTI.ERRORI.GENERICO
          );
        }

        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        const fileCantiere = (cantiereSelezionato?.nome || cantiereId)
          .normalize("NFKD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 80);
        link.href = url;
        link.download = `${filePrefix}_${fileCantiere || "cantiere"}.${route.includes("pdf") ? "pdf" : "xlsx"}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch (error: unknown) {
        toast.error(getMessaggioErrore(error, COMMESSA_TESTI.ERRORI.GENERICO));
      } finally {
        setLoadingPdf(false);
        setLoadingExcel(false);
      }
    },
    [cantiereId, cantiereSelezionato] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            <Link href={APP_ROUTES.BACKOFFICE}>
              <Button variant="secondary" size="sm">{COMMESSA_TESTI.BACKOFFICE}</Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">{COMMESSA_TESTI.TIMBRATURE}</Button>
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
            {COMMESSA_TESTI.BACKOFFICE}
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{COMMESSA_TESTI.TITOLO}</span>
        </nav>

        {/* Titolo + export */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-medium text-text-primary">
              {COMMESSA_TESTI.TITOLO}
            </h1>
            <p className="mt-1 text-sm text-text-muted">{COMMESSA_TESTI.CARD_DESCRIZIONE}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<FileText className="h-4 w-4" />}
              loading={loadingPdf}
              disabled={!cantiereId}
              onClick={() => void handleExport(API_ROUTES.REPORT_COMMESSA_PDF, "commessa")}
            >
              {COMMESSA_TESTI.ESPORTA_PDF}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FileSpreadsheet className="h-4 w-4" />}
              loading={loadingExcel}
              disabled={!cantiereId}
              onClick={() => void handleExport(API_ROUTES.REPORT_COMMESSA_EXCEL, "commessa")}
            >
              {COMMESSA_TESTI.ESPORTA_EXCEL}
            </Button>
          </div>
        </div>

        {/* Selezione cantiere */}
        <Card className="mt-5 p-5">
          <div className="max-w-xl">
            <SelectCantiere
              cantieri={cantieri}
              cantiereId={cantiereId}
              onChange={(nextId) => setCantiereId(nextId)}
              disabled={loading.loadingCantieri}
            />
          </div>
          {loading.loadingCantieri && cantieri.length === 0 && (
            <p className="mt-3 text-sm text-text-muted">{COMMESSA_TESTI.CARICAMENTO}</p>
          )}
        </Card>

        {/* KPI 7 card */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <KpiCard label={COMMESSA_TESTI.AVANZAMENTO_PERCENTUALE} value={`${riepilogo.avanzamento}%`} tone="brand" />
          <KpiCard label={COMMESSA_TESTI.ORE_UOMO_TOTALI} value={formattaOre(riepilogo.oreUomo)} />
          <KpiCard label={COMMESSA_TESTI.LAVORAZIONI_COMPLETATE} value={String(riepilogo.completate)} tone="success" />
          <KpiCard label={COMMESSA_TESTI.LAVORAZIONI_IN_CORSO} value={String(riepilogo.inCorso)} tone="brand" />
          <KpiCard label={COMMESSA_TESTI.NUMERO_RAPPORTI} value={String(riepilogo.rapporti)} />
          <KpiCard label={COMMESSA_TESTI.NUMERO_FOTO_SAL} value={String(riepilogo.foto)} />
          <KpiCard label={COMMESSA_TESTI.ORE_MACCHINARI} value={formattaOreDecimali(riepilogo.oreMacchinari)} tone="brand" />
        </div>

        {/* Dashboard grid */}
        {loading.loadingDashboard && (
          <p className="mt-5 text-sm text-text-muted">{COMMESSA_TESTI.CARICAMENTO}</p>
        )}

        {!loading.loadingDashboard && dashboard && (
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* 1. Stato avanzamento */}
            <SectionCard
              title={COMMESSA_TESTI.STATO_AVANZAMENTO}
              subtitle={cantiereSelezionato?.nome ?? COMMESSA_TESTI.SELEZIONA_CANTIERE}
            >
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="text-text-muted">{COMMESSA_TESTI.AVANZAMENTO_PERCENTUALE}</span>
                    <span className="font-medium text-text-primary">{riepilogo.avanzamento}%</span>
                  </div>
                  <ProgressBar value={riepilogo.avanzamento} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md bg-bg-subtle p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                      {COMMESSA_TESTI.ORE_UOMO_TOTALI}
                    </p>
                    <p className="mt-2 font-heading text-2xl font-medium text-text-primary">
                      {formattaOre(riepilogo.oreUomo)}
                    </p>
                  </div>
                  <div className="rounded-md bg-bg-subtle p-4">
                    <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                      {COMMESSA_TESTI.NUMERO_RAPPORTI}
                    </p>
                    <p className="mt-2 font-heading text-2xl font-medium text-text-primary">
                      {riepilogo.rapporti}
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* 2. Lavorazioni principali */}
            <SectionCard title={COMMESSA_TESTI.LAVORAZIONI_PRINCIPALI} subtitle={COMMESSA_TESTI.STATO_AVANZAMENTO}>
              {dashboard.sal.lavorazioni.length ? (
                <div className="space-y-3">
                  {dashboard.sal.lavorazioni.slice(0, 6).map((l) => (
                    <div key={l.id} className="rounded-md bg-bg-subtle p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary">{l.nome}</p>
                          <p className="mt-0.5 text-sm text-text-muted">
                            {SAL_TESTI.PERCENTUALE}: {l.percentuale_completamento}%
                          </p>
                          <p className="text-sm text-text-muted">
                            {SAL_TESTI.ORE_UOMO}: {formattaOre(l.oreUomoMinuti)}
                          </p>
                        </div>
                        <Badge variant={getStatoSalBadgeVariant(l.stato)} size="sm">
                          {getStatoSalLabel(l.stato)}
                        </Badge>
                      </div>
                      <div className="mt-3">
                        <ProgressBar value={l.percentuale_completamento} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">{COMMESSA_TESTI.NESSUNA_LAVORAZIONE}</p>
              )}
            </SectionCard>

            {/* 3. Ore uomo */}
            <SectionCard title={COMMESSA_TESTI.ORE_UOMO} subtitle={COMMESSA_TESTI.LAVORAZIONI_PRINCIPALI}>
              {dashboard.sal.lavorazioni.filter((l) => l.oreUomoMinuti > 0).length ? (
                <div className="space-y-3">
                  {dashboard.sal.lavorazioni
                    .filter((l) => l.oreUomoMinuti > 0)
                    .sort((a, b) => b.oreUomoMinuti - a.oreUomoMinuti)
                    .slice(0, 5)
                    .map((l) => (
                      <div key={l.id} className="flex items-start justify-between gap-3 rounded-md bg-bg-subtle p-4">
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary">{l.nome}</p>
                          <p className="mt-0.5 text-sm text-text-muted">
                            {SAL_TESTI.PERCENTUALE}: {l.percentuale_completamento}%
                          </p>
                        </div>
                        <p className="shrink-0 font-medium text-text-primary">
                          {formattaOre(l.oreUomoMinuti)}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">{COMMESSA_TESTI.NESSUN_DATO}</p>
              )}
            </SectionCard>

            {/* 4. Macchinari utilizzati */}
            <SectionCard
              title={COMMESSA_TESTI.MACCHINARI_UTILIZZATI}
              subtitle={canViewCosti ? MACCHINARI_TESTI.COSTO_ORARIO_VISIBILE : COMMESSA_TESTI.IMPORTO_NON_VISIBILE}
            >
              {dashboard.costiMacchinari.length ? (
                <div className="space-y-3">
                  {dashboard.costiMacchinari.map((costo) => (
                    <div key={costo.id} className="rounded-md bg-bg-subtle p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-text-primary">
                            {getNomeMacchinario(costo, macchinariById)}
                          </p>
                          <p className="mt-0.5 text-sm text-text-muted">
                            {getTipoMacchinarioLabel(costo.tipo_macchinario)}
                          </p>
                          <p className="text-sm text-text-muted">{formattaData(costo.data_utilizzo)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-text-primary">
                            {formattaOre(Math.round(costo.ore_utilizzo * 60))}
                          </p>
                          {canViewCosti && "costo_totale" in costo && (
                            <p className="mt-0.5 text-sm font-medium text-brand-600">
                              {formattaEuro(costo.costo_totale)}
                            </p>
                          )}
                        </div>
                      </div>
                      {costo.note && (
                        <p className="mt-2 text-sm text-text-muted">{costo.note}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">{COMMESSA_TESTI.NESSUN_DATO}</p>
              )}
            </SectionCard>

            {/* 5. Foto recenti */}
            <SectionCard title={COMMESSA_TESTI.FOTO_RECENTI} subtitle={COMMESSA_TESTI.NUMERO_FOTO_SAL}>
              {dashboard.fotoRecenti.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {dashboard.fotoRecenti.map((foto) => (
                    <article key={foto.id} className="rounded-md bg-bg-subtle p-3">
                      <div className="relative aspect-square w-full overflow-hidden rounded-md">
                        <Image
                          src={foto.immagine_data_url}
                          alt={foto.descrizione || COMMESSA_TESTI.FOTO_RECENTI}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-medium text-text-primary">
                          {foto.descrizione || COMMESSA_TESTI.FOTO_RECENTI}
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted">{formattaData(foto.data_riferimento)}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">{COMMESSA_TESTI.NESSUNA_FOTO}</p>
              )}
            </SectionCard>

            {/* 6. Rapporti recenti */}
            <SectionCard title={COMMESSA_TESTI.RAPPORTI_RECENTI} subtitle={COMMESSA_TESTI.NUMERO_RAPPORTI}>
              {dashboard.rapportiRecenti.length ? (
                <div className="space-y-3">
                  {dashboard.rapportiRecenti.map((rapporto) => (
                    <div key={rapporto.id} className="rounded-md bg-bg-subtle p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary">{rapporto.cliente_committente}</p>
                          <p className="mt-0.5 text-sm text-text-muted">{formattaData(rapporto.data_intervento)}</p>
                          <p className="text-sm text-text-muted">{rapporto.responsabile_nome}</p>
                        </div>
                        <Badge variant={getStatoRapportoBadgeVariant(rapporto.stato)} size="sm">
                          {LABEL_STATI_RAPPORTO_INTERVENTO[rapporto.stato]}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-text-muted">{RAPPORTI_INTERVENTO_TESTI.ORE_UOMO_REALI}</span>
                        <span className="font-medium text-text-primary">
                          {formattaOre(rapporto.ore_uomo_reali_minuti)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-muted">{COMMESSA_TESTI.NESSUN_RAPPORTO}</p>
              )}
            </SectionCard>
          </div>
        )}
      </main>
    </div>
  );
}
