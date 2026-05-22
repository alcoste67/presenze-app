"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import {
  useEffect,
  useState,
} from "react";

import {
  REPORT_PRESENZE_COLONNE,
  REPORT_PRESENZE_CSV,
  REPORT_PRESENZE_LIMITI,
  REPORT_PRESENZE_TESTI,
} from "@/constants/reportPresenze";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadDipendenti } from "@/services/dipendenti/loadDipendenti";
import { fetchPresenzeReport } from "@/services/report/fetchPresenzeReport";
import type { CantiereBackoffice } from "@/types/cantieri";
import type { Dipendente } from "@/types/dipendenti";
import type {
  PresenzeReportFiltri,
  PresenzeReportRiga,
  PresenzeReportRisposta,
} from "@/types/reportPresenze";

function getDataOggiInput() {
  const oggi = new Date();
  const year = oggi.getFullYear();
  const month = String(
    oggi.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    oggi.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMessaggioErrore(
  error: unknown
) {
  return error instanceof Error
    ? error.message
    : REPORT_PRESENZE_TESTI.ERRORI.GENERICO;
}

function formattaDipendenteOption(
  dipendente: Dipendente
) {
  return `${dipendente.cognome} ${dipendente.nome}`;
}

function getValoreCsvProtetto(
  value: string
) {
  const valore = value.trimStart();

  if (
    valore.startsWith("=") ||
    valore.startsWith("+") ||
    valore.startsWith("-") ||
    valore.startsWith("@")
  ) {
    return `${REPORT_PRESENZE_CSV.INJECTION_PREFIX}${value}`;
  }

  return value;
}

function formattaCampoCsv(value: string) {
  const valoreProtetto =
    getValoreCsvProtetto(value);

  return `"${valoreProtetto.replaceAll(
    '"',
    '""'
  )}"`;
}

function getRigaCsv(
  valori: readonly string[]
) {
  return valori
    .map(formattaCampoCsv)
    .join(REPORT_PRESENZE_CSV.SEPARATORE);
}

function getValoriRigaCsv(
  riga: PresenzeReportRiga
) {
  return [
    riga.data,
    riga.ora,
    riga.dipendente,
    riga.email,
    riga.tipoLabel,
    riga.destinazione,
    riga.cantiere,
    riga.attivita,
  ] as const;
}

function creaCsv(
  righe: PresenzeReportRiga[]
) {
  const contenuto = [
    getRigaCsv(REPORT_PRESENZE_COLONNE),
    ...righe.map((riga) =>
      getRigaCsv(getValoriRigaCsv(riga))
    ),
  ].join("\r\n");

  return `${REPORT_PRESENZE_CSV.BOM}${contenuto}`;
}

function scaricaCsv({
  righe,
  dataInizio,
  dataFine,
}: {
  righe: PresenzeReportRiga[];
  dataInizio: string;
  dataFine: string;
}) {
  const csv = creaCsv(righe);
  const blob = new Blob([csv], {
    type: REPORT_PRESENZE_CSV.MIME_TYPE,
  });
  const url = URL.createObjectURL(blob);
  const link =
    document.createElement("a");

  link.href = url;
  link.download = `${REPORT_PRESENZE_CSV.NOME_FILE_PREFIX}_${dataInizio}_${dataFine}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

function validaFiltri(
  filtri: PresenzeReportFiltri
) {
  if (!filtri.dataInizio || !filtri.dataFine) {
    return REPORT_PRESENZE_TESTI.ERRORI
      .DATE_OBBLIGATORIE;
  }

  if (filtri.dataFine < filtri.dataInizio) {
    return REPORT_PRESENZE_TESTI.ERRORI
      .INTERVALLO_NON_VALIDO;
  }

  return null;
}

export default function BackofficePresenzePage() {
  const [dipendenti, setDipendenti] =
    useState<Dipendente[]>([]);
  const [cantieri, setCantieri] = useState<
    CantiereBackoffice[]
  >([]);
  const [filtri, setFiltri] =
    useState<PresenzeReportFiltri>({
      dipendenteId: null,
      cantiereId: null,
      dataInizio: getDataOggiInput(),
      dataFine: getDataOggiInput(),
    });
  const [report, setReport] =
    useState<PresenzeReportRisposta | null>(
      null
    );
  const [loadingOpzioni, setLoadingOpzioni] =
    useState(true);
  const [loadingReport, setLoadingReport] =
    useState(false);
  const [errore, setErrore] = useState<
    string | null
  >(null);

  useEffect(() => {
    let attivo = true;

    const caricaOpzioni = async () => {
      try {
        const [
          dipendentiData,
          cantieriData,
        ] = await Promise.all([
          loadDipendenti(),
          loadCantieriBackoffice(),
        ]);

        if (!attivo) {
          return;
        }

        setDipendenti(dipendentiData);
        setCantieri(cantieriData);
      } catch (error: unknown) {
        if (!attivo) {
          return;
        }

        setErrore(
          getMessaggioErrore(error)
        );
      } finally {
        if (attivo) {
          setLoadingOpzioni(false);
        }
      }
    };

    void caricaOpzioni();

    return () => {
      attivo = false;
    };
  }, []);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const erroreFiltri =
      validaFiltri(filtri);

    if (erroreFiltri) {
      setErrore(erroreFiltri);

      return;
    }

    try {
      setLoadingReport(true);
      setErrore(null);

      const reportData =
        await fetchPresenzeReport(filtri);

      setReport(reportData);
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setLoadingReport(false);
    }
  };

  const handleCsv = () => {
    if (!report || report.righe.length === 0) {
      return;
    }

    scaricaCsv({
      righe: report.righe,
      dataInizio: filtri.dataInizio,
      dataFine: filtri.dataFine,
    });
  };

  const handleStampa = () => {
    window.print();
  };

  const loading =
    loadingOpzioni || loadingReport;

  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text print:bg-industrial-surface print:p-0">
      <div className="mx-auto max-w-6xl print:max-w-none">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-bold">
              {REPORT_PRESENZE_TESTI.TITOLO}
            </h1>
            <p className="mt-1 text-sm text-industrial-muted">
              {
                REPORT_PRESENZE_TESTI.SOTTOTITOLO
              }
            </p>
          </div>

          <div className="flex gap-4 text-sm font-semibold">
            <Link
              href="/backoffice"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {
                REPORT_PRESENZE_TESTI.BACKOFFICE
              }
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {
                REPORT_PRESENZE_TESTI.TIMBRATURE
              }
            </Link>
          </div>
        </div>

        <section className="mb-6 rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 shadow-[0_12px_28px_rgb(36_38_43/0.08)] print:hidden">
          <h2 className="mb-4 text-xl font-semibold">
            {REPORT_PRESENZE_TESTI.FILTRI}
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-industrial-muted">
                {
                  REPORT_PRESENZE_TESTI.DATA_INIZIO
                }
              </span>
              <input
                type="date"
                value={filtri.dataInizio}
                onChange={(event) =>
                  setFiltri(
                    (filtriCorrenti) => ({
                      ...filtriCorrenti,
                      dataInizio:
                        event.target.value,
                    })
                  )
                }
                className="rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-industrial-muted">
                {
                  REPORT_PRESENZE_TESTI.DATA_FINE
                }
              </span>
              <input
                type="date"
                value={filtri.dataFine}
                onChange={(event) =>
                  setFiltri(
                    (filtriCorrenti) => ({
                      ...filtriCorrenti,
                      dataFine:
                        event.target.value,
                    })
                  )
                }
                className="rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-industrial-muted">
                {
                  REPORT_PRESENZE_TESTI.DIPENDENTE
                }
              </span>
              <select
                value={filtri.dipendenteId || ""}
                onChange={(event) =>
                  setFiltri(
                    (filtriCorrenti) => ({
                      ...filtriCorrenti,
                      dipendenteId:
                        event.target.value ||
                        null,
                    })
                  )
                }
                disabled={loadingOpzioni}
                className="rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
              >
                <option value="">
                  {
                    REPORT_PRESENZE_TESTI
                      .TUTTI_DIPENDENTI
                  }
                </option>
                {dipendenti.map(
                  (dipendente) => (
                    <option
                      key={dipendente.id}
                      value={dipendente.id}
                    >
                      {formattaDipendenteOption(
                        dipendente
                      )}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-industrial-muted">
                {REPORT_PRESENZE_TESTI.CANTIERE}
              </span>
              <select
                value={filtri.cantiereId || ""}
                onChange={(event) =>
                  setFiltri(
                    (filtriCorrenti) => ({
                      ...filtriCorrenti,
                      cantiereId:
                        event.target.value ||
                        null,
                    })
                  )
                }
                disabled={loadingOpzioni}
                className="rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
              >
                <option value="">
                  {
                    REPORT_PRESENZE_TESTI
                      .TUTTI_CANTIERI
                  }
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

            <div className="flex flex-wrap items-end gap-3 md:col-span-2 lg:col-span-4">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg border border-industrial-orange bg-industrial-orange px-5 py-3 font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover active:border-industrial-orange-active active:bg-industrial-orange-active disabled:cursor-not-allowed disabled:bg-industrial-border disabled:text-industrial-muted"
              >
                {loadingReport
                  ? REPORT_PRESENZE_TESTI.CARICAMENTO
                  : REPORT_PRESENZE_TESTI.CERCA}
              </button>

              <button
                type="button"
                onClick={handleCsv}
                disabled={
                  loading ||
                  !report ||
                  report.righe.length === 0
                }
                className="rounded-lg border border-industrial-border bg-industrial-control px-5 py-3 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:cursor-not-allowed disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
              >
                {REPORT_PRESENZE_TESTI.ESPORTA_CSV}
              </button>

              <button
                type="button"
                onClick={handleStampa}
                disabled={
                  loading ||
                  !report ||
                  report.righe.length === 0
                }
                className="rounded-lg border border-industrial-border bg-industrial-control px-5 py-3 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:cursor-not-allowed disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
              >
                {REPORT_PRESENZE_TESTI.STAMPA_PDF}
              </button>
            </div>
          </form>

          <p className="mt-4 text-sm text-industrial-muted">
            {
              REPORT_PRESENZE_TESTI
                .LIMITE_EXPORT_PREFIX
            }{" "}
            {REPORT_PRESENZE_LIMITI.MAX_GIORNI}{" "}
            {
              REPORT_PRESENZE_TESTI
                .LIMITE_EXPORT_GIORNI_E
            }{" "}
            {REPORT_PRESENZE_LIMITI.MAX_RIGHE}{" "}
            {
              REPORT_PRESENZE_TESTI
                .LIMITE_EXPORT_RIGHE_SUFFIX
            }
          </p>
        </section>

        {errore && (
          <p className="mb-4 rounded-lg bg-industrial-danger-bg p-4 text-sm text-industrial-danger-text print:hidden">
            {errore}
          </p>
        )}

        <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 shadow-[0_12px_28px_rgb(36_38_43/0.08)] print:border-0 print:p-0 print:shadow-none">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {REPORT_PRESENZE_TESTI.ANTEPRIMA}
              </h2>
              {report && (
                <p className="mt-1 text-sm text-industrial-muted">
                  {report.righe.length}{" "}
                  {REPORT_PRESENZE_TESTI.RIGHE}
                </p>
              )}
            </div>
          </div>

          {!report && !loadingReport && (
            <p className="text-industrial-muted">
              {
                REPORT_PRESENZE_TESTI
                  .NESSUNA_RICERCA
              }
            </p>
          )}

          {loadingReport && (
            <p className="text-industrial-muted">
              {REPORT_PRESENZE_TESTI.CARICAMENTO}
            </p>
          )}

          {report &&
            report.righe.length === 0 &&
            !loadingReport && (
              <p className="text-industrial-muted">
                {
                  REPORT_PRESENZE_TESTI
                    .NESSUN_RISULTATO
                }
              </p>
            )}

          {report?.limiteRaggiunto && (
            <p className="mb-4 rounded-lg bg-industrial-warning-bg p-3 text-sm text-industrial-warning-text print:hidden">
              {
                REPORT_PRESENZE_TESTI
                  .LIMITE_RAGGIUNTO
              }{" "}
              ({report.limiteRighe}).
            </p>
          )}

          {report &&
            report.righe.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-industrial-border-soft">
                      {REPORT_PRESENZE_COLONNE.map(
                        (colonna) => (
                          <th
                            key={colonna}
                            className="whitespace-nowrap px-3 py-2 font-semibold text-industrial-muted"
                          >
                            {colonna}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {report.righe.map((riga) => (
                      <tr
                        key={riga.id}
                        className="border-b border-industrial-border-soft"
                      >
                        <td className="whitespace-nowrap px-3 py-2">
                          {riga.data}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {riga.ora}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {riga.dipendente}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {riga.email}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {riga.tipoLabel}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {riga.destinazione}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {riga.cantiere}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {riga.attivita}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </section>
      </div>
    </main>
  );
}
