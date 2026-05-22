import Link from "next/link";

import { LAVORAZIONI_TESTI } from "@/constants/lavorazioni";
import { REPORT_LIBRO_PRESENZE_TESTI } from "@/constants/reportLibroPresenze";
import { REPORT_PRESENZE_TESTI } from "@/constants/reportPresenze";
import { SAL_TESTI } from "@/constants/sal";

export default function BackofficePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Back-office
            </h1>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
          >
            Timbrature
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Link
            href="/backoffice/dipendenti"
            className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)] transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
          >
            <h2 className="text-xl font-semibold">
              Dipendenti
            </h2>
            <p className="mt-2 text-sm text-industrial-muted">
              Gestione anagrafica dipendenti
            </p>
          </Link>

          <Link
            href="/backoffice/cantieri"
            className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)] transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
          >
            <h2 className="text-xl font-semibold">
              Cantieri
            </h2>
            <p className="mt-2 text-sm text-industrial-muted">
              Gestione anagrafica cantieri
            </p>
          </Link>

          <Link
            href="/backoffice/lavorazioni"
            className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)] transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
          >
            <h2 className="text-xl font-semibold">
              {LAVORAZIONI_TESTI.TITOLO}
            </h2>
            <p className="mt-2 text-sm text-industrial-muted">
              {
                LAVORAZIONI_TESTI.CARD_DESCRIZIONE
              }
            </p>
          </Link>

          <Link
            href="/backoffice/sal"
            className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)] transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
          >
            <h2 className="text-xl font-semibold">
              {SAL_TESTI.TITOLO}
            </h2>
            <p className="mt-2 text-sm text-industrial-muted">
              {SAL_TESTI.CARD_DESCRIZIONE}
            </p>
          </Link>

          <Link
            href="/backoffice/presenze"
            className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)] transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
          >
            <h2 className="text-xl font-semibold">
              {REPORT_PRESENZE_TESTI.TITOLO}
            </h2>
            <p className="mt-2 text-sm text-industrial-muted">
              {
                REPORT_PRESENZE_TESTI.CARD_DESCRIZIONE
              }
            </p>
          </Link>

          <Link
            href="/backoffice/libro-presenze"
            className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)] transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
          >
            <h2 className="text-xl font-semibold">
              {
                REPORT_LIBRO_PRESENZE_TESTI.TITOLO
              }
            </h2>
            <p className="mt-2 text-sm text-industrial-muted">
              {
                REPORT_LIBRO_PRESENZE_TESTI.CARD_DESCRIZIONE
              }
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
