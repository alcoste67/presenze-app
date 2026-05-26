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

import { SelectCantiere } from "@/components/cantieri/SelectCantiere";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import {
  COMMESSA_TESTI,
} from "@/constants/commessa";
import { APP_ROUTES } from "@/constants/routes";
import { MACCHINARI_TESTI } from "@/constants/macchinari";
import {
  LABEL_STATI_RAPPORTO_INTERVENTO,
  RAPPORTI_INTERVENTO_STATI,
  RAPPORTI_INTERVENTO_TESTI,
} from "@/constants/rapportiIntervento";
import {
  SAL_STATI,
  SAL_TESTI,
} from "@/constants/sal";
import { supabase } from "@/lib/supabase";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadDashboardCommessa } from "@/services/commessa/loadDashboardCommessa";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import type { CostoMacchinarioCommessa } from "@/types/costiMacchinari";
import type { CantiereBackoffice } from "@/types/cantieri";
import type { DashboardCommessaData } from "@/services/commessa/loadDashboardCommessa";
import type {
  StatoRapportoIntervento,
} from "@/types/rapportiIntervento";
import type {
  StatoSalLavorazione,
} from "@/types/sal";
import type { MacchinarioPubblico } from "@/types/macchinari";

type StatoDashboard = {
  loadingCantieri: boolean;
  loadingDashboard: boolean;
};

function getMessaggioErrore(error: unknown) {
  return error instanceof Error
    ? error.message
    : COMMESSA_TESTI.ERRORI.GENERICO;
}

function formattaData(data: string) {
  if (!data) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT").format(
    new Date(`${data}T00:00:00`)
  );
}

function formattaOre(minutiTotali: number) {
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;

  return `${ore}h ${minuti}m`;
}

function formattaEuro(valore: number | null) {
  if (valore === null) {
    return "";
  }

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(valore);
}

function formattaOreDecimali(valore: number) {
  return `${new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 2,
  }).format(valore)} h`;
}

function getStatoSalLabel(
  stato: StatoSalLavorazione
) {
  if (stato === SAL_STATI.COMPLETATA) {
    return COMMESSA_TESTI.COMPLETATA;
  }

  if (stato === SAL_STATI.IN_CORSO) {
    return COMMESSA_TESTI.IN_CORSO;
  }

  return COMMESSA_TESTI.NON_INIZIATA;
}

function getStatoSalClassName(
  stato: StatoSalLavorazione
) {
  if (stato === SAL_STATI.COMPLETATA) {
    return "bg-industrial-success-bg text-industrial-success-text";
  }

  if (stato === SAL_STATI.IN_CORSO) {
    return "bg-industrial-orange-soft text-industrial-orange-hover";
  }

  return "bg-industrial-bg-soft text-industrial-muted";
}

function getStatoRapportoClassName(
  stato: StatoRapportoIntervento
) {
  if (
    stato === RAPPORTI_INTERVENTO_STATI.FIRMATO
  ) {
    return "bg-industrial-success-bg text-industrial-success-text";
  }

  if (
    stato === RAPPORTI_INTERVENTO_STATI.BOZZA
  ) {
    return "bg-industrial-bg-soft text-industrial-muted";
  }

  return "bg-industrial-danger-bg text-industrial-danger-text";
}

function getTipoMacchinarioLabel(
  tipo: string
) {
  return (
    MACCHINARI_TESTI.CODA_TIPI[
      tipo as keyof typeof MACCHINARI_TESTI.CODA_TIPI
    ] || tipo
  );
}

function getNomeMacchinario(
  costo:
    | CostoMacchinarioCommessa
    | { macchinario_id: string | null; tipo_macchinario: string },
  macchinari: Map<string, MacchinarioPubblico>
) {
  if (!costo.macchinario_id) {
    return getTipoMacchinarioLabel(
      costo.tipo_macchinario
    );
  }

  const macchinario = macchinari.get(
    costo.macchinario_id
  );

  return macchinario
    ? macchinario.nome
    : getTipoMacchinarioLabel(
        costo.tipo_macchinario
      );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "orange";
}) {
  const accent =
    tone === "green"
      ? "bg-industrial-success-text"
      : tone === "orange"
        ? "bg-industrial-orange"
        : "bg-industrial-border";

  return (
    <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-4 shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
      <div className={`h-1.5 w-16 rounded-full ${accent}`} />
      <p className="mt-3 text-xs font-medium uppercase tracking-[0.22em] text-industrial-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-industrial-text">
        {value}
      </p>
    </section>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-4 shadow-[0_12px_28px_rgb(36_38_43/0.08)] sm:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-industrial-text sm:text-xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-industrial-muted">
            {subtitle}
          </p>
        )}
      </div>

      {children}
    </section>
  );
}

function ProgressBar({
  value,
}: {
  value: number;
}) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-industrial-border-soft">
      <div
        className="h-full rounded-full bg-industrial-orange transition-[width] duration-300"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export default function BackofficeCommessaPage() {
  const [cantieri, setCantieri] =
    useState<CantiereBackoffice[]>([]);
  const [cantiereId, setCantiereId] =
    useState("");
  const [dashboard, setDashboard] =
    useState<DashboardCommessaData | null>(null);
  const [canViewCosti, setCanViewCosti] =
    useState(false);
  const [loading, setLoading] =
    useState<StatoDashboard>({
      loadingCantieri: true,
      loadingDashboard: false,
    });
  const [errore, setErrore] = useState<
    string | null
  >(null);
  const [loadingPdf, setLoadingPdf] =
    useState(false);
  const [loadingExcel, setLoadingExcel] =
    useState(false);

  useEffect(() => {
    let attivo = true;

    const caricaRuolo = async () => {
      try {
        const user = await loadUtenteAuth();

        if (!attivo || !user?.email) {
          return;
        }

        const admin = await isAdmin(user.email);

        if (!attivo) {
          return;
        }

        if (admin) {
          setCanViewCosti(true);
          return;
        }

        const responsabile = await isResponsabile(
          user.email
        );

        if (!attivo) {
          return;
        }

        setCanViewCosti(responsabile);
      } catch {
        if (attivo) {
          setCanViewCosti(false);
        }
      }
    };

    void caricaRuolo();

    return () => {
      attivo = false;
    };
  }, []);

  useEffect(() => {
    let attivo = true;

    const caricaCantieri = async () => {
      try {
        const dati =
          await loadCantieriBackoffice();

        if (!attivo) {
          return;
        }

        setCantieri(dati);
        setCantiereId((corrente) => corrente || dati[0]?.id || "");
      } catch (error: unknown) {
        if (attivo) {
          setErrore(getMessaggioErrore(error));
        }
      } finally {
        if (attivo) {
          setLoading((corrente) => ({
            ...corrente,
            loadingCantieri: false,
          }));
        }
      }
    };

    void caricaCantieri();

    return () => {
      attivo = false;
    };
  }, []);

  useEffect(() => {
    let attivo = true;

    const caricaDashboard = async () => {
      if (!cantiereId) {
        setDashboard(null);
        return;
      }

      try {
        setLoading((corrente) => ({
          ...corrente,
          loadingDashboard: true,
        }));
        setErrore(null);

        const dati =
          await loadDashboardCommessa({
            cantiereId,
            includeCosti: canViewCosti,
          });

        if (!attivo) {
          return;
        }

        setDashboard(dati);
      } catch (error: unknown) {
        if (attivo) {
          setErrore(getMessaggioErrore(error));
        }
      } finally {
        if (attivo) {
          setLoading((corrente) => ({
            ...corrente,
            loadingDashboard: false,
          }));
        }
      }
    };

    void caricaDashboard();

    return () => {
      attivo = false;
    };
  }, [cantiereId, canViewCosti]);

  const cantiereSelezionato = useMemo(
    () =>
      cantieri.find(
        (cantiere) => cantiere.id === cantiereId
      ) || null,
    [cantieri, cantiereId]
  );

  const riepilogo = useMemo(() => {
    const lavorazioni = dashboard?.sal.lavorazioni || [];

    return {
      avanzamento: dashboard?.sal.avanzamentoTotale || 0,
      oreUomo: dashboard?.sal.oreUomoTotaliMinuti || 0,
      completate: lavorazioni.filter(
        (lavorazione) =>
          lavorazione.stato ===
          SAL_STATI.COMPLETATA
      ).length,
      inCorso: lavorazioni.filter(
        (lavorazione) =>
          lavorazione.stato === SAL_STATI.IN_CORSO
      ).length,
      foto: dashboard?.numeroFotoSal || 0,
      rapporti:
        dashboard?.numeroRapportiIntervento || 0,
      oreMacchinari:
        dashboard?.costiMacchinari.reduce(
          (somma, costo) =>
            somma + (costo.ore_utilizzo || 0),
          0
        ) || 0,
    };
  }, [dashboard]);

  const macchinariById = useMemo(
    () =>
      new Map(
        dashboard?.macchinariPubblici.map(
          (macchinario) => [
            macchinario.id,
            macchinario,
          ]
        ) || []
      ),
    [dashboard]
  );

  const handleExport = useCallback(
    async (route: string, filePrefix: string) => {
      if (!cantiereId) {
        return;
      }

      try {
        if (route.includes("pdf")) {
          setLoadingPdf(true);
        } else {
          setLoadingExcel(true);
        }

        setErrore(null);

        const { data, error } =
          await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        const accessToken =
          data.session?.access_token;

        if (!accessToken) {
          throw new Error(
            COMMESSA_TESTI.ERRORI.GENERICO
          );
        }

        const response = await fetch(
          `${route}?cantiereId=${encodeURIComponent(cantiereId)}`,
          {
            headers: {
              [API_HEADERS.AUTHORIZATION]:
                `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const payload = await response
            .json()
            .catch(() => null);

          throw new Error(
            typeof payload?.error === "string"
              ? payload.error
              : COMMESSA_TESTI.ERRORI.GENERICO
          );
        }

        const url = URL.createObjectURL(
          await response.blob()
        );
        const link = document.createElement("a");
        const fileCantiere = (
          cantiereSelezionato?.nome || cantiereId
        )
          .normalize("NFKD")
          .replace(/[\u0300-\u036f]/g, "")
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
        setErrore(getMessaggioErrore(error));
      } finally {
        setLoadingPdf(false);
        setLoadingExcel(false);
      }
    },
    [cantiereId, cantiereSelezionato]
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-industrial-text sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {COMMESSA_TESTI.TITOLO}
            </h1>
            <p className="mt-1 text-sm text-industrial-muted">
              {COMMESSA_TESTI.CARD_DESCRIZIONE}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm font-semibold">
            <Link
              href={APP_ROUTES.BACKOFFICE}
              className="rounded-xl border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {COMMESSA_TESTI.BACKOFFICE}
            </Link>
            <Link
              href={APP_ROUTES.HOME}
              className="rounded-xl border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {COMMESSA_TESTI.TIMBRATURE}
            </Link>
            <button
              type="button"
              onClick={() =>
                void handleExport(
                  API_ROUTES.REPORT_COMMESSA_PDF,
                  "commessa"
                )
              }
              disabled={!cantiereId || loadingPdf}
              className="rounded-xl border border-industrial-orange bg-industrial-orange px-3 py-2 text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover active:border-industrial-orange-active active:bg-industrial-orange-active disabled:border-industrial-border-soft disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
            >
              {loadingPdf
                ? COMMESSA_TESTI.CARICAMENTO
                : COMMESSA_TESTI.ESPORTA_PDF}
            </button>
            <button
              type="button"
              onClick={() =>
                void handleExport(
                  API_ROUTES.REPORT_COMMESSA_EXCEL,
                  "commessa"
                )
              }
              disabled={!cantiereId || loadingExcel}
              className="rounded-xl border border-industrial-orange bg-industrial-orange px-3 py-2 text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover active:border-industrial-orange-active active:bg-industrial-orange-active disabled:border-industrial-border-soft disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
            >
              {loadingExcel
                ? COMMESSA_TESTI.CARICAMENTO
                : COMMESSA_TESTI.ESPORTA_EXCEL}
            </button>
          </div>
        </div>

        {errore && (
          <p className="mb-4 rounded-xl bg-industrial-danger-bg p-4 text-sm text-industrial-danger-text">
            {errore}
          </p>
        )}

        <section className="mb-6 rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
          <div className="max-w-xl">
            <SelectCantiere
              cantieri={cantieri}
              cantiereId={cantiereId}
              onChange={(nextCantiereId) => {
                setCantiereId(nextCantiereId);
                setErrore(null);
              }}
              disabled={loading.loadingCantieri}
            />
          </div>
          {loading.loadingCantieri &&
            cantieri.length === 0 && (
              <p className="mt-3 text-sm text-industrial-muted">
                {COMMESSA_TESTI.CARICAMENTO}
              </p>
            )}
        </section>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          <StatCard
            label={COMMESSA_TESTI.AVANZAMENTO_PERCENTUALE}
            value={`${riepilogo.avanzamento}%`}
            tone="orange"
          />
          <StatCard
            label={COMMESSA_TESTI.ORE_UOMO_TOTALI}
            value={formattaOre(riepilogo.oreUomo)}
          />
          <StatCard
            label={COMMESSA_TESTI.LAVORAZIONI_COMPLETATE}
            value={String(riepilogo.completate)}
            tone="green"
          />
          <StatCard
            label={COMMESSA_TESTI.LAVORAZIONI_IN_CORSO}
            value={String(riepilogo.inCorso)}
            tone="orange"
          />
          <StatCard
            label={COMMESSA_TESTI.NUMERO_RAPPORTI}
            value={String(riepilogo.rapporti)}
          />
          <StatCard
            label={COMMESSA_TESTI.NUMERO_FOTO_SAL}
            value={String(riepilogo.foto)}
          />
          <StatCard
            label={COMMESSA_TESTI.ORE_MACCHINARI}
            value={formattaOreDecimali(
              riepilogo.oreMacchinari
            )}
            tone="orange"
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard
            title={COMMESSA_TESTI.STATO_AVANZAMENTO}
            subtitle={
              cantiereSelezionato
                ? cantiereSelezionato.nome
                : COMMESSA_TESTI.SELEZIONA_CANTIERE
            }
          >
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="text-industrial-muted">
                    {COMMESSA_TESTI.AVANZAMENTO_PERCENTUALE}
                  </span>
                  <span className="font-semibold text-industrial-text">
                    {riepilogo.avanzamento}%
                  </span>
                </div>
                <ProgressBar value={riepilogo.avanzamento} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-industrial-muted">
                    {COMMESSA_TESTI.ORE_UOMO_TOTALI}
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {formattaOre(riepilogo.oreUomo)}
                  </p>
                </div>
                <div className="rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.22em] text-industrial-muted">
                    {COMMESSA_TESTI.NUMERO_RAPPORTI}
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {riepilogo.rapporti}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title={COMMESSA_TESTI.LAVORAZIONI_PRINCIPALI}
            subtitle={COMMESSA_TESTI.STATO_AVANZAMENTO}
          >
            {dashboard?.sal.lavorazioni.length ? (
              <div className="space-y-3">
                {dashboard.sal.lavorazioni
                  .slice(0, 6)
                  .map((lavorazione) => (
                    <article
                      key={lavorazione.id}
                      className="rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-industrial-text">
                            {lavorazione.nome}
                          </h3>
                          <p className="mt-1 text-sm text-industrial-muted">
                            {SAL_TESTI.PERCENTUALE}: {lavorazione.percentuale_completamento}%
                          </p>
                          <p className="mt-1 text-sm text-industrial-muted">
                            {SAL_TESTI.ORE_UOMO}: {formattaOre(lavorazione.oreUomoMinuti)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatoSalClassName(
                            lavorazione.stato
                          )}`}
                        >
                          {getStatoSalLabel(
                            lavorazione.stato
                          )}
                        </span>
                      </div>
                      <div className="mt-3">
                        <ProgressBar
                          value={
                            lavorazione.percentuale_completamento
                          }
                        />
                      </div>
                    </article>
                  ))}
              </div>
            ) : (
              <p className="rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-4 text-sm text-industrial-muted">
                {COMMESSA_TESTI.NESSUNA_LAVORAZIONE}
              </p>
            )}
          </SectionCard>

          <SectionCard
            title={COMMESSA_TESTI.ORE_UOMO}
            subtitle={COMMESSA_TESTI.LAVORAZIONI_PRINCIPALI}
          >
            {dashboard?.sal.lavorazioni.length ? (
              <div className="space-y-3">
                {dashboard.sal.lavorazioni
                  .filter(
                    (lavorazione) =>
                      lavorazione.oreUomoMinuti > 0
                  )
                  .sort(
                    (a, b) =>
                      b.oreUomoMinuti -
                      a.oreUomoMinuti
                  )
                  .slice(0, 5)
                  .map((lavorazione) => (
                    <div
                      key={lavorazione.id}
                      className="flex items-start justify-between gap-3 rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-industrial-text">
                          {lavorazione.nome}
                        </p>
                        <p className="mt-1 text-sm text-industrial-muted">
                          {SAL_TESTI.PERCENTUALE}: {lavorazione.percentuale_completamento}%
                        </p>
                      </div>
                      <p className="shrink-0 font-semibold text-industrial-text">
                        {formattaOre(lavorazione.oreUomoMinuti)}
                      </p>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-4 text-sm text-industrial-muted">
                {COMMESSA_TESTI.NESSUN_DATO}
              </p>
            )}
          </SectionCard>

          <SectionCard
            title={COMMESSA_TESTI.MACCHINARI_UTILIZZATI}
            subtitle={
              canViewCosti
                ? MACCHINARI_TESTI.COSTO_ORARIO_VISIBILE
                : COMMESSA_TESTI.IMPORTO_NON_VISIBILE
            }
          >
            {dashboard?.costiMacchinari.length ? (
              <div className="space-y-3">
                {dashboard.costiMacchinari.map((costo) => (
                  <article
                    key={costo.id}
                    className="rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-industrial-text">
                          {getNomeMacchinario(
                            costo,
                            macchinariById
                          )}
                        </h3>
                        <p className="mt-1 text-sm text-industrial-muted">
                          {getTipoMacchinarioLabel(
                            costo.tipo_macchinario
                          )}
                        </p>
                        <p className="mt-1 text-sm text-industrial-muted">
                          {formattaData(costo.data_utilizzo)}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-industrial-text">
                          {formattaOre(
                            Math.round(
                              costo.ore_utilizzo * 60
                            )
                          )}
                        </p>
                        {canViewCosti &&
                          "costo_totale" in costo && (
                            <p className="mt-1 text-sm font-semibold text-industrial-orange">
                              {formattaEuro(
                                costo.costo_totale
                              )}
                            </p>
                          )}
                      </div>
                    </div>

                    {costo.note && (
                      <p className="mt-3 text-sm text-industrial-muted">
                        {costo.note}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-4 text-sm text-industrial-muted">
                {COMMESSA_TESTI.NESSUN_DATO}
              </p>
            )}
          </SectionCard>

          <SectionCard
            title={COMMESSA_TESTI.FOTO_RECENTI}
            subtitle={COMMESSA_TESTI.NUMERO_FOTO_SAL}
          >
            {dashboard?.fotoRecenti.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {dashboard.fotoRecenti.map((foto) => (
                  <article
                    key={foto.id}
                    className="rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-3"
                  >
                    <Image
                      src={foto.immagine_data_url}
                      alt={foto.descrizione || COMMESSA_TESTI.FOTO_RECENTI}
                      width={640}
                      height={480}
                      unoptimized
                      className="aspect-[4/3] w-full rounded-xl border border-industrial-border object-cover"
                    />

                    <div className="mt-3">
                      <p className="text-sm font-semibold text-industrial-text">
                        {foto.descrizione ||
                          COMMESSA_TESTI.FOTO_RECENTI}
                      </p>
                      <p className="mt-1 text-xs text-industrial-muted">
                        {formattaData(foto.data_riferimento)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-4 text-sm text-industrial-muted">
                {COMMESSA_TESTI.NESSUNA_FOTO}
              </p>
            )}
          </SectionCard>

          <SectionCard
            title={COMMESSA_TESTI.RAPPORTI_RECENTI}
            subtitle={COMMESSA_TESTI.NUMERO_RAPPORTI}
          >
            {dashboard?.rapportiRecenti.length ? (
              <div className="space-y-3">
                {dashboard.rapportiRecenti.map(
                  (rapporto) => (
                    <article
                      key={rapporto.id}
                      className="rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-semibold text-industrial-text">
                            {rapporto.cliente_committente}
                          </h3>
                          <p className="mt-1 text-sm text-industrial-muted">
                            {formattaData(rapporto.data_intervento)}
                          </p>
                          <p className="mt-1 text-sm text-industrial-muted">
                            {rapporto.responsabile_nome}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatoRapportoClassName(
                            rapporto.stato
                          )}`}
                        >
                          {LABEL_STATI_RAPPORTO_INTERVENTO[
                            rapporto.stato
                          ]}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-industrial-muted">
                        <span>
                          {RAPPORTI_INTERVENTO_TESTI.ORE_UOMO_REALI}
                        </span>
                        <span className="text-right font-semibold text-industrial-text">
                          {formattaOre(
                            rapporto.ore_uomo_reali_minuti
                          )}
                        </span>
                      </div>
                    </article>
                  )
                )}
              </div>
            ) : (
              <p className="rounded-xl border border-industrial-border-soft bg-industrial-bg-soft p-4 text-sm text-industrial-muted">
                {COMMESSA_TESTI.NESSUN_RAPPORTO}
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
