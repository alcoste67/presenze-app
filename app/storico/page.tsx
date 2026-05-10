"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import { ATTIVITA } from "@/constants/attivita";
import { TIMBRATURE } from "@/constants/stati";
import { supabase } from "@/lib/supabase";
import {
  calcolaOreLavorate,
  RisultatoOreLavorate,
} from "@/services/timbrature/calcolaOreLavorate";
import {
  loadStoricoTimbrature,
  TimbraturaStorico,
} from "@/services/timbrature/loadStoricoTimbrature";
import { TipoAttivita } from "@/types/attivita";
import { TipoTimbratura } from "@/types/timbrature";

const LABEL_TIMBRATURE: Record<
  TipoTimbratura,
  string
> = {
  [TIMBRATURE.ENTRATA]: "Entrata",
  [TIMBRATURE.PAUSA]: "Pausa",
  [TIMBRATURE.RIENTRO]: "Rientro",
  [TIMBRATURE.USCITA]: "Uscita",
};

const LABEL_ATTIVITA: Record<
  TipoAttivita,
  string
> = {
  [ATTIVITA.ACQUISTI]: "Acquisti",
  [ATTIVITA.TRASFERTA]: "Trasferta",
  [ATTIVITA.MAGAZZINO]: "Magazzino",
  [ATTIVITA.UFFICIO]: "Ufficio",
  [ATTIVITA.SOPRALLUOGO]: "Sopralluogo",
  [ATTIVITA.ASSISTENZA]: "Assistenza",
  [ATTIVITA.VISITA_MEDICA]:
    "Visita medica",
  [ATTIVITA.FORMAZIONE]: "Formazione",
  [ATTIVITA.ALTRO]: "Altro",
};

function getIntervalloOggi() {
  const inizio = new Date();
  inizio.setHours(0, 0, 0, 0);

  const fine = new Date(inizio);
  fine.setDate(fine.getDate() + 1);

  return {
    dataInizio: inizio.toISOString(),
    dataFine: fine.toISOString(),
  };
}

function formattaDataOra(data: string) {
  return new Date(data).toLocaleString(
    "it-IT",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formattaOreLavorate(
  risultato: RisultatoOreLavorate
) {
  const ore = Math.floor(
    risultato.totaleMinuti / 60
  );
  const minuti =
    risultato.totaleMinuti % 60;

  return `${ore}h ${minuti}m`;
}

function formattaDestinazione(
  timbratura: TimbraturaStorico
) {
  if (timbratura.cantiere_nome) {
    return timbratura.cantiere_nome;
  }

  if (timbratura.attivita_tipo) {
    return LABEL_ATTIVITA[
      timbratura.attivita_tipo
    ];
  }

  return "Destinazione non disponibile";
}

export default function StoricoPage() {
  const [user, setUser] =
    useState<User | null>(null);

  const [timbrature, setTimbrature] =
    useState<TimbraturaStorico[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errore, setErrore] =
    useState<string | null>(null);

  const oreLavorate =
    calcolaOreLavorate(timbrature);

  const timbratureVisualizzate = [
    ...timbrature,
  ].reverse();

  useEffect(() => {
    let attivo = true;

    const caricaStorico = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!attivo) {
          return;
        }

        setUser(user);

        if (!user) {
          setTimbrature([]);
          return;
        }

        const { dataInizio, dataFine } =
          getIntervalloOggi();

        const storico =
          await loadStoricoTimbrature({
            userId: user.id,
            dataInizio,
            dataFine,
          });

        if (!attivo) {
          return;
        }

        setTimbrature(storico);
      } catch (error: unknown) {
        if (!attivo) {
          return;
        }

        setErrore(
          error instanceof Error
            ? error.message
            : "Errore caricamento storico"
        );
      } finally {
        if (attivo) {
          setLoading(false);
        }
      }
    };

    caricaStorico();

    return () => {
      attivo = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-3 text-3xl font-bold">
          Storico giornaliero
        </h1>

        <Link
          href="/"
          className="mb-6 inline-block font-semibold text-blue-600"
        >
          Torna alla timbratura
        </Link>

        {!user && !loading && (
          <p className="text-gray-500">
            Effettua il login per vedere lo
            storico.
          </p>
        )}

        {loading && (
          <p className="text-gray-500">
            Caricamento...
          </p>
        )}

        {errore && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {errore}
          </p>
        )}

        {!loading &&
          !errore &&
          user &&
          timbrature.length === 0 && (
            <p className="text-gray-500">
              Nessuna timbratura oggi
            </p>
          )}

        {!loading &&
          !errore &&
          user &&
          timbrature.length > 0 && (
            <div className="mb-4 rounded-lg bg-gray-50 p-4">
              <p className="font-semibold">
                Ore lavorate:{" "}
                {formattaOreLavorate(
                  oreLavorate
                )}
              </p>

              {oreLavorate.giornataAperta && (
                <p className="mt-1 text-sm text-gray-500">
                  Giornata aperta
                </p>
              )}

              {oreLavorate.sequenzaIncompleta && (
                <p className="mt-1 text-sm text-yellow-700">
                  Sequenza timbrature incompleta
                </p>
              )}
            </div>
          )}

        <div className="flex flex-col gap-3">
          {timbratureVisualizzate.map((timbratura) => (
            <div
              key={timbratura.id}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    {
                      LABEL_TIMBRATURE[
                        timbratura.tipo
                      ]
                    }
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    {formattaDestinazione(
                      timbratura
                    )}
                  </p>
                </div>

                <p className="text-right text-sm font-semibold text-gray-700">
                  {formattaDataOra(
                    timbratura.created_at
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
