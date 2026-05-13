"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { aggiornaDipendente } from "@/services/dipendenti/aggiornaDipendente";
import { creaDipendente } from "@/services/dipendenti/creaDipendente";
import { eliminaDipendenteSeVuoto } from "@/services/dipendenti/eliminaDipendenteSeVuoto";
import { loadDipendenti } from "@/services/dipendenti/loadDipendenti";
import {
  Dipendente,
  DipendenteInput,
  RuoloDipendente,
} from "@/types/dipendenti";

const LABEL_RUOLI_DIPENDENTE: Record<
  RuoloDipendente,
  string
> = {
  [RUOLI_DIPENDENTE.OPERAIO]: "Operaio",
  [RUOLI_DIPENDENTE.RESPONSABILE]:
    "Responsabile",
  [RUOLI_DIPENDENTE.UFFICIO]: "Ufficio",
  [RUOLI_DIPENDENTE.ADMIN]: "Admin",
};

const FORM_INIZIALE: DipendenteInput = {
  nome: "",
  cognome: "",
  email: "",
  ruolo: RUOLI_DIPENDENTE.OPERAIO,
  attivo: true,
};

function getMessaggioErrore(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Errore gestione dipendenti";
}

function preparaDipendente(
  dipendente: DipendenteInput
): DipendenteInput {
  return {
    nome: dipendente.nome.trim(),
    cognome: dipendente.cognome.trim(),
    email: dipendente.email.trim(),
    ruolo: dipendente.ruolo,
    attivo: dipendente.attivo,
  };
}

function confrontaDipendenti(
  primo: Dipendente,
  secondo: Dipendente
) {
  const confrontoCognome =
    primo.cognome.localeCompare(
      secondo.cognome
    );

  if (confrontoCognome !== 0) {
    return confrontoCognome;
  }

  return primo.nome.localeCompare(
    secondo.nome
  );
}

export default function BackofficeDipendentiPage() {
  const [dipendenti, setDipendenti] =
    useState<Dipendente[]>([]);

  const [form, setForm] =
    useState<DipendenteInput>(
      FORM_INIZIALE
    );

  const [
    dipendenteInModificaId,
    setDipendenteInModificaId,
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

  const caricaDipendenti = useCallback(
    async () => {
      try {
        setLoading(true);
        setErrore(null);

        const dati = await loadDipendenti();

        setDipendenti(dati);
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

    const caricaDipendentiIniziali =
      async () => {
        try {
          const dati =
            await loadDipendenti();

          if (!attivo) {
            return;
          }

          setDipendenti(dati);
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

    void caricaDipendentiIniziali();

    return () => {
      attivo = false;
    };
  }, []);

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setDipendenteInModificaId(null);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const payload =
      preparaDipendente(form);

    if (!payload.nome) {
      alert("Inserisci il nome");
      return;
    }

    if (!payload.cognome) {
      alert("Inserisci il cognome");
      return;
    }

    if (!payload.email) {
      alert("Inserisci l'email");
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      if (dipendenteInModificaId) {
        const dipendenteAggiornato =
          await aggiornaDipendente({
            dipendenteId:
              dipendenteInModificaId,
            dipendente: payload,
          });

        setDipendenti(
          (dipendentiCorrenti) =>
            dipendentiCorrenti
              .map((dipendente) =>
                dipendente.id ===
                dipendenteAggiornato.id
                  ? dipendenteAggiornato
                  : dipendente
              )
              .sort(confrontaDipendenti)
        );

        setMessaggio(
          "Dipendente aggiornato"
        );
      } else {
        const nuovoDipendente =
          await creaDipendente(payload);

        setDipendenti(
          (dipendentiCorrenti) =>
            [
              ...dipendentiCorrenti,
              nuovoDipendente,
            ].sort(confrontaDipendenti)
        );

        setMessaggio(
          "Dipendente creato"
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
    dipendente: Dipendente
  ) => {
    setDipendenteInModificaId(
      dipendente.id
    );
    setForm({
      nome: dipendente.nome,
      cognome: dipendente.cognome,
      email: dipendente.email,
      ruolo: dipendente.ruolo,
      attivo: dipendente.attivo,
    });
    setErrore(null);
    setMessaggio(null);
  };

  const toggleAttivo = async (
    dipendente: Dipendente
  ) => {
    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      const dipendenteAggiornato =
        await aggiornaDipendente({
          dipendenteId: dipendente.id,
          dipendente: {
            nome: dipendente.nome,
            cognome: dipendente.cognome,
            email: dipendente.email,
            ruolo: dipendente.ruolo,
            attivo: !dipendente.attivo,
          },
        });

      setDipendenti(
        (dipendentiCorrenti) =>
          dipendentiCorrenti
            .map((dipendenteCorrente) =>
              dipendenteCorrente.id ===
              dipendenteAggiornato.id
                ? dipendenteAggiornato
                : dipendenteCorrente
            )
            .sort(confrontaDipendenti)
      );

      if (
        dipendenteInModificaId ===
        dipendenteAggiornato.id
      ) {
        setForm({
          nome: dipendenteAggiornato.nome,
          cognome:
            dipendenteAggiornato.cognome,
          email: dipendenteAggiornato.email,
          ruolo: dipendenteAggiornato.ruolo,
          attivo:
            dipendenteAggiornato.attivo,
        });
      }

      setMessaggio(
        dipendenteAggiornato.attivo
          ? "Dipendente attivato"
          : "Dipendente disattivato"
      );
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const eliminaDipendente = async (
    dipendente: Dipendente
  ) => {
    if (dipendente.attivo) {
      setErrore(
        "Disattiva il dipendente prima di eliminarlo"
      );

      return;
    }

    const confermato = window.confirm(
      `Eliminare definitivamente il dipendente ${dipendente.cognome} ${dipendente.nome}?`
    );

    if (!confermato) {
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      await eliminaDipendenteSeVuoto(
        dipendente.id
      );

      if (
        dipendenteInModificaId ===
        dipendente.id
      ) {
        resetForm();
      }

      await caricaDipendenti();

      setMessaggio(
        "Dipendente eliminato"
      );
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const formTitolo = dipendenteInModificaId
    ? "Modifica dipendente"
    : "Nuovo dipendente";

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              Dipendenti
            </h1>
          </div>

          <div className="flex gap-4 text-sm font-semibold">
            <Link
              href="/backoffice"
              className="text-blue-600"
            >
              Back-office
            </Link>
            <Link
              href="/"
              className="text-blue-600"
            >
              Timbrature
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
                  className="w-full rounded-lg border p-3 text-gray-900"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Cognome
                </span>
                <input
                  value={form.cognome}
                  onChange={(event) =>
                    setForm(
                      (formCorrente) => ({
                        ...formCorrente,
                        cognome:
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
                  Email
                </span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm(
                      (formCorrente) => ({
                        ...formCorrente,
                        email: event.target.value,
                      })
                    )
                  }
                  disabled={salvataggio}
                  className="w-full rounded-lg border p-3 text-gray-900"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Ruolo
                </span>
                <select
                  value={form.ruolo}
                  onChange={(event) =>
                    setForm(
                      (formCorrente) => ({
                        ...formCorrente,
                        ruolo: event.target
                          .value as RuoloDipendente,
                      })
                    )
                  }
                  disabled={salvataggio}
                  className="w-full rounded-lg border p-3 text-gray-900"
                >
                  {Object.values(
                    RUOLI_DIPENDENTE
                  ).map((ruolo) => (
                    <option
                      key={ruolo}
                      value={ruolo}
                    >
                      {
                        LABEL_RUOLI_DIPENDENTE[
                          ruolo
                        ]
                      }
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
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
                  className="rounded-lg bg-black px-4 py-3 font-semibold text-white disabled:bg-gray-400"
                >
                  {salvataggio
                    ? "Salvataggio..."
                    : "Salva"}
                </button>

                {dipendenteInModificaId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={salvataggio}
                    className="rounded-lg border px-4 py-3 font-semibold disabled:text-gray-400"
                  >
                    Annulla
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-lg bg-white p-5 text-gray-900 shadow">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">
                Lista dipendenti
              </h2>

              <button
                type="button"
                onClick={() =>
                  void caricaDipendenti()
                }
                disabled={loading || salvataggio}
                className="text-sm font-semibold text-blue-600 disabled:text-gray-400"
              >
                Aggiorna
              </button>
            </div>

            {loading && (
              <p className="text-gray-500">
                Caricamento...
              </p>
            )}

            {!loading &&
              dipendenti.length === 0 && (
                <p className="text-gray-500">
                  Nessun dipendente
                </p>
              )}

            {!loading &&
              dipendenti.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b text-gray-500">
                        <th className="py-3 pr-4 font-semibold">
                          Dipendente
                        </th>
                        <th className="py-3 pr-4 font-semibold">
                          Email
                        </th>
                        <th className="py-3 pr-4 font-semibold">
                          Ruolo
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
                      {dipendenti.map(
                        (dipendente) => (
                          <tr
                            key={dipendente.id}
                            className="border-b last:border-b-0"
                          >
                            <td className="py-4 pr-4 font-semibold">
                              {dipendente.cognome}{" "}
                              {dipendente.nome}
                            </td>
                            <td className="py-4 pr-4 text-gray-700">
                              {dipendente.email}
                            </td>
                            <td className="py-4 pr-4 text-gray-700">
                              {
                                LABEL_RUOLI_DIPENDENTE[
                                  dipendente.ruolo
                                ]
                              }
                            </td>
                            <td className="py-4 pr-4">
                              <span
                                className={
                                  dipendente.attivo
                                    ? "rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                                    : "rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600"
                                }
                              >
                                {dipendente.attivo
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
                                      dipendente
                                    )
                                  }
                                  disabled={salvataggio}
                                  className="rounded-lg border px-3 py-2 font-semibold disabled:text-gray-400"
                                >
                                  Modifica
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    void toggleAttivo(
                                      dipendente
                                    )
                                  }
                                  disabled={salvataggio}
                                  className="rounded-lg border px-3 py-2 font-semibold disabled:text-gray-400"
                                >
                                  {dipendente.attivo
                                    ? "Disattiva"
                                    : "Attiva"}
                                </button>

                                {!dipendente.attivo && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void eliminaDipendente(
                                        dipendente
                                      )
                                    }
                                    disabled={salvataggio}
                                    className="rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-700 disabled:text-gray-400"
                                  >
                                    Elimina
                                  </button>
                                )}
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
      </div>
    </main>
  );
}
