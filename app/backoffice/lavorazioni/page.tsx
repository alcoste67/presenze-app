"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  LAVORAZIONI_LIMITI,
  LAVORAZIONI_TESTI,
} from "@/constants/lavorazioni";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { aggiornaLavorazioneCantiere } from "@/services/lavorazioni/aggiornaLavorazioneCantiere";
import { creaLavorazioneCantiere } from "@/services/lavorazioni/creaLavorazioneCantiere";
import { loadLavorazioniCantiere } from "@/services/lavorazioni/loadLavorazioniCantiere";
import type { CantiereBackoffice } from "@/types/cantieri";
import type {
  LavorazioneCantiere,
  LavorazioneCantiereInput,
  LavorazioneCantiereUpdate,
} from "@/types/lavorazioni";

type LavorazioneForm = {
  nome: string;
  ordine: string;
  percentuale_completamento: string;
  attiva: boolean;
};

const FORM_INIZIALE: LavorazioneForm = {
  nome: "",
  ordine: String(
    LAVORAZIONI_LIMITI.ORDINE_DEFAULT
  ),
  percentuale_completamento: String(
    LAVORAZIONI_LIMITI.PERCENTUALE_MIN
  ),
  attiva: true,
};

function getMessaggioErrore(error: unknown) {
  return error instanceof Error
    ? error.message
    : LAVORAZIONI_TESTI.ERRORI.GENERICO;
}

function getNumeroIntero(
  value: string
): number | null {
  const numero = Number(value.trim());

  if (!Number.isInteger(numero)) {
    return null;
  }

  return numero;
}

function isPercentualeValida(
  percentuale: number
) {
  return (
    percentuale >=
      LAVORAZIONI_LIMITI.PERCENTUALE_MIN &&
    percentuale <=
      LAVORAZIONI_LIMITI.PERCENTUALE_MAX
  );
}

function preparaPayload({
  cantiereId,
  form,
}: {
  cantiereId: string;
  form: LavorazioneForm;
}):
  | { payload: LavorazioneCantiereInput }
  | { errore: string } {
  if (!cantiereId) {
    return {
      errore:
        LAVORAZIONI_TESTI.ERRORI
          .CANTIERE_OBBLIGATORIO,
    };
  }

  const nome = form.nome.trim();

  if (!nome) {
    return {
      errore:
        LAVORAZIONI_TESTI.ERRORI
          .NOME_OBBLIGATORIO,
    };
  }

  const ordine = getNumeroIntero(
    form.ordine
  );

  if (ordine === null) {
    return {
      errore:
        LAVORAZIONI_TESTI.ERRORI
          .ORDINE_NON_VALIDO,
    };
  }

  const percentuale = getNumeroIntero(
    form.percentuale_completamento
  );

  if (
    percentuale === null ||
    !isPercentualeValida(percentuale)
  ) {
    return {
      errore:
        LAVORAZIONI_TESTI.ERRORI
          .PERCENTUALE_NON_VALIDA,
    };
  }

  return {
    payload: {
      cantiere_id: cantiereId,
      nome,
      ordine,
      attiva: form.attiva,
      percentuale_completamento:
        percentuale,
    },
  };
}

function getUpdateDaLavorazione(
  lavorazione: LavorazioneCantiere
): LavorazioneCantiereUpdate {
  return {
    nome: lavorazione.nome,
    ordine: lavorazione.ordine,
    attiva: lavorazione.attiva,
    percentuale_completamento:
      lavorazione.percentuale_completamento,
  };
}

function ordinaLavorazioni(
  lavorazioni: LavorazioneCantiere[]
) {
  return [...lavorazioni].sort((a, b) => {
    if (a.ordine !== b.ordine) {
      return a.ordine - b.ordine;
    }

    return a.created_at.localeCompare(
      b.created_at
    );
  });
}

function getPercentualiDraft(
  lavorazioni: LavorazioneCantiere[]
) {
  return Object.fromEntries(
    lavorazioni.map((lavorazione) => [
      lavorazione.id,
      String(
        lavorazione.percentuale_completamento
      ),
    ])
  );
}

export default function BackofficeLavorazioniPage() {
  const [cantieri, setCantieri] = useState<
    CantiereBackoffice[]
  >([]);
  const [cantiereId, setCantiereId] =
    useState("");
  const [lavorazioni, setLavorazioni] =
    useState<LavorazioneCantiere[]>([]);
  const [percentualiDraft, setPercentualiDraft] =
    useState<Record<string, string>>({});
  const [form, setForm] =
    useState<LavorazioneForm>(FORM_INIZIALE);
  const [
    lavorazioneInModificaId,
    setLavorazioneInModificaId,
  ] = useState<string | null>(null);
  const [loadingCantieri, setLoadingCantieri] =
    useState(true);
  const [
    loadingLavorazioni,
    setLoadingLavorazioni,
  ] = useState(false);
  const [salvataggio, setSalvataggio] =
    useState(false);
  const [errore, setErrore] = useState<
    string | null
  >(null);
  const [messaggio, setMessaggio] =
    useState<string | null>(null);

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setLavorazioneInModificaId(null);
  };

  const aggiornaLavorazioneInLista = (
    lavorazioneAggiornata: LavorazioneCantiere
  ) => {
    setLavorazioni((lavorazioniCorrenti) =>
      ordinaLavorazioni(
        lavorazioniCorrenti.map(
          (lavorazione) =>
            lavorazione.id ===
            lavorazioneAggiornata.id
              ? lavorazioneAggiornata
              : lavorazione
        )
      )
    );

    setPercentualiDraft(
      (percentualiCorrenti) => ({
        ...percentualiCorrenti,
        [lavorazioneAggiornata.id]: String(
          lavorazioneAggiornata.percentuale_completamento
        ),
      })
    );
  };

  const caricaLavorazioni = useCallback(
    async (nextCantiereId: string) => {
      if (!nextCantiereId) {
        setLavorazioni([]);
        setPercentualiDraft({});
        return;
      }

      try {
        setLoadingLavorazioni(true);
        setErrore(null);

        const dati =
          await loadLavorazioniCantiere(
            nextCantiereId
          );

        setLavorazioni(dati);
        setPercentualiDraft(
          getPercentualiDraft(dati)
        );
      } catch (error: unknown) {
        setErrore(getMessaggioErrore(error));
      } finally {
        setLoadingLavorazioni(false);
      }
    },
    []
  );

  useEffect(() => {
    let attivo = true;

    const caricaCantieri = async () => {
      try {
        const dati =
          await loadCantieriBackoffice();

        if (!attivo) {
          return;
        }

        setCantieri(dati);
        setCantiereId(
          (cantiereIdCorrente) =>
            cantiereIdCorrente ||
            dati[0]?.id ||
            ""
        );
      } catch (error: unknown) {
        if (!attivo) {
          return;
        }

        setErrore(
          getMessaggioErrore(error)
        );
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

  useEffect(() => {
    let attivo = true;

    if (!cantiereId) {
      return () => {
        attivo = false;
      };
    }

    const caricaLavorazioniCantiere =
      async () => {
        try {
          setLoadingLavorazioni(true);
          setErrore(null);

          const dati =
            await loadLavorazioniCantiere(
              cantiereId
            );

          if (!attivo) {
            return;
          }

          setLavorazioni(dati);
          setPercentualiDraft(
            getPercentualiDraft(dati)
          );
        } catch (error: unknown) {
          if (!attivo) {
            return;
          }

          setErrore(
            getMessaggioErrore(error)
          );
        } finally {
          if (attivo) {
            setLoadingLavorazioni(false);
          }
        }
      };

    void caricaLavorazioniCantiere();

    return () => {
      attivo = false;
    };
  }, [cantiereId]);

  const handleCantiereChange = (
    nextCantiereId: string
  ) => {
    setCantiereId(nextCantiereId);
    if (!nextCantiereId) {
      setLavorazioni([]);
      setPercentualiDraft({});
    }
    resetForm();
    setErrore(null);
    setMessaggio(null);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const risultato = preparaPayload({
      cantiereId,
      form,
    });

    if ("errore" in risultato) {
      setErrore(risultato.errore);
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      if (lavorazioneInModificaId) {
        const lavorazioneAggiornata =
          await aggiornaLavorazioneCantiere({
            lavorazioneId:
              lavorazioneInModificaId,
            lavorazione: {
              nome: risultato.payload.nome,
              ordine:
                risultato.payload.ordine,
              attiva:
                risultato.payload.attiva,
              percentuale_completamento:
                risultato.payload
                  .percentuale_completamento,
            },
          });

        aggiornaLavorazioneInLista(
          lavorazioneAggiornata
        );
        setMessaggio(
          LAVORAZIONI_TESTI.MESSAGGI
            .AGGIORNATA
        );
      } else {
        const nuovaLavorazione =
          await creaLavorazioneCantiere(
            risultato.payload
          );

        setLavorazioni(
          (lavorazioniCorrenti) =>
            ordinaLavorazioni([
              ...lavorazioniCorrenti,
              nuovaLavorazione,
            ])
        );
        setPercentualiDraft(
          (percentualiCorrenti) => ({
            ...percentualiCorrenti,
            [nuovaLavorazione.id]: String(
              nuovaLavorazione.percentuale_completamento
            ),
          })
        );
        setMessaggio(
          LAVORAZIONI_TESTI.MESSAGGI.CREATA
        );
      }

      resetForm();
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const avviaModifica = (
    lavorazione: LavorazioneCantiere
  ) => {
    setLavorazioneInModificaId(
      lavorazione.id
    );
    setForm({
      nome: lavorazione.nome,
      ordine: String(lavorazione.ordine),
      percentuale_completamento: String(
        lavorazione.percentuale_completamento
      ),
      attiva: lavorazione.attiva,
    });
    setErrore(null);
    setMessaggio(null);
  };

  const toggleAttiva = async (
    lavorazione: LavorazioneCantiere
  ) => {
    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      const lavorazioneAggiornata =
        await aggiornaLavorazioneCantiere({
          lavorazioneId: lavorazione.id,
          lavorazione: {
            ...getUpdateDaLavorazione(
              lavorazione
            ),
            attiva: !lavorazione.attiva,
          },
        });

      aggiornaLavorazioneInLista(
        lavorazioneAggiornata
      );

      if (
        lavorazioneInModificaId ===
        lavorazione.id
      ) {
        setForm((formCorrente) => ({
          ...formCorrente,
          attiva: lavorazioneAggiornata.attiva,
        }));
      }

      setMessaggio(
        lavorazioneAggiornata.attiva
          ? LAVORAZIONI_TESTI.MESSAGGI
              .ATTIVATA
          : LAVORAZIONI_TESTI.MESSAGGI
              .DISATTIVATA
      );
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const aggiornaPercentuale = async (
    lavorazione: LavorazioneCantiere
  ) => {
    const percentuale = getNumeroIntero(
      percentualiDraft[lavorazione.id] ||
        ""
    );

    if (
      percentuale === null ||
      !isPercentualeValida(percentuale)
    ) {
      setErrore(
        LAVORAZIONI_TESTI.ERRORI
          .PERCENTUALE_NON_VALIDA
      );
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      const lavorazioneAggiornata =
        await aggiornaLavorazioneCantiere({
          lavorazioneId: lavorazione.id,
          lavorazione: {
            ...getUpdateDaLavorazione(
              lavorazione
            ),
            percentuale_completamento:
              percentuale,
          },
        });

      aggiornaLavorazioneInLista(
        lavorazioneAggiornata
      );
      setMessaggio(
        LAVORAZIONI_TESTI.MESSAGGI
          .PERCENTUALE_AGGIORNATA
      );
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const formTitolo = lavorazioneInModificaId
    ? LAVORAZIONI_TESTI.MODIFICA_LAVORAZIONE
    : LAVORAZIONI_TESTI.NUOVA_LAVORAZIONE;
  const loading =
    loadingCantieri || loadingLavorazioni;

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {LAVORAZIONI_TESTI.TITOLO}
            </h1>
          </div>

          <div className="flex gap-4 text-sm font-semibold">
            <Link
              href="/backoffice"
              className="text-blue-600"
            >
              {LAVORAZIONI_TESTI.BACKOFFICE}
            </Link>
            <Link
              href="/"
              className="text-blue-600"
            >
              {LAVORAZIONI_TESTI.TIMBRATURE}
            </Link>
          </div>
        </div>

        {errore && (
          <p className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {errore}
          </p>
        )}

        {messaggio && (
          <p className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-700">
            {messaggio}
          </p>
        )}

        <section className="mb-6 rounded-lg bg-white p-5 text-gray-900 shadow">
          <label className="block max-w-xl">
            <span className="mb-1 block text-sm font-medium text-gray-700">
              {LAVORAZIONI_TESTI.CANTIERE}
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
                {
                  LAVORAZIONI_TESTI.SELEZIONA_CANTIERE
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

        {loadingCantieri && (
          <p className="text-gray-500">
            {LAVORAZIONI_TESTI.CARICAMENTO}
          </p>
        )}

        {!loadingCantieri &&
          cantieri.length === 0 && (
            <p className="rounded-lg bg-white p-5 text-gray-500 shadow">
              {
                LAVORAZIONI_TESTI.NESSUN_CANTIERE
              }
            </p>
          )}

        {!loadingCantieri &&
          cantieri.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
              <section className="rounded-lg bg-white p-5 text-gray-900 shadow">
                <h2 className="mb-4 text-xl font-semibold">
                  {formTitolo}
                </h2>

                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-4"
                >
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      {LAVORAZIONI_TESTI.NOME}
                    </span>
                    <input
                      value={form.nome}
                      onChange={(event) =>
                        setForm(
                          (formCorrente) => ({
                            ...formCorrente,
                            nome: event.target.value,
                          })
                        )
                      }
                      disabled={salvataggio}
                      className="w-full rounded-lg border p-3 text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      {LAVORAZIONI_TESTI.ORDINE}
                    </span>
                    <input
                      type="number"
                      value={form.ordine}
                      onChange={(event) =>
                        setForm(
                          (formCorrente) => ({
                            ...formCorrente,
                            ordine:
                              event.target.value,
                          })
                        )
                      }
                      disabled={salvataggio}
                      className="w-full rounded-lg border p-3 text-gray-900"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">
                      {
                        LAVORAZIONI_TESTI.PERCENTUALE
                      }
                    </span>
                    <input
                      type="number"
                      min={
                        LAVORAZIONI_LIMITI.PERCENTUALE_MIN
                      }
                      max={
                        LAVORAZIONI_LIMITI.PERCENTUALE_MAX
                      }
                      value={
                        form.percentuale_completamento
                      }
                      onChange={(event) =>
                        setForm(
                          (formCorrente) => ({
                            ...formCorrente,
                            percentuale_completamento:
                              event.target.value,
                          })
                        )
                      }
                      disabled={salvataggio}
                      className="w-full rounded-lg border p-3 text-gray-900"
                    />
                  </label>

                  <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.attiva}
                      onChange={(event) =>
                        setForm(
                          (formCorrente) => ({
                            ...formCorrente,
                            attiva:
                              event.target.checked,
                          })
                        )
                      }
                      disabled={salvataggio}
                      className="h-4 w-4"
                    />
                    {LAVORAZIONI_TESTI.ATTIVA}
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={
                        salvataggio || !cantiereId
                      }
                      className="rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:bg-gray-400"
                    >
                      {salvataggio
                        ? LAVORAZIONI_TESTI.SALVATAGGIO
                        : LAVORAZIONI_TESTI.SALVA}
                    </button>

                    {lavorazioneInModificaId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        disabled={salvataggio}
                        className="rounded-lg border px-4 py-3 font-semibold disabled:text-gray-400"
                      >
                        {LAVORAZIONI_TESTI.ANNULLA}
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section className="rounded-lg bg-white p-5 text-gray-900 shadow">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold">
                    {
                      LAVORAZIONI_TESTI.LISTA_LAVORAZIONI
                    }
                  </h2>

                  <button
                    type="button"
                    onClick={() =>
                      void caricaLavorazioni(
                        cantiereId
                      )
                    }
                    disabled={loading || salvataggio}
                    className="text-sm font-semibold text-blue-600 disabled:text-gray-400"
                  >
                    {LAVORAZIONI_TESTI.AGGIORNA}
                  </button>
                </div>

                {loadingLavorazioni && (
                  <p className="text-gray-500">
                    {
                      LAVORAZIONI_TESTI.CARICAMENTO
                    }
                  </p>
                )}

                {!loadingLavorazioni &&
                  lavorazioni.length === 0 && (
                    <p className="text-gray-500">
                      {
                        LAVORAZIONI_TESTI.NESSUNA_LAVORAZIONE
                      }
                    </p>
                  )}

                {!loadingLavorazioni &&
                  lavorazioni.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b text-gray-500">
                            <th className="py-3 pr-4 font-semibold">
                              {
                                LAVORAZIONI_TESTI.ORDINE
                              }
                            </th>
                            <th className="py-3 pr-4 font-semibold">
                              {
                                LAVORAZIONI_TESTI.NOME
                              }
                            </th>
                            <th className="py-3 pr-4 font-semibold">
                              {
                                LAVORAZIONI_TESTI.PERCENTUALE
                              }
                            </th>
                            <th className="py-3 pr-4 font-semibold">
                              {
                                LAVORAZIONI_TESTI.STATO
                              }
                            </th>
                            <th className="py-3 text-right font-semibold">
                              {
                                LAVORAZIONI_TESTI.AZIONI
                              }
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {lavorazioni.map(
                            (lavorazione) => (
                              <tr
                                key={lavorazione.id}
                                className="border-b last:border-b-0"
                              >
                                <td className="py-4 pr-4 font-semibold">
                                  {
                                    lavorazione.ordine
                                  }
                                </td>
                                <td className="py-4 pr-4 font-semibold">
                                  {lavorazione.nome}
                                </td>
                                <td className="py-4 pr-4">
                                  <div className="flex min-w-44 items-center gap-2">
                                    <input
                                      type="number"
                                      min={
                                        LAVORAZIONI_LIMITI.PERCENTUALE_MIN
                                      }
                                      max={
                                        LAVORAZIONI_LIMITI.PERCENTUALE_MAX
                                      }
                                      value={
                                        percentualiDraft[
                                          lavorazione
                                            .id
                                        ] ?? ""
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        setPercentualiDraft(
                                          (
                                            percentualiCorrenti
                                          ) => ({
                                            ...percentualiCorrenti,
                                            [lavorazione.id]:
                                              event
                                                .target
                                                .value,
                                          })
                                        )
                                      }
                                      disabled={
                                        salvataggio
                                      }
                                      className="w-20 rounded-lg border p-2 text-gray-900"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void aggiornaPercentuale(
                                          lavorazione
                                        )
                                      }
                                      disabled={
                                        salvataggio
                                      }
                                      className="rounded-lg border px-3 py-2 font-semibold disabled:text-gray-400"
                                    >
                                      {
                                        LAVORAZIONI_TESTI.AGGIORNA_PERCENTUALE
                                      }
                                    </button>
                                  </div>
                                </td>
                                <td className="py-4 pr-4">
                                  <span
                                    className={
                                      lavorazione.attiva
                                        ? "rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                                        : "rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600"
                                    }
                                  >
                                    {lavorazione.attiva
                                      ? LAVORAZIONI_TESTI.ATTIVO
                                      : LAVORAZIONI_TESTI.NON_ATTIVO}
                                  </span>
                                </td>
                                <td className="py-4 text-right">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        avviaModifica(
                                          lavorazione
                                        )
                                      }
                                      disabled={
                                        salvataggio
                                      }
                                      className="rounded-lg border px-3 py-2 font-semibold disabled:text-gray-400"
                                    >
                                      {
                                        LAVORAZIONI_TESTI.MODIFICA
                                      }
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        void toggleAttiva(
                                          lavorazione
                                        )
                                      }
                                      disabled={
                                        salvataggio
                                      }
                                      className="rounded-lg border px-3 py-2 font-semibold disabled:text-gray-400"
                                    >
                                      {lavorazione.attiva
                                        ? LAVORAZIONI_TESTI.DISATTIVA
                                        : LAVORAZIONI_TESTI.RIATTIVA}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
              </section>
            </div>
          )}
      </div>
    </main>
  );
}
