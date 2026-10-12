"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { Download, Home } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { RIMBORSI_KM_COLONNE, RIMBORSI_KM_CSV, RIMBORSI_KM_TESTI } from "@/constants/rimborsiKm";
import { getMessaggioErrore } from "@/lib/errors";
import { fetchRimborsiKmMensili } from "@/services/noteSpese/fetchRimborsiKmMensili";
import type { RimborsoKmRiga } from "@/types/rimborsiKm";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const TESTI = RIMBORSI_KM_TESTI;

function getMeseOggiInput(): string {
  const oggi = new Date();
  return `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}`;
}

function formattaNumero(valore: number): string {
  return new Intl.NumberFormat("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    valore
  );
}

function formattaImporto(valore: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(valore);
}

function getValoreCsvProtetto(value: string) {
  const valore = value.trimStart();
  if (valore.startsWith("=") || valore.startsWith("+") || valore.startsWith("-") || valore.startsWith("@")) {
    return `${RIMBORSI_KM_CSV.INJECTION_PREFIX}${value}`;
  }
  return value;
}

function formattaCampoCsv(value: string) {
  return `"${getValoreCsvProtetto(value).replaceAll('"', '""')}"`;
}

function getRigaCsv(valori: readonly string[]) {
  return valori.map(formattaCampoCsv).join(RIMBORSI_KM_CSV.SEPARATORE);
}

function creaCsv(righe: RimborsoKmRiga[]) {
  const contenuto = [
    getRigaCsv(RIMBORSI_KM_COLONNE),
    ...righe.map((riga) =>
      getRigaCsv([
        riga.dipendente,
        riga.veicoloDescrizione,
        formattaNumero(riga.kmTotali),
        riga.tariffaKmRimborso !== null ? riga.tariffaKmRimborso.toString() : "",
        riga.rimborso !== null ? riga.rimborso.toFixed(2) : "",
      ])
    ),
  ].join("\r\n");
  return `${RIMBORSI_KM_CSV.BOM}${contenuto}`;
}

function scaricaCsv(righe: RimborsoKmRiga[], mese: string) {
  const csv = creaCsv(righe);
  const blob = new Blob([csv], { type: RIMBORSI_KM_CSV.MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${RIMBORSI_KM_CSV.NOME_FILE_PREFIX}_${mese}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function BackofficeRimborsiKmPage() {
  const toast = useToast();

  const [mese, setMese] = useState(getMeseOggiInput());
  const [righe, setRighe] = useState<RimborsoKmRiga[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const [annoStr, meseStr] = mese.split("-");
    const anno = Number(annoStr);
    const meseNumero = Number(meseStr);

    if (!anno || !meseNumero) {
      toast.error(TESTI.ERRORI.MESE_NON_VALIDO);
      return;
    }

    try {
      setLoading(true);
      const risposta = await fetchRimborsiKmMensili({ anno, mese: meseNumero });
      setRighe(risposta.righe);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, TESTI.ERRORI.GENERICO));
    } finally {
      setLoading(false);
    }
  };

  const handleCsv = () => {
    if (!righe || righe.length === 0) return;
    scaricaCsv(righe, mese);
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader />

      <main className="mx-auto max-w-[800px] px-5 py-6">
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link href={APP_ROUTES.BACKOFFICE} className="hover:text-text-primary transition-colors duration-150">
            {TESTI.BACKOFFICE}
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{TESTI.TITOLO}</span>
        </nav>

        <h1 className="font-heading text-2xl font-medium text-text-primary">{TESTI.TITOLO}</h1>
        <p className="mt-1 text-sm text-text-muted">{TESTI.SOTTOTITOLO}</p>

        <Card className="mt-6 p-5">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <Input
              label={TESTI.MESE}
              type="month"
              value={mese}
              onChange={(e) => setMese(e.target.value)}
            />
            <Button type="submit" loading={loading}>
              {TESTI.CERCA}
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<Download className="h-4 w-4" />}
              onClick={handleCsv}
              disabled={!righe || righe.length === 0}
            >
              {TESTI.ESPORTA_CSV}
            </Button>
          </form>
        </Card>

        <Card className="mt-4 p-5">
          <h2 className="font-heading text-lg font-medium text-text-primary">{TESTI.ANTEPRIMA}</h2>

          {loading && <p className="mt-3 text-sm text-text-muted">{TESTI.CARICAMENTO}</p>}

          {!loading && righe && righe.length === 0 && (
            <p className="mt-3 text-sm text-text-muted">{TESTI.NESSUN_RISULTATO}</p>
          )}

          {!loading && righe && righe.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {RIMBORSI_KM_COLONNE.map((colonna) => (
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
                  {righe.map((riga) => (
                    <tr
                      key={riga.dipendenteId}
                      className="border-b border-border last:border-b-0 hover:bg-bg-base transition-colors duration-150"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 text-text-primary">{riga.dipendente}</td>
                      <td className="px-3 py-2.5 text-text-muted">{riga.veicoloDescrizione}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-text-muted">
                        {formattaNumero(riga.kmTotali)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-text-muted">
                        {riga.tariffaKmRimborso !== null
                          ? formattaImporto(riga.tariffaKmRimborso)
                          : TESTI.TARIFFA_NON_IMPOSTATA}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-text-primary">
                        {riga.rimborso !== null ? formattaImporto(riga.rimborso) : "—"}
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
