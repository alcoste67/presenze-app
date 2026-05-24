"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import { API_HEADERS } from "@/constants/api";
import { REPORT_PRESENZE_TESTI } from "@/constants/reportPresenze";
import {
  SAL_STATI,
  SAL_TESTI,
} from "@/constants/sal";
import { supabase } from "@/lib/supabase";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadSalCantiere } from "@/services/lavorazioni/loadSalCantiere";
import type { CantiereBackoffice } from "@/types/cantieri";
import type {
  SalCantiere,
  SalLavorazione,
  StatoSalLavorazione,
} from "@/types/sal";

function getMessaggioErrore(error: unknown) {
  return error instanceof Error
    ? error.message
    : SAL_TESTI.ERRORI.GENERICO;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function leggiMessaggioErrorePdf(
  response: Response
) {
  try {
    const payload = await response.json();

    if (
      isRecord(payload) &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  } catch {
    return SAL_TESTI.ERRORI.GENERICO;
  }

  return SAL_TESTI.ERRORI.GENERICO;
}

function getNomeFilePdf(response: Response) {
  const contentDisposition =
    response.headers.get("Content-Disposition") ||
    "";
  const match = /filename="([^"]+)"/.exec(
    contentDisposition
  );

  return match?.[1] || "SAL.pdf";
}

function scaricaBlobPdf({
  blob,
  nomeFile,
}: {
  blob: Blob;
  nomeFile: string;
}) {
  const url = URL.createObjectURL(blob);
  const link =
    document.createElement("a");

  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getStatoLabel(
  stato: StatoSalLavorazione
) {
  if (stato === SAL_STATI.NON_INIZIATA) {
    return SAL_TESTI.STATI.NON_INIZIATA;
  }

  if (stato === SAL_STATI.COMPLETATA) {
    return SAL_TESTI.STATI.COMPLETATA;
  }

  return SAL_TESTI.STATI.IN_CORSO;
}

function getStatoClassName(
  stato: StatoSalLavorazione
) {
  if (stato === SAL_STATI.NON_INIZIATA) {
    return "bg-industrial-bg-soft text-industrial-muted";
  }

  if (stato === SAL_STATI.COMPLETATA) {
    return "bg-industrial-success-bg text-industrial-success-text";
  }

  return "bg-industrial-orange-soft text-industrial-orange-hover";
}

function formattaOreUomo(minutiTotali: number) {
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;

  return `${ore}${SAL_TESTI.UNITA_ORA} ${minuti}${SAL_TESTI.UNITA_MINUTO}`;
}

function BarraProgresso({
  percentuale,
}: {
  percentuale: number;
}) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-industrial-border-soft">
      <div
        className="h-full rounded-full bg-industrial-orange"
        style={{
          width: `${percentuale}%`,
        }}
      />
    </div>
  );
}

function RigaLavorazione({
  lavorazione,
}: {
  lavorazione: SalLavorazione;
}) {
  return (
    <li className="rounded-lg border border-industrial-border-soft bg-industrial-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-industrial-text">
            {lavorazione.nome}
          </h3>
          <p className="mt-1 text-sm text-industrial-muted">
            {SAL_TESTI.PERCENTUALE}:{" "}
            {
              lavorazione.percentuale_completamento
            }
            %
          </p>
          <p className="mt-1 text-sm text-industrial-muted">
            {SAL_TESTI.ORE_UOMO}:{" "}
            {formattaOreUomo(
              lavorazione.oreUomoMinuti
            )}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatoClassName(
            lavorazione.stato
          )}`}
        >
          {getStatoLabel(lavorazione.stato)}
        </span>
      </div>

      <div className="mt-4">
        <BarraProgresso
          percentuale={
            lavorazione.percentuale_completamento
          }
        />
      </div>
    </li>
  );
}

export default function BackofficeSalPage() {
  const [cantieri, setCantieri] = useState<
    CantiereBackoffice[]
  >([]);
  const [cantiereId, setCantiereId] =
    useState("");
  const [sal, setSal] =
    useState<SalCantiere | null>(null);
  const [loadingCantieri, setLoadingCantieri] =
    useState(true);
  const [loadingSal, setLoadingSal] =
    useState(false);
  const [loadingPdf, setLoadingPdf] =
    useState(false);
  const [errore, setErrore] = useState<
    string | null
  >(null);

  const caricaSal = async (
    nextCantiereId: string
  ) => {
    if (!nextCantiereId) {
      setSal(null);
      return;
    }

    try {
      setLoadingSal(true);
      setErrore(null);

      const dati = await loadSalCantiere(
        nextCantiereId
      );

      setSal(dati);
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setLoadingSal(false);
    }
  };

  useEffect(() => {
    let attivo = true;

    const caricaCantieri = async () => {
      try {
        const dati =
          await loadCantieriBackoffice();

        if (!attivo) {
          return;
        }

        const primoCantiereId =
          dati[0]?.id || "";

        setCantieri(dati);
        setCantiereId(primoCantiereId);

        if (primoCantiereId) {
          await caricaSal(primoCantiereId);
        }
      } catch (error: unknown) {
        if (attivo) {
          setErrore(
            getMessaggioErrore(error)
          );
        }
      } finally {
        if (attivo) {
          setLoadingCantieri(false);
        }
      }
    };

    void caricaCantieri();

    return () => {
      attivo = false;
    };
  }, []);

  const handleCantiereChange = (
    nextCantiereId: string
  ) => {
    setCantiereId(nextCantiereId);
    setErrore(null);
    if (!nextCantiereId) {
      setSal(null);
    }
    void caricaSal(nextCantiereId);
  };

  const handleEsportaPdf = async () => {
    if (!cantiereId) {
      return;
    }

    try {
      setLoadingPdf(true);
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
          REPORT_PRESENZE_TESTI.ERRORI
            .SESSIONE_MANCANTE
        );
      }

      const response = await fetch(
        `/api/report/sal-pdf?cantiereId=${encodeURIComponent(cantiereId)}`,
        {
          headers: {
            [API_HEADERS.AUTHORIZATION]:
              `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          await leggiMessaggioErrorePdf(response)
        );
      }

      scaricaBlobPdf({
        blob: await response.blob(),
        nomeFile: getNomeFilePdf(response),
      });
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setLoadingPdf(false);
    }
  };

  const loading = loadingCantieri || loadingSal;

  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {SAL_TESTI.TITOLO}
            </h1>
          </div>

          <div className="flex gap-4 text-sm font-semibold">
            {cantiereId ? (
              <button
                type="button"
                onClick={handleEsportaPdf}
                disabled={loadingPdf}
                className="rounded-lg border border-industrial-orange bg-industrial-orange px-3 py-2 text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover active:border-industrial-orange-active active:bg-industrial-orange-active"
              >
                {loadingPdf
                  ? SAL_TESTI.CARICAMENTO
                  : SAL_TESTI.ESPORTA_PDF}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-lg border border-industrial-border-soft bg-industrial-surface-strong px-3 py-2 text-industrial-muted-strong"
              >
                {SAL_TESTI.ESPORTA_PDF}
              </button>
            )}
            <Link
              href="/backoffice"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {SAL_TESTI.BACKOFFICE}
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {SAL_TESTI.TIMBRATURE}
            </Link>
          </div>
        </div>

        {errore && (
          <p className="mb-4 rounded-lg bg-industrial-danger-bg p-4 text-sm text-industrial-danger-text">
            {errore}
          </p>
        )}

        <section className="mb-6 rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
          <label className="block max-w-xl">
            <span className="mb-1 block text-sm font-medium text-industrial-muted">
              {SAL_TESTI.CANTIERE}
            </span>
            <select
              value={cantiereId}
              onChange={(event) =>
                handleCantiereChange(
                  event.target.value
                )
              }
              disabled={loadingCantieri}
              className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
            >
              <option value="">
                {SAL_TESTI.SELEZIONA_CANTIERE}
              </option>
              {cantieri.map((cantiere) => (
                <option
                  key={cantiere.id}
                  value={cantiere.id}
                >
                  {cantiere.nome}
                </option>
              ))}
            </select>
          </label>
        </section>

        {loading && (
          <p className="text-industrial-muted">
            {SAL_TESTI.CARICAMENTO}
          </p>
        )}

        {!loadingCantieri &&
          cantieri.length === 0 && (
            <p className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-muted shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
              {SAL_TESTI.NESSUN_CANTIERE}
            </p>
          )}

        {!loading && sal && (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
              <p className="text-sm font-medium text-industrial-muted">
                {
                  SAL_TESTI.AVANZAMENTO_TOTALE
                }
              </p>
              <p className="mt-3 text-4xl font-bold">
                {sal.avanzamentoTotale}%
              </p>
              <p className="mt-3 text-sm font-medium text-industrial-muted">
                {SAL_TESTI.ORE_UOMO_TOTALI}:{" "}
                {formattaOreUomo(
                  sal.oreUomoTotaliMinuti
                )}
              </p>
              <div className="mt-4">
                <BarraProgresso
                  percentuale={
                    sal.avanzamentoTotale
                  }
                />
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold">
                {SAL_TESTI.LAVORAZIONI_ATTIVE}
              </h2>

              {sal.lavorazioni.length === 0 ? (
                <p className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-muted shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
                  {
                    SAL_TESTI.NESSUNA_LAVORAZIONE
                  }
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {sal.lavorazioni.map(
                    (lavorazione) => (
                      <RigaLavorazione
                        key={lavorazione.id}
                        lavorazione={lavorazione}
                      />
                    )
                  )}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
