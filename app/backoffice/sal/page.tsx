"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import {
  SAL_STATI,
  SAL_TESTI,
} from "@/constants/sal";
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
    return "bg-gray-100 text-gray-700";
  }

  if (stato === SAL_STATI.COMPLETATA) {
    return "bg-green-50 text-green-700";
  }

  return "bg-blue-50 text-blue-700";
}

function BarraProgresso({
  percentuale,
}: {
  percentuale: number;
}) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
      <div
        className="h-full rounded-full bg-blue-600"
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
    <li className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">
            {lavorazione.nome}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {SAL_TESTI.PERCENTUALE}:{" "}
            {
              lavorazione.percentuale_completamento
            }
            %
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

  const loading = loadingCantieri || loadingSal;

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {SAL_TESTI.TITOLO}
            </h1>
          </div>

          <div className="flex gap-4 text-sm font-semibold">
            <Link
              href="/backoffice"
              className="text-blue-600"
            >
              {SAL_TESTI.BACKOFFICE}
            </Link>
            <Link
              href="/"
              className="text-blue-600"
            >
              {SAL_TESTI.TIMBRATURE}
            </Link>
          </div>
        </div>

        {errore && (
          <p className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {errore}
          </p>
        )}

        <section className="mb-6 rounded-lg bg-white p-5 text-gray-900 shadow">
          <label className="block max-w-xl">
            <span className="mb-1 block text-sm font-medium text-gray-700">
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
              className="w-full rounded-lg border p-3 text-gray-900 disabled:bg-gray-100"
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
          <p className="text-gray-500">
            {SAL_TESTI.CARICAMENTO}
          </p>
        )}

        {!loadingCantieri &&
          cantieri.length === 0 && (
            <p className="rounded-lg bg-white p-5 text-gray-500 shadow">
              {SAL_TESTI.NESSUN_CANTIERE}
            </p>
          )}

        {!loading && sal && (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <section className="rounded-lg bg-white p-5 text-gray-900 shadow">
              <p className="text-sm font-medium text-gray-500">
                {
                  SAL_TESTI.AVANZAMENTO_TOTALE
                }
              </p>
              <p className="mt-3 text-4xl font-bold">
                {sal.avanzamentoTotale}%
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
                <p className="rounded-lg bg-white p-5 text-gray-500 shadow">
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
