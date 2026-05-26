"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { APP_ROUTES } from "@/constants/routes";
import {
  MACCHINARI_TESTI,
  TIPI_MACCHINARIO,
} from "@/constants/macchinari";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { aggiornaCostoMacchinarioCommessa } from "@/services/costiMacchinari/aggiornaCostoMacchinarioCommessa";
import { creaCostoMacchinarioCommessa } from "@/services/costiMacchinari/creaCostoMacchinarioCommessa";
import { eliminaCostoMacchinarioCommessa } from "@/services/costiMacchinari/eliminaCostoMacchinarioCommessa";
import { loadCostiMacchinariCommessa } from "@/services/costiMacchinari/loadCostiMacchinariCommessa";
import type { CantiereBackoffice } from "@/types/cantieri";
import type {
  CostoMacchinarioCommessa,
  TipoMacchinario,
} from "@/types/costiMacchinari";

type CostoForm = {
  tipo_macchinario: TipoMacchinario | "";
  data_utilizzo: string;
  ore_utilizzo: string;
  descrizione: string;
  tariffa_oraria: string;
  note: string;
};

const FORM_INIZIALE: CostoForm = {
  tipo_macchinario: "",
  data_utilizzo: getLocalDateIso(),
  ore_utilizzo: "",
  descrizione: "",
  tariffa_oraria: "",
  note: "",
};

function getMessaggioErrore(error: unknown) {
  return error instanceof Error
    ? error.message
    : MACCHINARI_TESTI.ERRORI.GENERICO;
}

function getLocalDateIso() {
  const data = new Date();
  const year = data.getFullYear();
  const month = String(
    data.getMonth() + 1
  ).padStart(2, "0");
  const day = String(data.getDate()).padStart(
    2,
    "0"
  );

  return `${year}-${month}-${day}`;
}

function parseNumeroDecimale(
  value: string
): number | null {
  const numero = Number(
    value.trim().replace(",", ".")
  );

  if (!Number.isFinite(numero)) {
    return null;
  }

  return numero;
}

function formattaEuro(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formattaData(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT").format(
    new Date(`${value}T00:00:00`)
  );
}

function preparaPayload({
  cantiereId,
  form,
}: {
  cantiereId: string;
  form: CostoForm;
}):
  | {
      payload: {
        cantiere_id: string;
        rapporto_intervento_id: string | null;
        tipo_macchinario: TipoMacchinario;
        descrizione: string;
        data_utilizzo: string;
        ore_utilizzo: number;
        tariffa_oraria: number | null;
        costo_totale: number | null;
        note: string;
      };
    }
  | { errore: string } {
  if (!cantiereId) {
    return {
      errore:
        MACCHINARI_TESTI.ERRORI.CANTIERE_OBBLIGATORIO,
    };
  }

  if (!form.tipo_macchinario) {
    return {
      errore:
        MACCHINARI_TESTI.ERRORI
          .TIPO_OBBLIGATORIO,
    };
  }

  if (!form.data_utilizzo) {
    return {
      errore:
        MACCHINARI_TESTI.ERRORI
          .DATA_OBBLIGATORIA,
    };
  }

  const oreUtilizzo = parseNumeroDecimale(
    form.ore_utilizzo
  );

  if (
    oreUtilizzo === null ||
    oreUtilizzo <= 0
  ) {
    return {
      errore:
        MACCHINARI_TESTI.ERRORI
          .ORE_NON_VALIDO,
    };
  }

  const tariffaOraria = form.tariffa_oraria.trim()
    ? parseNumeroDecimale(form.tariffa_oraria)
    : null;

  if (
    form.tariffa_oraria.trim() &&
    tariffaOraria === null
  ) {
    return {
      errore:
        MACCHINARI_TESTI.ERRORI
          .TARIFFA_NON_VALIDA,
    };
  }

  const costoTotale =
    tariffaOraria === null
      ? null
      : Math.round(
          oreUtilizzo * tariffaOraria * 100
        ) / 100;

  return {
    payload: {
      cantiere_id: cantiereId,
      rapporto_intervento_id: null,
      tipo_macchinario:
        form.tipo_macchinario,
      descrizione: form.descrizione.trim(),
      data_utilizzo: form.data_utilizzo,
      ore_utilizzo: oreUtilizzo,
      tariffa_oraria: tariffaOraria,
      costo_totale: costoTotale,
      note: form.note.trim(),
    },
  };
}

function getTitoloTipoMacchinario(
  tipo: TipoMacchinario
) {
  return MACCHINARI_TESTI.TIPI_LABEL[tipo];
}

function getTipoLabel(tipo: TipoMacchinario) {
  return getTitoloTipoMacchinario(tipo);
}

export default function BackofficeCostiMacchinariPage() {
  const [cantieri, setCantieri] = useState<
    CantiereBackoffice[]
  >([]);
  const [cantiereId, setCantiereId] =
    useState("");
  const [costi, setCosti] = useState<
    CostoMacchinarioCommessa[]
  >([]);
  const [form, setForm] =
    useState<CostoForm>(FORM_INIZIALE);
  const [costoInModificaId, setCostoInModificaId] =
    useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingCosti, setLoadingCosti] =
    useState(false);
  const [salvataggio, setSalvataggio] =
    useState(false);
  const [errore, setErrore] = useState<
    string | null
  >(null);
  const [messaggio, setMessaggio] = useState<
    string | null
  >(null);

  const cantiereSelezionato = useMemo(
    () =>
      cantieri.find(
        (cantiere) => cantiere.id === cantiereId
      ) || null,
    [cantieri, cantiereId]
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
        setCantiereId(dati[0]?.id || "");
      } catch (error: unknown) {
        if (attivo) {
          setErrore(
            getMessaggioErrore(error)
          );
        }
      } finally {
        if (attivo) {
          setLoading(false);
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

    const caricaCosti = async () => {
      if (!cantiereId) {
        setCosti([]);
        setLoadingCosti(false);
        return;
      }

      try {
        setLoadingCosti(true);
        setErrore(null);

        const dati =
          await loadCostiMacchinariCommessa({
            cantiereId,
          });

        if (!attivo) {
          return;
        }

        setCosti(dati);
      } catch (error: unknown) {
        if (attivo) {
          setErrore(
            getMessaggioErrore(error)
          );
        }
      } finally {
        if (attivo) {
          setLoadingCosti(false);
        }
      }
    };

    void caricaCosti();

    return () => {
      attivo = false;
    };
  }, [cantiereId]);

  const resetForm = () => {
    setForm({
      ...FORM_INIZIALE,
      data_utilizzo: getLocalDateIso(),
    });
    setCostoInModificaId(null);
  };

  const handleCantiereChange = (
    nextCantiereId: string
  ) => {
    setCantiereId(nextCantiereId);
    setErrore(null);
    setMessaggio(null);
    resetForm();
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

      if (costoInModificaId) {
        const costoAggiornato =
          await aggiornaCostoMacchinarioCommessa({
            costoId: costoInModificaId,
            costo: risultato.payload,
          });

        setCosti((costiCorrenti) =>
          costiCorrenti.map((costo) =>
            costo.id === costoAggiornato.id
              ? costoAggiornato
              : costo
          )
        );

        setMessaggio(
          MACCHINARI_TESTI.MESSAGGI.AGGIORNATO
        );
      } else {
        const nuovoCosto =
          await creaCostoMacchinarioCommessa({
            costo: risultato.payload,
          });

        setCosti((costiCorrenti) => [
          nuovoCosto,
          ...costiCorrenti,
        ]);

        setMessaggio(
          MACCHINARI_TESTI.MESSAGGI.CREATO
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
    costo: CostoMacchinarioCommessa
  ) => {
    setCostoInModificaId(costo.id);
    setForm({
      tipo_macchinario: costo.tipo_macchinario,
      data_utilizzo: costo.data_utilizzo,
      ore_utilizzo: String(costo.ore_utilizzo),
      descrizione: costo.descrizione,
      tariffa_oraria:
        costo.tariffa_oraria === null
          ? ""
          : String(costo.tariffa_oraria),
      note: costo.note,
    });
    setErrore(null);
    setMessaggio(null);
  };

  const handleElimina = async (
    costo: CostoMacchinarioCommessa
  ) => {
    if (
      !window.confirm(
        MACCHINARI_TESTI.CONFERMA_ELIMINAZIONE
      )
    ) {
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      await eliminaCostoMacchinarioCommessa({
        costoId: costo.id,
      });

      setCosti((costiCorrenti) =>
        costiCorrenti.filter(
          (item) => item.id !== costo.id
        )
      );

      setMessaggio(
        MACCHINARI_TESTI.MESSAGGI.ELIMINATO
      );

      if (costoInModificaId === costo.id) {
        resetForm();
      }
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const costoStimato = useMemo(() => {
    const ore = parseNumeroDecimale(
      form.ore_utilizzo
    );
    const tariffa = form.tariffa_oraria.trim()
      ? parseNumeroDecimale(form.tariffa_oraria)
      : null;

    if (ore === null || tariffa === null) {
      return null;
    }

    return Math.round(ore * tariffa * 100) / 100;
  }, [form.ore_utilizzo, form.tariffa_oraria]);

  const loadingTotale = loading || loadingCosti;

  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {MACCHINARI_TESTI.TITOLO}
            </h1>
            {cantiereSelezionato && (
              <p className="mt-1 text-sm text-industrial-muted">
                {cantiereSelezionato.nome}
              </p>
            )}
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

        <section className="mb-6 rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
          <label className="block max-w-xl">
            <span className="mb-1 block text-sm font-medium text-industrial-muted">
              {MACCHINARI_TESTI.CANTIERE}
            </span>
            <select
              value={cantiereId}
              onChange={(event) =>
                handleCantiereChange(
                  event.target.value
                )
              }
              disabled={loading}
              className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
            >
              <option value="">
                {MACCHINARI_TESTI.SELEZIONA_CANTIERE}
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

        <section className="mb-6 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 shadow-[0_12px_28px_rgb(36_38_43/0.08)]"
          >
            <div className="grid gap-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {MACCHINARI_TESTI.TIPO_MACCHINARIO}
                </span>
                <select
                  value={form.tipo_macchinario}
                  onChange={(event) =>
                    setForm((formCorrente) => ({
                      ...formCorrente,
                      tipo_macchinario: event.target
                        .value as TipoMacchinario | "",
                    }))
                  }
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                >
                  <option value="">
                    {MACCHINARI_TESTI.TIPO_MACCHINARIO}
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
                  {MACCHINARI_TESTI.DATA_UTILIZZO}
                </span>
                <input
                  type="date"
                  value={form.data_utilizzo}
                  onChange={(event) =>
                    setForm((formCorrente) => ({
                      ...formCorrente,
                      data_utilizzo:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {MACCHINARI_TESTI.ORE_UTILIZZO}
                </span>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={form.ore_utilizzo}
                  onChange={(event) =>
                    setForm((formCorrente) => ({
                      ...formCorrente,
                      ore_utilizzo:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {MACCHINARI_TESTI.DESCRIZIONE}
                </span>
                <input
                  type="text"
                  value={form.descrizione}
                  onChange={(event) =>
                    setForm((formCorrente) => ({
                      ...formCorrente,
                      descrizione:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {MACCHINARI_TESTI.NOTE}
                </span>
                <textarea
                  value={form.note}
                  onChange={(event) =>
                    setForm((formCorrente) => ({
                      ...formCorrente,
                      note: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {MACCHINARI_TESTI.TARIFFA_ORARIA}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.tariffa_oraria}
                  onChange={(event) =>
                    setForm((formCorrente) => ({
                      ...formCorrente,
                      tariffa_oraria:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {MACCHINARI_TESTI.COSTO_TOTALE}
                </span>
                <input
                  type="text"
                  value={formattaEuro(costoStimato)}
                  readOnly
                  className="w-full rounded-lg border border-industrial-border bg-industrial-surface-strong p-3 text-industrial-text outline-none"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={salvataggio || !cantiereId}
                className="rounded-lg border border-industrial-orange bg-industrial-orange px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover disabled:border-industrial-border-soft disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
              >
                {salvataggio
                  ? MACCHINARI_TESTI.SALVATAGGIO
                  : costoInModificaId
                    ? MACCHINARI_TESTI.MODIFICA
                    : MACCHINARI_TESTI.AGGIUNGI}
              </button>

              {costoInModificaId && (
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
                  {MACCHINARI_TESTI.LISTA}
                </h2>
                <p className="mt-1 text-sm text-industrial-muted">
                  {loadingCosti
                    ? MACCHINARI_TESTI.CARICAMENTO
                    : `${costi.length} ${MACCHINARI_TESTI.VOCI}`}
                </p>
              </div>

              <p className="max-w-sm text-xs text-industrial-muted">
                {MACCHINARI_TESTI.TARIFFA_VISIBILE}
                {" "}
                {MACCHINARI_TESTI.COSTO_VISIBILE}
              </p>
            </div>

            {loadingTotale && (
              <p className="text-sm text-industrial-muted">
                {MACCHINARI_TESTI.CARICAMENTO}
              </p>
            )}

            {!loadingTotale &&
              costi.length === 0 && (
                <p className="rounded-lg border border-industrial-border-soft bg-industrial-bg-soft p-4 text-sm text-industrial-muted">
                  {MACCHINARI_TESTI.NESSUNO}
                </p>
              )}

            {costi.length > 0 && (
              <div className="space-y-3">
                {costi.map((costo) => (
                  <article
                    key={costo.id}
                    className="rounded-lg border border-industrial-border-soft bg-industrial-bg-soft p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-industrial-text">
                          {getTipoLabel(
                            costo.tipo_macchinario
                          )}
                        </h3>
                        <p className="mt-1 text-sm text-industrial-muted">
                          {formattaData(
                            costo.data_utilizzo
                          )}
                          {" "}
                          - {costo.ore_utilizzo} h
                        </p>
                        {costo.descrizione && (
                          <p className="mt-1 text-sm text-industrial-muted">
                            {costo.descrizione}
                          </p>
                        )}
                        {costo.note && (
                          <p className="mt-1 text-xs text-industrial-muted">
                            {costo.note}
                          </p>
                        )}
                      </div>

                      <div className="text-right text-sm">
                        <p className="font-semibold text-industrial-text">
                          {formattaEuro(
                            costo.tariffa_oraria
                          )}
                        </p>
                        <p className="mt-1 text-industrial-muted">
                          {formattaEuro(
                            costo.costo_totale
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          avviaModifica(costo)
                        }
                        className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
                      >
                        {MACCHINARI_TESTI.MODIFICA}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleElimina(costo)
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
