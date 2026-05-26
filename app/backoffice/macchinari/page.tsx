"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import {
  useEffect,
  useState,
} from "react";

import { APP_ROUTES } from "@/constants/routes";
import {
  MACCHINARI_TESTI,
  TIPI_MACCHINARIO,
} from "@/constants/macchinari";
import { aggiornaMacchinario } from "@/services/macchinari/aggiornaMacchinario";
import { creaMacchinario } from "@/services/macchinari/creaMacchinario";
import { eliminaMacchinario } from "@/services/macchinari/eliminaMacchinario";
import { loadMacchinariAdmin } from "@/services/macchinari/loadMacchinariAdmin";
import type {
  Macchinario,
  MacchinarioInput,
} from "@/types/macchinari";

type MacchinarioForm = {
  nome: string;
  tipo: MacchinarioInput["tipo"] | "";
  descrizione: string;
  costo_orario: string;
  attivo: boolean;
};

const FORM_INIZIALE: MacchinarioForm = {
  nome: "",
  tipo: "",
  descrizione: "",
  costo_orario: "",
  attivo: true,
};

function getMessaggioErrore(error: unknown) {
  return error instanceof Error
    ? error.message
    : MACCHINARI_TESTI.ERRORI.GENERICO;
}

function parseNumeroDecimale(value: string) {
  if (!value.trim()) {
    return null;
  }

  const numero = Number(
    value.trim().replace(",", ".")
  );

  return Number.isFinite(numero) && numero >= 0
    ? numero
    : null;
}

function getTipoLabel(tipo: MacchinarioInput["tipo"]) {
  return MACCHINARI_TESTI.CODA_TIPI[tipo];
}

function preparaPayload(
  form: MacchinarioForm
): { payload: MacchinarioInput } | { errore: string } {
  const nome = form.nome.trim();

  if (!nome) {
    return {
      errore:
        MACCHINARI_TESTI.ERRORI.NOME_OBBLIGATORIO,
    };
  }

  if (!form.tipo) {
    return {
      errore:
        MACCHINARI_TESTI.ERRORI
          .TIPO_ANAGRAFICA_OBBLIGATORIO,
    };
  }

  return {
    payload: {
      nome,
      tipo: form.tipo,
      descrizione: form.descrizione.trim(),
      costo_orario:
        parseNumeroDecimale(form.costo_orario),
      attivo: form.attivo,
    },
  };
}

export default function BackofficeMacchinariPage() {
  const [macchinari, setMacchinari] = useState<
    Macchinario[]
  >([]);
  const [form, setForm] =
    useState<MacchinarioForm>(FORM_INIZIALE);
  const [
    macchinarioInModificaId,
    setMacchinarioInModificaId,
  ] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] =
    useState(false);
  const [errore, setErrore] = useState<
    string | null
  >(null);
  const [messaggio, setMessaggio] = useState<
    string | null
  >(null);

  useEffect(() => {
    let attivo = true;

    const caricaMacchinari = async () => {
      try {
        const dati = await loadMacchinariAdmin();

        if (!attivo) {
          return;
        }

        setMacchinari(dati);
      } catch (error: unknown) {
        if (attivo) {
          setErrore(getMessaggioErrore(error));
        }
      } finally {
        if (attivo) {
          setLoading(false);
        }
      }
    };

    void caricaMacchinari();

    return () => {
      attivo = false;
    };
  }, []);

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setMacchinarioInModificaId(null);
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const risultato = preparaPayload(form);

    if ("errore" in risultato) {
      setErrore(risultato.errore);
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      if (macchinarioInModificaId) {
        const macchinarioAggiornato =
          await aggiornaMacchinario({
            macchinarioId:
              macchinarioInModificaId,
            macchinario: risultato.payload,
          });

        setMacchinari((correnti) =>
          correnti.map((item) =>
            item.id === macchinarioAggiornato.id
              ? macchinarioAggiornato
              : item
          )
        );

        setMessaggio(
          MACCHINARI_TESTI.MESSAGGI
            .MACCHINARIO_AGGIORNATO
        );
      } else {
        const nuovoMacchinario =
          await creaMacchinario({
            macchinario: risultato.payload,
          });

        setMacchinari((correnti) => [
          nuovoMacchinario,
          ...correnti,
        ]);

        setMessaggio(
          MACCHINARI_TESTI.MESSAGGI
            .MACCHINARIO_CREATO
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
    macchinario: Macchinario
  ) => {
    setMacchinarioInModificaId(macchinario.id);
    setForm({
      nome: macchinario.nome,
      tipo: macchinario.tipo,
      descrizione: macchinario.descrizione,
      costo_orario:
        macchinario.costo_orario === null
          ? ""
          : String(macchinario.costo_orario),
      attivo: macchinario.attivo,
    });
    setErrore(null);
    setMessaggio(null);
  };

  const handleElimina = async (
    macchinario: Macchinario
  ) => {
    if (
      !window.confirm(
        `Eliminare ${macchinario.nome}?`
      )
    ) {
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      await eliminaMacchinario({
        macchinarioId: macchinario.id,
      });

      setMacchinari((correnti) =>
        correnti.filter(
          (item) => item.id !== macchinario.id
        )
      );

      setMessaggio(
        MACCHINARI_TESTI.MESSAGGI
          .MACCHINARIO_ELIMINATO
      );

      if (macchinarioInModificaId === macchinario.id) {
        resetForm();
      }
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {MACCHINARI_TESTI.ANAGRAFICA_TITOLO}
            </h1>
            <p className="mt-1 text-sm text-industrial-muted">
              {MACCHINARI_TESTI.ANAGRAFICA_CARD_DESCRIZIONE}
            </p>
          </div>

          <div className="flex gap-4 text-sm font-semibold">
            <Link
              href={APP_ROUTES.BACKOFFICE}
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {MACCHINARI_TESTI.BACKOFFICE}
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {MACCHINARI_TESTI.TIMBRATURE}
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

        <section className="mb-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 shadow-[0_12px_28px_rgb(36_38_43/0.08)]"
          >
            <div className="grid gap-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {MACCHINARI_TESTI.NOME}
                </span>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(event) =>
                    setForm((corrente) => ({
                      ...corrente,
                      nome: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {MACCHINARI_TESTI.TIPO}
                </span>
                <select
                  value={form.tipo}
                  onChange={(event) =>
                    setForm((corrente) => ({
                      ...corrente,
                      tipo: event.target
                        .value as MacchinarioInput["tipo"] | "",
                    }))
                  }
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                >
                  <option value="">
                    {MACCHINARI_TESTI.TIPO}
                  </option>
                  {Object.values(TIPI_MACCHINARIO).map(
                    (tipo) => (
                      <option key={tipo} value={tipo}>
                        {getTipoLabel(tipo)}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {MACCHINARI_TESTI.DESCRIZIONE}
                </span>
                <textarea
                  value={form.descrizione}
                  onChange={(event) =>
                    setForm((corrente) => ({
                      ...corrente,
                      descrizione:
                        event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {MACCHINARI_TESTI.COSTO_ORARIO}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costo_orario}
                  onChange={(event) =>
                    setForm((corrente) => ({
                      ...corrente,
                      costo_orario:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-industrial-border bg-industrial-control p-3">
                <input
                  type="checkbox"
                  checked={form.attivo}
                  onChange={(event) =>
                    setForm((corrente) => ({
                      ...corrente,
                      attivo: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-industrial-border text-industrial-orange focus:ring-industrial-orange"
                />
                <span className="text-sm text-industrial-text">
                  {MACCHINARI_TESTI.ATTIVO}
                </span>
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={salvataggio || loading}
                className="rounded-lg border border-industrial-orange bg-industrial-orange px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover disabled:border-industrial-border-soft disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
              >
                {salvataggio
                  ? MACCHINARI_TESTI.SALVATAGGIO
                  : macchinarioInModificaId
                    ? MACCHINARI_TESTI.MODIFICA
                    : MACCHINARI_TESTI.AGGIUNGI}
              </button>

              {macchinarioInModificaId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-industrial-border bg-industrial-control px-4 py-3 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
                >
                  {MACCHINARI_TESTI.ANNULLA}
                </button>
              )}
            </div>
          </form>

          <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  {MACCHINARI_TESTI.LISTA_ANAGRAFICA}
                </h2>
                <p className="mt-1 text-sm text-industrial-muted">
                  {loading
                    ? MACCHINARI_TESTI.CARICAMENTO
                    : `${macchinari.length} macchinari`}
                </p>
              </div>
            </div>

            {!loading && macchinari.length === 0 && (
              <p className="rounded-lg border border-industrial-border-soft bg-industrial-bg-soft p-4 text-sm text-industrial-muted">
                {MACCHINARI_TESTI.NESSUNO_ANAGRAFICA}
              </p>
            )}

            {macchinari.length > 0 && (
              <div className="space-y-3">
                {macchinari.map((macchinario) => (
                  <article
                    key={macchinario.id}
                    className="rounded-lg border border-industrial-border-soft bg-industrial-bg-soft p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-industrial-text">
                          {macchinario.nome}
                        </h3>
                        <p className="mt-1 text-sm text-industrial-muted">
                          {getTipoLabel(macchinario.tipo)}
                        </p>
                        {macchinario.descrizione && (
                          <p className="mt-1 text-sm text-industrial-muted">
                            {macchinario.descrizione}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-industrial-muted">
                          {macchinario.attivo
                            ? MACCHINARI_TESTI.ATTIVO
                            : MACCHINARI_TESTI.DISATTIVO}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-industrial-text">
                          {macchinario.costo_orario === null
                            ? "-"
                            : new Intl.NumberFormat(
                                "it-IT",
                                {
                                  style: "currency",
                                  currency: "EUR",
                                }
                              ).format(
                                macchinario.costo_orario
                              )}
                        </p>
                        <p className="mt-1 text-xs text-industrial-muted">
                          {MACCHINARI_TESTI.COSTO_ORARIO_VISIBILE}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          avviaModifica(macchinario)
                        }
                        className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
                      >
                        {MACCHINARI_TESTI.MODIFICA}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleElimina(macchinario)
                        }
                        className="rounded-lg border border-industrial-danger-border bg-industrial-danger-bg px-3 py-2 text-sm font-semibold text-industrial-danger-text transition-colors duration-200 ease-out hover:border-industrial-danger-text"
                      >
                        {MACCHINARI_TESTI.ELIMINA}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
