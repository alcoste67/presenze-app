"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { AlertTriangle, Download, Home, Printer } from "lucide-react";

import {
  REPORT_LIBRO_PRESENZE_COLONNE,
  REPORT_LIBRO_PRESENZE_CSV,
  REPORT_LIBRO_PRESENZE_LIMITI,
  REPORT_LIBRO_PRESENZE_TESTI,
} from "@/constants/reportLibroPresenze";
import { APP_ROUTES } from "@/constants/routes";
import { getMessaggioErrore } from "@/lib/errors";

import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadDipendenti } from "@/services/dipendenti/loadDipendenti";
import { fetchLibroPresenzeReport } from "@/services/report/fetchLibroPresenzeReport";

import type { CantiereBackoffice } from "@/types/cantieri";
import type { Dipendente } from "@/types/dipendenti";
import type {
  LibroPresenzeReportFiltri,
  LibroPresenzeReportRiga,
  LibroPresenzeReportRisposta,
} from "@/types/reportLibroPresenze";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDataOggiInput() {
  const oggi = new Date();
  const year = oggi.getFullYear();
  const month = String(oggi.getMonth() + 1).padStart(2, "0");
  const day = String(oggi.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}


function formattaDipendenteOption(dipendente: Dipendente) {
  return `${dipendente.cognome} ${dipendente.nome}`;
}

function getValoreCsvProtetto(value: string) {
  const valore = value.trimStart();
  if (
    valore.startsWith("=") ||
    valore.startsWith("+") ||
    valore.startsWith("-") ||
    valore.startsWith("@")
  ) {
    return `${REPORT_LIBRO_PRESENZE_CSV.INJECTION_PREFIX}${value}`;
  }
  return value;
}

function formattaCampoCsv(value: string) {
  const valoreProtetto = getValoreCsvProtetto(value);
  return `"${valoreProtetto.replaceAll('"', '""')}"`;
}

function getRigaCsv(valori: readonly string[]) {
  return valori.map(formattaCampoCsv).join(REPORT_LIBRO_PRESENZE_CSV.SEPARATORE);
}

function getValoriRigaCsv(riga: LibroPresenzeReportRiga) {
  return [riga.data, riga.dipendente, riga.orePaghe, riga.cantiereAttivita, riga.note] as const;
}

function creaCsv(righe: LibroPresenzeReportRiga[]) {
  const contenuto = [
    getRigaCsv(REPORT_LIBRO_PRESENZE_COLONNE),
    ...righe.map((riga) => getRigaCsv(getValoriRigaCsv(riga))),
  ].join("\r\n");
  return `${REPORT_LIBRO_PRESENZE_CSV.BOM}${contenuto}`;
}

function scaricaCsv({
  righe,
  dataInizio,
  dataFine,
}: {
  righe: LibroPresenzeReportRiga[];
  dataInizio: string;
  dataFine: string;
}) {
  const csv = creaCsv(righe);
  const blob = new Blob([csv], { type: REPORT_LIBRO_PRESENZE_CSV.MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${REPORT_LIBRO_PRESENZE_CSV.NOME_FILE_PREFIX}_${dataInizio}_${dataFine}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function validaFiltri(filtri: LibroPresenzeReportFiltri) {
  if (!filtri.dataInizio || !filtri.dataFine) {
    return REPORT_LIBRO_PRESENZE_TESTI.ERRORI.DATE_OBBLIGATORIE;
  }
  if (filtri.dataFine < filtri.dataInizio) {
    return REPORT_LIBRO_PRESENZE_TESTI.ERRORI.INTERVALLO_NON_VALIDO;
  }
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeLibroPresenzePage() {
  const toast = useToast();

  const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
  const [cantieri, setCantieri] = useState<CantiereBackoffice[]>([]);
  const [filtri, setFiltri] = useState<LibroPresenzeReportFiltri>({
    dipendenteId: null,
    cantiereId: null,
    dataInizio: getDataOggiInput(),
    dataFine: getDataOggiInput(),
  });
  const [report, setReport] = useState<LibroPresenzeReportRisposta | null>(null);
  const [loadingOpzioni, setLoadingOpzioni] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    let attivo = true;
    const init = async () => {
      try {
        const [dipendentiData, cantieriData] = await Promise.all([
          loadDipendenti(),
          loadCantieriBackoffice(),
        ]);
        if (!attivo) return;
        setDipendenti(dipendentiData);
        setCantieri(cantieriData);
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, REPORT_LIBRO_PRESENZE_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoadingOpzioni(false);
      }
    };
    void init();
    return () => { attivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const erroreFiltri = validaFiltri(filtri);
    if (erroreFiltri) {
      toast.error(erroreFiltri);
      return;
    }
    try {
      setLoadingReport(true);
      const reportData = await fetchLibroPresenzeReport(filtri);
      setReport(reportData);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, REPORT_LIBRO_PRESENZE_TESTI.ERRORI.GENERICO));
    } finally {
      setLoadingReport(false);
    }
  };

  const handleCsv = () => {
    if (!report || report.righe.length === 0) return;
    scaricaCsv({ righe: report.righe, dataInizio: filtri.dataInizio, dataFine: filtri.dataFine });
  };

  const handleStampa = () => {
    window.print();
  };

  const loading = loadingOpzioni || loadingReport;
  const hasRisultati = Boolean(report && report.righe.length > 0);

  return (
    <div className="min-h-dvh bg-bg-base print:bg-white">
      <AppHeader
        className="print:hidden"
        actions={
          <>
            <Link href={APP_ROUTES.BACKOFFICE}>
              <Button variant="secondary" size="sm">
                {REPORT_LIBRO_PRESENZE_TESTI.BACKOFFICE}
              </Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">
                {REPORT_LIBRO_PRESENZE_TESTI.TIMBRATURE}
              </Button>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-[1000px] px-6 py-6 print:max-w-none print:px-0 print:py-0">
        {/* Breadcrumb + titolo */}
        <div className="print:hidden">
          <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
              <Home className="h-4 w-4" />
            </Link>
            <span>/</span>
            <Link href={APP_ROUTES.BACKOFFICE} className="hover:text-text-primary transition-colors duration-150">
              {REPORT_LIBRO_PRESENZE_TESTI.BACKOFFICE}
            </Link>
            <span>/</span>
            <span className="font-medium text-text-primary">{REPORT_LIBRO_PRESENZE_TESTI.TITOLO}</span>
          </nav>
          <h1 className="font-heading text-2xl font-medium text-text-primary">
            {REPORT_LIBRO_PRESENZE_TESTI.TITOLO}
          </h1>
          <p className="mt-1 text-sm text-text-muted">{REPORT_LIBRO_PRESENZE_TESTI.SOTTOTITOLO}</p>
        </div>

        {/* Filtri */}
        <Card className="mt-6 p-5 print:hidden">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label={REPORT_LIBRO_PRESENZE_TESTI.DATA_INIZIO}
                type="date"
                value={filtri.dataInizio}
                onChange={(e) => setFiltri((f) => ({ ...f, dataInizio: e.target.value }))}
              />
              <Input
                label={REPORT_LIBRO_PRESENZE_TESTI.DATA_FINE}
                type="date"
                value={filtri.dataFine}
                onChange={(e) => setFiltri((f) => ({ ...f, dataFine: e.target.value }))}
              />
              <Select
                label={REPORT_LIBRO_PRESENZE_TESTI.DIPENDENTE}
                value={filtri.dipendenteId || ""}
                onChange={(e) => setFiltri((f) => ({ ...f, dipendenteId: e.target.value || null }))}
                disabled={loadingOpzioni}
              >
                <option value="">{REPORT_LIBRO_PRESENZE_TESTI.TUTTI_DIPENDENTI}</option>
                {dipendenti.map((d) => (
                  <option key={d.id} value={d.id}>{formattaDipendenteOption(d)}</option>
                ))}
              </Select>
              <Select
                label={REPORT_LIBRO_PRESENZE_TESTI.CANTIERE}
                value={filtri.cantiereId || ""}
                onChange={(e) => setFiltri((f) => ({ ...f, cantiereId: e.target.value || null }))}
                disabled={loadingOpzioni}
              >
                <option value="">{REPORT_LIBRO_PRESENZE_TESTI.TUTTI_CANTIERI}</option>
                {cantieri.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </Select>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-text-muted">
                {REPORT_LIBRO_PRESENZE_TESTI.LIMITE_EXPORT_PREFIX}{" "}
                {REPORT_LIBRO_PRESENZE_LIMITI.MAX_GIORNI}{" "}
                {REPORT_LIBRO_PRESENZE_TESTI.LIMITE_EXPORT_GIORNI_E}{" "}
                {REPORT_LIBRO_PRESENZE_LIMITI.MAX_RIGHE}{" "}
                {REPORT_LIBRO_PRESENZE_TESTI.LIMITE_EXPORT_RIGHE_SUFFIX}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" loading={loadingReport} disabled={loading}>
                  {REPORT_LIBRO_PRESENZE_TESTI.CERCA}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Download className="h-4 w-4" />}
                  onClick={handleCsv}
                  disabled={!hasRisultati}
                >
                  {REPORT_LIBRO_PRESENZE_TESTI.ESPORTA_CSV}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  icon={<Printer className="h-4 w-4" />}
                  onClick={handleStampa}
                  disabled={!hasRisultati}
                >
                  {REPORT_LIBRO_PRESENZE_TESTI.STAMPA_PDF}
                </Button>
              </div>
            </div>
          </form>
        </Card>

        {/* Banner limite raggiunto */}
        {report?.limiteRaggiunto && (
          <div className="mt-4 flex items-start gap-3 rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-500 print:hidden">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <p>{REPORT_LIBRO_PRESENZE_TESTI.LIMITE_RAGGIUNTO} ({report.limiteRighe}).</p>
          </div>
        )}

        {/* Risultati */}
        <Card className="mt-4 p-5 print:border-0 print:p-0 print:shadow-none">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-medium text-text-primary">
              {REPORT_LIBRO_PRESENZE_TESTI.ANTEPRIMA}
            </h2>
            {report && (
              <p className="mt-0.5 text-xs text-text-muted">
                {report.righe.length} {REPORT_LIBRO_PRESENZE_TESTI.RIGHE}
              </p>
            )}
          </div>

          {!report && !loadingReport && (
            <p className="text-sm text-text-muted">{REPORT_LIBRO_PRESENZE_TESTI.NESSUNA_RICERCA}</p>
          )}
          {loadingReport && (
            <p className="text-sm text-text-muted">{REPORT_LIBRO_PRESENZE_TESTI.CARICAMENTO}</p>
          )}
          {report && report.righe.length === 0 && !loadingReport && (
            <p className="text-sm text-text-muted">{REPORT_LIBRO_PRESENZE_TESTI.NESSUN_RISULTATO}</p>
          )}

          {report && report.righe.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {REPORT_LIBRO_PRESENZE_COLONNE.map((colonna) => (
                      <th
                        key={colonna}
                        className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-text-muted"
                      >
                        {colonna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.righe.map((riga) => (
                    <tr key={riga.id} className="border-b border-border last:border-b-0 hover:bg-bg-base transition-colors duration-150">
                      <td className="whitespace-nowrap px-3 py-2.5 text-text-primary">{riga.data}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-text-primary">{riga.dipendente}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-text-muted">{riga.orePaghe}</td>
                      <td className="min-w-56 px-3 py-2.5 text-text-muted">{riga.cantiereAttivita}</td>
                      <td className="min-w-48 px-3 py-2.5 text-text-muted">{riga.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
