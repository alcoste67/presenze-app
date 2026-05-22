"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import { PRODUTTIVITA_TESTI } from "@/constants/produttivita";
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

type RiepilogoProduttivita = {
  lavorazioniCompletate: number;
  lavorazioniInCorso: number;
};

function getMessaggioErrore(error: unknown) {
  return error instanceof Error
    ? error.message
    : PRODUTTIVITA_TESTI.ERRORI.GENERICO;
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

  return `${ore}${PRODUTTIVITA_TESTI.UNITA_ORA} ${minuti}${PRODUTTIVITA_TESTI.UNITA_MINUTO}`;
}

function formattaPercentuale(
  percentuale: number
) {
  return `${percentuale}${PRODUTTIVITA_TESTI.SIMBOLO_PERCENTUALE}`;
}

function getRapportoLavorazione(
  lavorazione: SalLavorazione
) {
  if (
    lavorazione.percentuale_completamento <= 0
  ) {
    return PRODUTTIVITA_TESTI.VALORE_NON_DISPONIBILE;
  }

  const minutiPerPuntoPercentuale = Math.round(
    lavorazione.oreUomoMinuti /
      lavorazione.percentuale_completamento
  );

  return `${formattaOreUomo(minutiPerPuntoPercentuale)}${PRODUTTIVITA_TESTI.RAPPORTO_SUFFIX}`;
}

function getRiepilogoProduttivita(
  sal: SalCantiere
): RiepilogoProduttivita {
  return sal.lavorazioni.reduce(
    (riepilogo, lavorazione) => {
      if (
        lavorazione.stato ===
        SAL_STATI.COMPLETATA
      ) {
        return {
          ...riepilogo,
          lavorazioniCompletate:
            riepilogo.lavorazioniCompletate +
            1,
        };
      }

      if (
        lavorazione.stato ===
        SAL_STATI.IN_CORSO
      ) {
        return {
          ...riepilogo,
          lavorazioniInCorso:
            riepilogo.lavorazioniInCorso +
            1,
        };
      }

      return riepilogo;
    },
    {
      lavorazioniCompletate: 0,
      lavorazioniInCorso: 0,
    }
  );
}

function CardRiepilogo({
  label,
  valore,
}: {
  label: string;
  valore: string;
}) {
  return (
    <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
      <p className="text-sm font-medium text-industrial-muted">
        {label}
      </p>
      <p className="mt-3 text-3xl font-bold">
        {valore}
      </p>
    </section>
  );
}

function TabellaLavorazioni({
  lavorazioni,
}: {
  lavorazioni: SalLavorazione[];
}) {
  if (lavorazioni.length === 0) {
    return (
      <p className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-muted shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
        {
          PRODUTTIVITA_TESTI.NESSUNA_LAVORAZIONE
        }
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-industrial-border-soft bg-industrial-surface shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
      <table className="min-w-full divide-y divide-industrial-border-soft text-left text-sm">
        <thead className="bg-industrial-bg-soft text-xs font-semibold uppercase text-industrial-muted">
          <tr>
            <th className="px-4 py-3">
              {PRODUTTIVITA_TESTI.LAVORAZIONE}
            </th>
            <th className="px-4 py-3">
              {PRODUTTIVITA_TESTI.PERCENTUALE}
            </th>
            <th className="px-4 py-3">
              {PRODUTTIVITA_TESTI.STATO}
            </th>
            <th className="px-4 py-3">
              {PRODUTTIVITA_TESTI.ORE_UOMO}
            </th>
            <th className="px-4 py-3">
              {PRODUTTIVITA_TESTI.RAPPORTO}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-industrial-border-soft">
          {lavorazioni.map((lavorazione) => (
            <tr key={lavorazione.id}>
              <td className="px-4 py-3 font-medium text-industrial-text">
                {lavorazione.nome}
              </td>
              <td className="px-4 py-3 text-industrial-muted">
                {formattaPercentuale(
                  lavorazione.percentuale_completamento
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatoClassName(
                    lavorazione.stato
                  )}`}
                >
                  {getStatoLabel(
                    lavorazione.stato
                  )}
                </span>
              </td>
              <td className="px-4 py-3 text-industrial-muted">
                {formattaOreUomo(
                  lavorazione.oreUomoMinuti
                )}
              </td>
              <td className="px-4 py-3 text-industrial-muted">
                {getRapportoLavorazione(
                  lavorazione
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function BackofficeProduttivitaPage() {
  const [cantieri, setCantieri] = useState<
    CantiereBackoffice[]
  >([]);
  const [cantiereId, setCantiereId] =
    useState("");
  const [sal, setSal] =
    useState<SalCantiere | null>(null);
  const [loadingCantieri, setLoadingCantieri] =
    useState(true);
  const [
    loadingProduttivita,
    setLoadingProduttivita,
  ] = useState(false);
  const [errore, setErrore] = useState<
    string | null
  >(null);

  const caricaProduttivita = async (
    nextCantiereId: string
  ) => {
    if (!nextCantiereId) {
      setSal(null);
      return;
    }

    try {
      setLoadingProduttivita(true);
      setErrore(null);

      const dati = await loadSalCantiere(
        nextCantiereId
      );

      setSal(dati);
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setLoadingProduttivita(false);
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
          await caricaProduttivita(
            primoCantiereId
          );
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

    void caricaProduttivita(
      nextCantiereId
    );
  };

  const loading =
    loadingCantieri || loadingProduttivita;
  const riepilogo = sal
    ? getRiepilogoProduttivita(sal)
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {PRODUTTIVITA_TESTI.TITOLO}
            </h1>
          </div>

          <div className="flex gap-4 text-sm font-semibold">
            <Link
              href="/backoffice"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {PRODUTTIVITA_TESTI.BACKOFFICE}
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {PRODUTTIVITA_TESTI.TIMBRATURE}
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
              {PRODUTTIVITA_TESTI.CANTIERE}
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
                {
                  PRODUTTIVITA_TESTI.SELEZIONA_CANTIERE
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
        </section>

        {loading && (
          <p className="text-industrial-muted">
            {PRODUTTIVITA_TESTI.CARICAMENTO}
          </p>
        )}

        {!loadingCantieri &&
          cantieri.length === 0 && (
            <p className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-muted shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
              {
                PRODUTTIVITA_TESTI.NESSUN_CANTIERE
              }
            </p>
          )}

        {!loading && sal && riepilogo && (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <CardRiepilogo
                label={
                  PRODUTTIVITA_TESTI.AVANZAMENTO_MEDIO
                }
                valore={formattaPercentuale(
                  sal.avanzamentoTotale
                )}
              />
              <CardRiepilogo
                label={
                  PRODUTTIVITA_TESTI.ORE_UOMO_TOTALI
                }
                valore={formattaOreUomo(
                  sal.oreUomoTotaliMinuti
                )}
              />
              <CardRiepilogo
                label={
                  PRODUTTIVITA_TESTI.LAVORAZIONI_COMPLETATE
                }
                valore={String(
                  riepilogo.lavorazioniCompletate
                )}
              />
              <CardRiepilogo
                label={
                  PRODUTTIVITA_TESTI.LAVORAZIONI_IN_CORSO
                }
                valore={String(
                  riepilogo.lavorazioniInCorso
                )}
              />
            </div>

            <section>
              <h2 className="mb-4 text-xl font-semibold">
                {PRODUTTIVITA_TESTI.LAVORAZIONI}
              </h2>
              <TabellaLavorazioni
                lavorazioni={sal.lavorazioni}
              />
            </section>
          </>
        )}
      </div>
    </main>
  );
}
