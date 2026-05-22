"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { aggiornaCantiere } from "@/services/cantieri/aggiornaCantiere";
import { creaCantiere } from "@/services/cantieri/creaCantiere";
import { eliminaCantiereSeVuoto } from "@/services/cantieri/eliminaCantiereSeVuoto";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import {
  CantiereBackoffice,
  CantiereInput,
} from "@/types/cantieri";

const FORM_INIZIALE: CantiereInput = {
  nome: "",
  indirizzo: "",
  lavorazioni: "",
  attivo: true,
};

function getMessaggioErrore(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Errore gestione cantieri";
}

function preparaCantiere(
  cantiere: CantiereInput
): CantiereInput {
  return {
    nome: cantiere.nome.trim(),
    indirizzo: cantiere.indirizzo.trim(),
    lavorazioni: cantiere.lavorazioni.trim(),
    attivo: cantiere.attivo,
  };
}

export default function BackofficeCantieriPage() {
  const [cantieri, setCantieri] = useState<
    CantiereBackoffice[]
  >([]);

  const [form, setForm] =
    useState<CantiereInput>(FORM_INIZIALE);

  const [
    cantiereInModificaId,
    setCantiereInModificaId,
  ] = useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);
  const [salvataggio, setSalvataggio] =
    useState(false);
  const [errore, setErrore] = useState<
    string | null
  >(null);
  const [messaggio, setMessaggio] =
    useState<string | null>(null);

  const caricaCantieri = useCallback(
    async () => {
      try {
        setLoading(true);
        setErrore(null);

        const dati =
          await loadCantieriBackoffice();

        setCantieri(dati);
      } catch (error: unknown) {
        setErrore(getMessaggioErrore(error));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let attivo = true;

    const caricaCantieriIniziali =
      async () => {
        try {
          const dati =
            await loadCantieriBackoffice();

          if (!attivo) {
            return;
          }

          setCantieri(dati);
        } catch (error: unknown) {
          if (!attivo) {
            return;
          }

          setErrore(
            getMessaggioErrore(error)
          );
        } finally {
          if (attivo) {
            setLoading(false);
          }
        }
      };

    void caricaCantieriIniziali();

    return () => {
      attivo = false;
    };
  }, []);

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setCantiereInModificaId(null);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const payload = preparaCantiere(form);

    if (!payload.nome) {
      alert("Inserisci il nome del cantiere");
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      if (cantiereInModificaId) {
        const cantiereAggiornato =
          await aggiornaCantiere({
            cantiereId:
              cantiereInModificaId,
            cantiere: payload,
          });

        setCantieri((cantieriCorrenti) =>
          cantieriCorrenti.map((cantiere) =>
            cantiere.id ===
            cantiereAggiornato.id
              ? cantiereAggiornato
              : cantiere
          )
        );

        setMessaggio(
          "Cantiere aggiornato"
        );
      } else {
        const nuovoCantiere =
          await creaCantiere(payload);

        setCantieri((cantieriCorrenti) =>
          [...cantieriCorrenti, nuovoCantiere].sort(
            (a, b) =>
              a.nome.localeCompare(b.nome)
          )
        );

        setMessaggio("Cantiere creato");
      }

      resetForm();
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const avviaModifica = (
    cantiere: CantiereBackoffice
  ) => {
    setCantiereInModificaId(cantiere.id);
    setForm({
      nome: cantiere.nome,
      indirizzo: cantiere.indirizzo,
      lavorazioni: cantiere.lavorazioni,
      attivo: cantiere.attivo,
    });
    setErrore(null);
    setMessaggio(null);
  };

  const toggleAttivo = async (
    cantiere: CantiereBackoffice
  ) => {
    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      const cantiereAggiornato =
        await aggiornaCantiere({
          cantiereId: cantiere.id,
          cantiere: {
            nome: cantiere.nome,
            indirizzo: cantiere.indirizzo,
            lavorazioni:
              cantiere.lavorazioni,
            attivo: !cantiere.attivo,
          },
        });

      setCantieri((cantieriCorrenti) =>
        cantieriCorrenti.map(
          (cantiereCorrente) =>
            cantiereCorrente.id ===
            cantiereAggiornato.id
              ? cantiereAggiornato
              : cantiereCorrente
        )
      );

      if (
        cantiereInModificaId ===
        cantiereAggiornato.id
      ) {
        setForm({
          nome: cantiereAggiornato.nome,
          indirizzo:
            cantiereAggiornato.indirizzo,
          lavorazioni:
            cantiereAggiornato.lavorazioni,
          attivo: cantiereAggiornato.attivo,
        });
      }

      setMessaggio(
        cantiereAggiornato.attivo
          ? "Cantiere attivato"
          : "Cantiere disattivato"
      );
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const eliminaCantiere = async (
    cantiere: CantiereBackoffice
  ) => {
    if (cantiere.attivo) {
      setErrore(
        "Disattiva il cantiere prima di eliminarlo"
      );

      return;
    }

    const confermato = window.confirm(
      `Eliminare definitivamente il cantiere "${cantiere.nome}"?`
    );

    if (!confermato) {
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      await eliminaCantiereSeVuoto(
        cantiere.id
      );

      if (
        cantiereInModificaId === cantiere.id
      ) {
        resetForm();
      }

      await caricaCantieri();

      setMessaggio("Cantiere eliminato");
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const formTitolo = cantiereInModificaId
    ? "Modifica cantiere"
    : "Nuovo cantiere";

  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Cantieri
            </h1>
          </div>

          <div className="flex gap-4 text-sm font-semibold">
            <Link
              href="/backoffice"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              Back-office
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              Timbrature
            </Link>
          </div>
        </div>

        {errore && (
          <p className="mb-4 rounded-lg bg-industrial-danger-bg p-4 text-sm text-industrial-danger-text">
            {errore}
          </p>
        )}

        {messaggio && (
          <p className="mb-4 rounded-lg bg-industrial-success-bg p-4 text-sm text-industrial-success-text">
            {messaggio}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
            <h2 className="mb-4 text-xl font-semibold">
              {formTitolo}
            </h2>

            <form
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
            >
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  Nome
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
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  Indirizzo
                </span>
                <input
                  value={form.indirizzo}
                  onChange={(event) =>
                    setForm(
                      (formCorrente) => ({
                        ...formCorrente,
                        indirizzo:
                          event.target.value,
                      })
                    )
                  }
                  disabled={salvataggio}
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  Lavorazioni
                </span>
                <textarea
                  value={form.lavorazioni}
                  onChange={(event) =>
                    setForm(
                      (formCorrente) => ({
                        ...formCorrente,
                        lavorazioni:
                          event.target.value,
                      })
                    )
                  }
                  disabled={salvataggio}
                  rows={4}
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="flex items-center gap-3 text-sm font-medium text-industrial-muted">
                <input
                  type="checkbox"
                  checked={form.attivo}
                  onChange={(event) =>
                    setForm(
                      (formCorrente) => ({
                        ...formCorrente,
                        attivo:
                          event.target.checked,
                      })
                    )
                  }
                  disabled={salvataggio}
                  className="h-4 w-4"
                />
                Attivo
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={salvataggio}
                  className="rounded-lg border border-industrial-orange bg-industrial-orange px-4 py-3 font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover active:border-industrial-orange-active active:bg-industrial-orange-active disabled:bg-industrial-border disabled:text-industrial-muted"
                >
                  {salvataggio
                    ? "Salvataggio..."
                    : "Salva"}
                </button>

                {cantiereInModificaId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={salvataggio}
                    className="rounded-lg border border-industrial-border bg-industrial-control px-4 py-3 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
                  >
                    Annulla
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">
                Lista cantieri
              </h2>

              <button
                type="button"
                onClick={() =>
                  void caricaCantieri()
                }
                disabled={loading || salvataggio}
                className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
              >
                Aggiorna
              </button>
            </div>

            {loading && (
              <p className="text-industrial-muted">
                Caricamento...
              </p>
            )}

            {!loading && cantieri.length === 0 && (
              <p className="text-industrial-muted">
                Nessun cantiere
              </p>
            )}

            {!loading && cantieri.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-industrial-border-soft text-industrial-muted">
                      <th className="py-3 pr-4 font-semibold">
                        Nome
                      </th>
                      <th className="py-3 pr-4 font-semibold">
                        Indirizzo
                      </th>
                      <th className="py-3 pr-4 font-semibold">
                        Lavorazioni
                      </th>
                      <th className="py-3 pr-4 font-semibold">
                        Stato
                      </th>
                      <th className="py-3 text-right font-semibold">
                        Azioni
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {cantieri.map((cantiere) => (
                      <tr
                        key={cantiere.id}
                        className="border-b border-industrial-border-soft last:border-b-0"
                      >
                        <td className="py-4 pr-4 font-semibold">
                          {cantiere.nome}
                        </td>
                        <td className="py-4 pr-4 text-industrial-muted">
                          {cantiere.indirizzo ||
                            "-"}
                        </td>
                        <td className="max-w-xs py-4 pr-4 text-industrial-muted">
                          {cantiere.lavorazioni ||
                            "-"}
                        </td>
                        <td className="py-4 pr-4">
                          <span
                            className={
                              cantiere.attivo
                                ? "rounded-full bg-industrial-success-bg px-3 py-1 text-xs font-semibold text-industrial-success-text"
                                : "rounded-full bg-industrial-bg-soft px-3 py-1 text-xs font-semibold text-industrial-muted"
                            }
                          >
                            {cantiere.attivo
                              ? "Attivo"
                              : "Non attivo"}
                          </span>
                        </td>
                        <td className="py-4 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                avviaModifica(
                                  cantiere
                                )
                              }
                              disabled={salvataggio}
                              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
                            >
                              Modifica
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void toggleAttivo(
                                  cantiere
                                )
                              }
                              disabled={salvataggio}
                              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
                            >
                              {cantiere.attivo
                                ? "Disattiva"
                                : "Attiva"}
                            </button>

                            {!cantiere.attivo && (
                              <button
                                type="button"
                                onClick={() =>
                                  void eliminaCantiere(
                                    cantiere
                                  )
                                }
                                disabled={salvataggio}
                                className="rounded-lg border border-industrial-danger-border px-3 py-2 font-semibold text-industrial-danger-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
                              >
                                Elimina
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
