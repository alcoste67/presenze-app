import Link from "next/link";

import { LAVORAZIONI_TESTI } from "@/constants/lavorazioni";
import { REPORT_LIBRO_PRESENZE_TESTI } from "@/constants/reportLibroPresenze";
import { REPORT_PRESENZE_TESTI } from "@/constants/reportPresenze";

export default function BackofficePage() {
  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Back-office
            </h1>
          </div>

          <Link
            href="/"
            className="text-sm font-semibold text-blue-600"
          >
            Timbrature
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link
            href="/backoffice/dipendenti"
            className="rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow hover:border-gray-300"
          >
            <h2 className="text-xl font-semibold">
              Dipendenti
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Gestione anagrafica dipendenti
            </p>
          </Link>

          <Link
            href="/backoffice/cantieri"
            className="rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow hover:border-gray-300"
          >
            <h2 className="text-xl font-semibold">
              Cantieri
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Gestione anagrafica cantieri
            </p>
          </Link>

          <Link
            href="/backoffice/lavorazioni"
            className="rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow hover:border-gray-300"
          >
            <h2 className="text-xl font-semibold">
              {LAVORAZIONI_TESTI.TITOLO}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {
                LAVORAZIONI_TESTI.CARD_DESCRIZIONE
              }
            </p>
          </Link>

          <Link
            href="/backoffice/presenze"
            className="rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow hover:border-gray-300"
          >
            <h2 className="text-xl font-semibold">
              {REPORT_PRESENZE_TESTI.TITOLO}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {
                REPORT_PRESENZE_TESTI.CARD_DESCRIZIONE
              }
            </p>
          </Link>

          <Link
            href="/backoffice/libro-presenze"
            className="rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow hover:border-gray-300"
          >
            <h2 className="text-xl font-semibold">
              {
                REPORT_LIBRO_PRESENZE_TESTI.TITOLO
              }
            </h2>
            <p className="mt-2 text-sm text-gray-500">
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
