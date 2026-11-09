"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { AlertTriangle, Download, Home, Printer } from "lucide-react";

import {
  REPORT_PAGHE_CSV,
  REPORT_PAGHE_TESTI,
} from "@/constants/reportPaghe";
import { APP_ROUTES } from "@/constants/routes";
import { getMessaggioErrore } from "@/lib/errors";

import { loadDipendenti } from "@/services/dipendenti/loadDipendenti";
import { fetchReportPaghe } from "@/services/report/fetchReportPaghe";

import type { Dipendente } from "@/types/dipendenti";
import type { ReportPagheFiltri, ReportPagheRiga, ReportPagheRisposta } from "@/types/reportPaghe";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMeseOggiInput() {
  const oggi = new Date();
  const year = oggi.getFullYear();
  const month = String(oggi.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function parseMeseInput(mese: string): { anno: number; mese: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(mese);
  if (!match) return null;
  return { anno: Number(match[1]), mese: Number(match[2]) };
}

function formattaDipendenteOption(dipendente: Dipendente) {
  return `${dipendente.cognome} ${dipendente.nome}`;
}

function getValoreCsvProtetto(value: string) {
  const valore = value.trimStart();
  if (valore.startsWith("=") || valore.startsWith("+") || valore.startsWith("-") || valore.startsWith("@")) {
    return `${REPORT_PAGHE_CSV.INJECTION_PREFIX}${value}`;
  }
  return value;
}

function formattaCampoCsv(value: string) {
  const valoreProtetto = getValoreCsvProtetto(value);
  return `"${valoreProtetto.replaceAll('"', '""')}"`;
}

function getRigaCsv(valori: readonly string[]) {
  return valori.map(formattaCampoCsv).join(REPORT_PAGHE_CSV.SEPARATORE);
}

function getColonneCsv(numeroGiorni: number): string[] {
  return [
    REPORT_PAGHE_TESTI.COLONNA_DIPENDENTE,
    ...Array.from({ length: numeroGiorni }, (_, indice) => String(indice + 1)),
    REPORT_PAGHE_TESTI.COLONNA_TOTALE,
  ];
}

function getValoriRigaCsv(riga: ReportPagheRiga): string[] {
  return [riga.dipendente, ...riga.giorni.map((giorno) => giorno.valore), riga.totaleOrePaghe];
}

function creaCsv(report: ReportPagheRisposta) {
  const contenuto = [
    getRigaCsv(getColonneCsv(report.numeroGiorni)),
    ...report.righe.map((riga) => getRigaCsv(getValoriRigaCsv(riga))),
  ].join("\r\n");
  return `${REPORT_PAGHE_CSV.BOM}${contenuto}`;
}

function scaricaCsv({ report, mese }: { report: ReportPagheRisposta; mese: string }) {
  const csv = creaCsv(report);
  const blob = new Blob([csv], { type: REPORT_PAGHE_CSV.MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${REPORT_PAGHE_CSV.NOME_FILE_PREFIX}_${mese}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeReportPaghePage() {
  const toast = useToast();

  const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
  const [mese, setMese] = useState(getMeseOggiInput());
  const [dipendenteId, setDipendenteId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportPagheRisposta | null>(null);
  const [loadingOpzioni, setLoadingOpzioni] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    let attivo = true;
    const init = async () => {
      try {
        const dipendentiData = await loadDipendenti();
        if (!attivo) return;
        setDipendenti(dipendentiData);
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, REPORT_PAGHE_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoadingOpzioni(false);
      }
    };
    void init();
    return () => {
      attivo = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseMeseInput(mese);
    if (!parsed) {
      toast.error(REPORT_PAGHE_TESTI.ERRORI.MESE_OBBLIGATORIO);
      return;
    }
    const filtri: ReportPagheFiltri = { anno: parsed.anno, mese: parsed.mese, dipendenteId };
    try {
      setLoadingReport(true);
      const reportData = await fetchReportPaghe(filtri);
      setReport(reportData);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, REPORT_PAGHE_TESTI.ERRORI.GENERICO));
    } finally {
      setLoadingReport(false);
    }
  };

  const handleCsv = () => {
    if (!report || report.righe.length === 0) return;
    scaricaCsv({ report, mese });
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
                {REPORT_PAGHE_TESTI.BACKOFFICE}
              </Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">
                {REPORT_PAGHE_TESTI.TIMBRATURE}
              </Button>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-[1200px] px-6 py-6 print:max-w-none print:px-0 print:py-0">
        {/* Breadcrumb + titolo */}
        <div className="print:hidden">
          <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
            <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
              <Home className="h-4 w-4" />
            </Link>
            <span>/</span>
            <Link href={APP_ROUTES.BACKOFFICE} className="hover:text-text-primary transition-colors duration-150">
              {REPORT_PAGHE_TESTI.BACKOFFICE}
            </Link>
            <span>/</span>
            <span className="font-medium text-text-primary">{REPORT_PAGHE_TESTI.TITOLO}</span>
          </nav>
          <h1 className="font-heading text-2xl font-medium text-text-primary">{REPORT_PAGHE_TESTI.TITOLO}</h1>
          <p className="mt-1 text-sm text-text-muted">{REPORT_PAGHE_TESTI.SOTTOTITOLO}</p>
        </div>

        {/* Filtri */}
        <Card className="mt-6 p-5 print:hidden">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label={REPORT_PAGHE_TESTI.MESE}
                type="month"
                value={mese}
                onChange={(e) => setMese(e.target.value)}
              />
              <Select
                label={REPORT_PAGHE_TESTI.DIPENDENTE}
                value={dipendenteId || ""}
                onChange={(e) => setDipendenteId(e.target.value || null)}
                disabled={loadingOpzioni}
              >
                <option value="">{REPORT_PAGHE_TESTI.TUTTI_DIPENDENTI}</option>
                {dipendenti.map((d) => (
                  <option key={d.id} value={d.id}>
                    {formattaDipendenteOption(d)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <Button type="submit" loading={loadingReport} disabled={loading}>
                {REPORT_PAGHE_TESTI.CERCA}
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={<Download className="h-4 w-4" />}
                onClick={handleCsv}
                disabled={!hasRisultati}
              >
                {REPORT_PAGHE_TESTI.ESPORTA_CSV}
              </Button>
              <Button
                type="button"
                variant="secondary"
                icon={<Printer className="h-4 w-4" />}
                onClick={handleStampa}
                disabled={!hasRisultati}
              >
                {REPORT_PAGHE_TESTI.STAMPA_PDF}
              </Button>
            </div>
          </form>
        </Card>

        {/* Banner limite raggiunto */}
        {report?.limiteRaggiunto && (
          <div className="mt-4 flex items-start gap-3 rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-500 print:hidden">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <p>{REPORT_PAGHE_TESTI.LIMITE_RAGGIUNTO}.</p>
          </div>
        )}

        {/* Risultati */}
        <Card className="mt-4 p-5 print:border-0 print:p-0 print:shadow-none">
          <div className="mb-4">
            <h2 className="font-heading text-lg font-medium text-text-primary">{REPORT_PAGHE_TESTI.ANTEPRIMA}</h2>
            {report && (
              <p className="mt-0.5 text-xs text-text-muted">
                {report.righe.length} {REPORT_PAGHE_TESTI.DIPENDENTI}
              </p>
            )}
          </div>

          {!report && !loadingReport && (
            <p className="text-sm text-text-muted">{REPORT_PAGHE_TESTI.NESSUNA_RICERCA}</p>
          )}
          {loadingReport && <p className="text-sm text-text-muted">{REPORT_PAGHE_TESTI.CARICAMENTO}</p>}
          {report && report.righe.length === 0 && !loadingReport && (
            <p className="text-sm text-text-muted">{REPORT_PAGHE_TESTI.NESSUN_RISULTATO}</p>
          )}

          {report && report.righe.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="sticky left-0 z-10 bg-bg-card whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-text-muted">
                      {REPORT_PAGHE_TESTI.COLONNA_DIPENDENTE}
                    </th>
                    {Array.from({ length: report.numeroGiorni }, (_, indice) => indice + 1).map((giorno) => (
                      <th
                        key={giorno}
                        className="whitespace-nowrap px-2 py-2.5 text-center text-xs font-medium text-text-muted"
                      >
                        {giorno}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-medium text-text-muted">
                      {REPORT_PAGHE_TESTI.COLONNA_TOTALE}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.righe.map((riga) => (
                    <tr
                      key={riga.dipendenteId}
                      className="border-b border-border last:border-b-0 hover:bg-bg-base transition-colors duration-150"
                    >
                      <td className="sticky left-0 z-10 bg-bg-card whitespace-nowrap px-3 py-2.5 font-medium text-text-primary">
                        {riga.dipendente}
                      </td>
                      {riga.giorni.map((giorno) => (
                        <td
                          key={giorno.giorno}
                          className="whitespace-nowrap px-2 py-2.5 text-center text-text-muted"
                        >
                          {giorno.valore}
                        </td>
                      ))}
                      <td className="whitespace-nowrap px-3 py-2.5 font-medium text-text-primary">
                        {riga.totaleOrePaghe}
                      </td>
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
