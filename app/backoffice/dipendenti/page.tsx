"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import {
  LABEL_TIPO_CONTEGGIO_ORE,
  TIPO_CONTEGGIO_ORE,
  TIPO_CONTEGGIO_ORE_TESTI,
} from "@/constants/tipoConteggioOre";
import { aggiornaDipendente } from "@/services/dipendenti/aggiornaDipendente";
import { creaDipendente } from "@/services/dipendenti/creaDipendente";
import { eliminaDipendenteSeVuoto } from "@/services/dipendenti/eliminaDipendenteSeVuoto";
import { loadDipendenti } from "@/services/dipendenti/loadDipendenti";
import {
  Dipendente,
  DipendenteInput,
  RuoloDipendente,
  TipoConteggioOre,
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
  tipo_conteggio_ore:
    TIPO_CONTEGGIO_ORE.REALE,
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
    tipo_conteggio_ore:
      dipendente.tipo_conteggio_ore,
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
      tipo_conteggio_ore:
        dipendente.tipo_conteggio_ore,
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
            tipo_conteggio_ore:
              dipendente.tipo_conteggio_ore,
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
          tipo_conteggio_ore:
            dipendenteAggiornato.tipo_conteggio_ore,
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
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
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
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
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
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
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
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
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

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {
                    TIPO_CONTEGGIO_ORE_TESTI.LABEL
                  }
                </span>
                <select
                  value={form.tipo_conteggio_ore}
                  onChange={(event) =>
                    setForm(
                      (formCorrente) => ({
                        ...formCorrente,
                        tipo_conteggio_ore:
                          event.target
                            .value as TipoConteggioOre,
                      })
                    )
                  }
                  disabled={salvataggio}
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                >
                  {Object.values(
                    TIPO_CONTEGGIO_ORE
                  ).map((tipoConteggioOre) => (
                    <option
                      key={tipoConteggioOre}
                      value={tipoConteggioOre}
                    >
                      {
                        LABEL_TIPO_CONTEGGIO_ORE[
                          tipoConteggioOre
                        ]
                      }
                    </option>
                  ))}
                </select>
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

                {dipendenteInModificaId && (
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
                Lista dipendenti
              </h2>

              <button
                type="button"
                onClick={() =>
                  void caricaDipendenti()
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

            {!loading &&
              dipendenti.length === 0 && (
                <p className="text-industrial-muted">
                  Nessun dipendente
                </p>
              )}

            {!loading &&
              dipendenti.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-industrial-border-soft text-industrial-muted">
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
                          {
                            TIPO_CONTEGGIO_ORE_TESTI.LABEL
                          }
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
                            className="border-b border-industrial-border-soft last:border-b-0"
                          >
                            <td className="py-4 pr-4 font-semibold">
                              {dipendente.cognome}{" "}
                              {dipendente.nome}
                            </td>
                            <td className="py-4 pr-4 text-industrial-muted">
                              {dipendente.email}
                            </td>
                            <td className="py-4 pr-4 text-industrial-muted">
                              {
                                LABEL_RUOLI_DIPENDENTE[
                                  dipendente.ruolo
                                ]
                              }
                            </td>
                            <td className="py-4 pr-4 text-industrial-muted">
                              {
                                LABEL_TIPO_CONTEGGIO_ORE[
                                  dipendente
                                    .tipo_conteggio_ore
                                ]
                              }
                            </td>
                            <td className="py-4 pr-4">
                              <span
                                className={
                                  dipendente.attivo
                                    ? "rounded-full bg-industrial-success-bg px-3 py-1 text-xs font-semibold text-industrial-success-text"
                                    : "rounded-full bg-industrial-bg-soft px-3 py-1 text-xs font-semibold text-industrial-muted"
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
                                  className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
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
                                  className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
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
                                    className="rounded-lg border border-industrial-danger-border px-3 py-2 font-semibold text-industrial-danger-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
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
