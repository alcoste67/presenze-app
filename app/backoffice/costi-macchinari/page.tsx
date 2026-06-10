"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { APP_ROUTES } from "@/constants/routes";
import { MACCHINARI_TESTI } from "@/constants/macchinari";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { aggiornaCostoMacchinarioCommessa } from "@/services/costiMacchinari/aggiornaCostoMacchinarioCommessa";
import { creaCostoMacchinarioCommessa } from "@/services/costiMacchinari/creaCostoMacchinarioCommessa";
import { eliminaCostoMacchinarioCommessa } from "@/services/costiMacchinari/eliminaCostoMacchinarioCommessa";
import { loadCostiMacchinariCommessa } from "@/services/costiMacchinari/loadCostiMacchinariCommessa";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { loadMacchinariAdmin } from "@/services/macchinari/loadMacchinariAdmin";
import { loadMacchinariPubblici } from "@/services/macchinari/loadMacchinariPubblici";
import { getMessaggioErrore } from "@/lib/errors";
import type { CantiereBackoffice } from "@/types/cantieri";
import type {
  CostoMacchinarioCommessa,
  TipoMacchinario,
} from "@/types/costiMacchinari";
import type {
  Macchinario,
  MacchinarioPubblico,
} from "@/types/macchinari";

type CostoForm = {
  macchinario_id: string;
  tipo_macchinario: TipoMacchinario | "";
  data_utilizzo: string;
  ore_utilizzo: string;
  descrizione: string;
  note: string;
};

const FORM_INIZIALE: CostoForm = {
  macchinario_id: "",
  tipo_macchinario: "",
  data_utilizzo: getLocalDateIso(),
  ore_utilizzo: "",
  descrizione: "",
  note: "",
};


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
  macchinarioSelezionato,
  mostraCosti,
}: {
  cantiereId: string;
  form: CostoForm;
  macchinarioSelezionato:
    | Macchinario
    | MacchinarioPubblico
    | null;
  mostraCosti: boolean;
}):
  | {
      payload: {
        cantiere_id: string;
        rapporto_intervento_id: string | null;
        macchinario_id: string | null;
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

  const macchinarioId = form.macchinario_id || null;
  const tipoMacchinario = form.tipo_macchinario;

  if (!macchinarioId && !tipoMacchinario) {
    return {
      errore:
        MACCHINARI_TESTI.ERRORI
          .TIPO_OBBLIGATORIO,
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

  const tariffaOraria =
    mostraCosti &&
    macchinarioSelezionato &&
    "costo_orario" in macchinarioSelezionato
      ? macchinarioSelezionato.costo_orario
      : null;

  const costoTotale =
    !mostraCosti || tariffaOraria === null
      ? null
      : Math.round(
          oreUtilizzo * tariffaOraria * 100
        ) / 100;

  const descrizione =
    form.descrizione.trim() ||
    macchinarioSelezionato?.descrizione ||
    "";

  const tipoDaSalvare =
    tipoMacchinario ||
    macchinarioSelezionato?.tipo ||
    null;

  if (!tipoDaSalvare) {
    return {
      errore:
        MACCHINARI_TESTI.ERRORI
          .TIPO_OBBLIGATORIO,
    };
  }

  return {
    payload: {
      cantiere_id: cantiereId,
      rapporto_intervento_id: null,
      macchinario_id: macchinarioId,
      tipo_macchinario: tipoDaSalvare,
      descrizione,
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
  const [macchinariPubblici, setMacchinariPubblici] =
    useState<MacchinarioPubblico[]>([]);
  const [macchinariAdmin, setMacchinariAdmin] =
    useState<Macchinario[]>([]);
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
  const [loadingRuolo, setLoadingRuolo] =
    useState(true);
  const [loadingCosti, setLoadingCosti] =
    useState(false);
  const [loadingMacchinari, setLoadingMacchinari] =
    useState(false);
  const [salvataggio, setSalvataggio] =
    useState(false);
  const [errore, setErrore] = useState<
    string | null
  >(null);
  const [messaggio, setMessaggio] = useState<
    string | null
  >(null);
  const [isAdminUser, setIsAdminUser] =
    useState(false);

  const cantiereSelezionato = useMemo(
    () =>
      cantieri.find(
        (cantiere) => cantiere.id === cantiereId
      ) || null,
    [cantieri, cantiereId]
  );

  const macchinarioSelezionato = useMemo(() => {
    if (!form.macchinario_id) {
      return null;
    }

    if (isAdminUser) {
      return (
        macchinariAdmin.find(
          (macchinario) =>
            macchinario.id === form.macchinario_id
        ) || null
      );
    }

    return (
      macchinariPubblici.find(
        (macchinario) =>
          macchinario.id === form.macchinario_id
      ) || null
    );
  }, [
    form.macchinario_id,
    isAdminUser,
    macchinariAdmin,
    macchinariPubblici,
  ]);

  useEffect(() => {
    let attivo = true;

    const caricaRuolo = async () => {
      try {
        const user = await loadUtenteAuth();

        if (!attivo || !user?.email) {
          return;
        }

        const admin = await isAdmin(user.email);

        if (!attivo) {
          return;
        }

        setIsAdminUser(admin);
      } catch (error: unknown) {
        if (attivo) {
          setErrore(getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO));
        }
      } finally {
        if (attivo) {
          setLoadingRuolo(false);
        }
      }
    };

    void caricaRuolo();

    return () => {
      attivo = false;
    };
  }, []);

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
            getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO)
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

    const caricaMacchinari = async () => {
      try {
        setLoadingMacchinari(true);

        if (isAdminUser) {
          const dati = await loadMacchinariAdmin();

          if (!attivo) {
            return;
          }

          setMacchinariAdmin(dati);
          setMacchinariPubblici(
            dati.map((macchinario) => ({
              id: macchinario.id,
              nome: macchinario.nome,
              tipo: macchinario.tipo,
              descrizione: macchinario.descrizione,
              attivo: macchinario.attivo,
            }))
          );
          return;
        }

        const dati =
          await loadMacchinariPubblici();

        if (!attivo) {
          return;
        }

        setMacchinariPubblici(dati);
        setMacchinariAdmin([]);
      } catch (error: unknown) {
        if (attivo) {
          setErrore(
            getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO)
          );
        }
      } finally {
        if (attivo) {
          setLoadingMacchinari(false);
        }
      }
    };

    if (!loadingRuolo) {
      void caricaMacchinari();
    }

    return () => {
      attivo = false;
    };
  }, [isAdminUser, loadingRuolo]);

  const caricaCosti = useCallback(async () => {
    if (!cantiereId) {
      setCosti([]);
      return;
    }

    try {
      setLoadingCosti(true);
      setErrore(null);

      const dati = await loadCostiMacchinariCommessa({
        cantiereId,
        includeCosti: isAdminUser,
      });

      setCosti(
        dati as CostoMacchinarioCommessa[]
      );
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO));
    } finally {
      setLoadingCosti(false);
    }
  }, [cantiereId, isAdminUser]);

  useEffect(() => {
    if (loadingRuolo) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void caricaCosti();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [caricaCosti, loadingRuolo]);

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

  const handleMacchinarioChange = (
    nextMacchinarioId: string
  ) => {
    const nextMacchinario =
      isAdminUser
        ? macchinariAdmin.find(
            (macchinario) =>
              macchinario.id === nextMacchinarioId
          )
        : macchinariPubblici.find(
            (macchinario) =>
              macchinario.id === nextMacchinarioId
          );

    setForm((corrente) => ({
      ...corrente,
      macchinario_id: nextMacchinarioId,
      tipo_macchinario:
        nextMacchinario?.tipo ||
        corrente.tipo_macchinario,
      descrizione:
        corrente.descrizione ||
        nextMacchinario?.descrizione ||
        "",
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const risultato = preparaPayload({
      cantiereId,
      form,
      macchinarioSelezionato,
      mostraCosti: isAdminUser,
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
        await aggiornaCostoMacchinarioCommessa({
          costoId: costoInModificaId,
          costo: risultato.payload,
          includeCosti: isAdminUser,
        });
        setMessaggio(
          MACCHINARI_TESTI.MESSAGGI.AGGIORNATO
        );
      } else {
        await creaCostoMacchinarioCommessa({
          costo: risultato.payload,
          includeCosti: isAdminUser,
        });
        setMessaggio(
          MACCHINARI_TESTI.MESSAGGI.CREATO
        );
      }

      await caricaCosti();
      resetForm();
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggio(false);
    }
  };

  const avviaModifica = (
    costo: CostoMacchinarioCommessa
  ) => {
    setCostoInModificaId(costo.id);
    setForm({
      macchinario_id: costo.macchinario_id || "",
      tipo_macchinario: costo.tipo_macchinario,
      data_utilizzo: costo.data_utilizzo,
      ore_utilizzo: String(costo.ore_utilizzo),
      descrizione: costo.descrizione,
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
      setMessaggio(
        MACCHINARI_TESTI.MESSAGGI.ELIMINATO
      );

      if (costoInModificaId === costo.id) {
        resetForm();
      }

      await caricaCosti();
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error, MACCHINARI_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggio(false);
    }
  };

  const costoStimato = useMemo(() => {
    if (!isAdminUser) {
      return null;
    }

    const ore = parseNumeroDecimale(
      form.ore_utilizzo
    );
    const tariffa =
      (macchinarioSelezionato as
        | Macchinario
        | null)?.costo_orario ?? null;

    if (ore === null || tariffa === null) {
      return null;
    }

    return Math.round(ore * tariffa * 100) / 100;
  }, [
    form.ore_utilizzo,
    isAdminUser,
    macchinarioSelezionato,
  ]);

  const loadingTotale =
    loading || loadingRuolo || loadingCosti || loadingMacchinari;

  return (
    <main className="min-h-dvh bg-bg-base p-6 text-text-primary">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-[28px] font-medium text-text-primary">
              {MACCHINARI_TESTI.TITOLO}
            </h1>
            {cantiereSelezionato && (
              <p className="mt-1 text-sm text-text-muted">
                {cantiereSelezionato.nome}
              </p>
            )}
          </div>

          <div className="flex gap-4 text-sm font-semibold">
            <Link
              href={APP_ROUTES.BACKOFFICE}
              className="rounded-md border border-border bg-bg-card px-3 py-2 text-text-primary transition-colors duration-150 hover:bg-bg-subtle"
            >
              {MACCHINARI_TESTI.BACKOFFICE}
            </Link>
            <Link
              href="/"
              className="rounded-md border border-border bg-bg-card px-3 py-2 text-text-primary transition-colors duration-150 hover:bg-bg-subtle"
            >
              {MACCHINARI_TESTI.TIMBRATURE}
            </Link>
          </div>
        </div>

        {errore && (
          <p className="mb-4 rounded-md bg-error-50 p-4 text-sm text-error-500">
            {errore}
          </p>
        )}

        {messaggio && (
          <p className="mb-4 rounded-md bg-success-50 p-4 text-sm text-success-500">
            {messaggio}
          </p>
        )}

        <section className="mb-6 rounded-lg border border-border bg-bg-card p-5">
          <label className="block max-w-xl">
            <span className="mb-1 block text-sm font-medium text-text-muted">
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
              className="w-full min-w-0 box-border rounded-md border border-border bg-bg-card p-3 text-text-primary outline-none transition-colors duration-150 focus:border-brand-500 disabled:bg-bg-subtle"
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
            className="rounded-lg border border-border bg-bg-card p-5"
          >
            <div className="grid gap-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text-muted">
                  {MACCHINARI_TESTI.MACCHINARIO}
                </span>
                <select
                  value={form.macchinario_id}
                  onChange={(event) =>
                    handleMacchinarioChange(
                      event.target.value
                    )
                  }
                  disabled={loadingMacchinari || loadingRuolo}
                  className="w-full rounded-md border border-border bg-bg-card p-3 text-text-primary outline-none transition-colors duration-150 focus:border-brand-500 disabled:bg-bg-subtle"
                >
                  <option value="">
                    {MACCHINARI_TESTI.SELEZIONA_MACCHINARIO}
                  </option>
                  {(isAdminUser
                    ? macchinariAdmin
                    : macchinariPubblici
                  ).map((macchinario) => (
                    <option
                      key={macchinario.id}
                      value={macchinario.id}
                    >
                      {macchinario.nome} -{" "}
                      {getTipoLabel(macchinario.tipo)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text-muted">
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
                  className="form-field"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text-muted">
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
                  className="w-full rounded-md border border-border bg-bg-card p-3 text-text-primary outline-none transition-colors duration-150 focus:border-brand-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text-muted">
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
                  className="w-full rounded-md border border-border bg-bg-card p-3 text-text-primary outline-none transition-colors duration-150 focus:border-brand-500"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-text-muted">
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
                  className="w-full rounded-md border border-border bg-bg-card p-3 text-text-primary outline-none transition-colors duration-150 focus:border-brand-500"
                />
              </label>

              {isAdminUser && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-text-muted">
                      {MACCHINARI_TESTI.TARIFFA_ORARIA}
                    </span>
                    <input
                      type="text"
                      value={formattaEuro(
                        (macchinarioSelezionato as
                          | Macchinario
                          | null)?.costo_orario ?? null
                      )}
                      readOnly
                      className="w-full rounded-md border border-border bg-bg-subtle p-3 text-text-primary outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-text-muted">
                      {MACCHINARI_TESTI.COSTO_TOTALE}
                    </span>
                    <input
                      type="text"
                      value={formattaEuro(costoStimato)}
                      readOnly
                      className="w-full rounded-md border border-border bg-bg-subtle p-3 text-text-primary outline-none"
                    />
                  </label>
                </>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={salvataggio || !cantiereId}
                className="rounded-md bg-brand-500 px-4 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="rounded-md border border-border bg-bg-card px-4 py-3 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-bg-subtle"
                >
                  {MACCHINARI_TESTI.ANNULLA}
                </button>
              )}
            </div>
          </form>

          <section className="rounded-lg border border-border bg-bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-medium">
                  {MACCHINARI_TESTI.LISTA}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {loadingCosti
                    ? MACCHINARI_TESTI.CARICAMENTO
                    : `${costi.length} ${MACCHINARI_TESTI.VOCI}`}
                </p>
              </div>

              {isAdminUser && (
                <p className="max-w-sm text-xs text-text-muted">
                  {MACCHINARI_TESTI.TARIFFA_VISIBILE}
                  {" "}
                  {MACCHINARI_TESTI.COSTO_VISIBILE}
                </p>
              )}
            </div>

            {loadingTotale && (
              <p className="text-sm text-text-muted">
                {MACCHINARI_TESTI.CARICAMENTO}
              </p>
            )}

            {!loadingTotale &&
              costi.length === 0 && (
                <p className="rounded-md border border-border bg-bg-subtle p-4 text-sm text-text-muted">
                  {MACCHINARI_TESTI.NESSUNO}
                </p>
              )}

            {costi.length > 0 && (
              <div className="space-y-3">
                {costi.map((costo) => (
                  <article
                    key={costo.id}
                    className="rounded-md border border-border bg-bg-subtle p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-text-primary">
                          {(() => {
                            const macchinario =
                              (isAdminUser
                                ? macchinariAdmin
                                : macchinariPubblici
                              ).find(
                                (item) =>
                                  item.id ===
                                  costo.macchinario_id
                              );

                            return macchinario
                              ? `${macchinario.nome} - ${getTipoLabel(macchinario.tipo)}`
                              : getTipoLabel(
                                  costo.tipo_macchinario
                                );
                          })()}
                        </h3>
                        <p className="mt-1 text-sm text-text-muted">
                          {formattaData(
                            costo.data_utilizzo
                          )}
                          {" "}
                          - {costo.ore_utilizzo} h
                        </p>
                        {costo.descrizione && (
                          <p className="mt-1 text-sm text-text-muted">
                            {costo.descrizione}
                          </p>
                        )}
                        {costo.note && (
                          <p className="mt-1 text-xs text-text-muted">
                            {costo.note}
                          </p>
                        )}
                      </div>

                      {isAdminUser && (
                        <div className="text-right text-sm">
                          <p className="font-semibold text-text-primary">
                            {formattaEuro(
                              costo.tariffa_oraria
                            )}
                          </p>
                          <p className="mt-1 text-text-muted">
                            {formattaEuro(
                              costo.costo_totale
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          avviaModifica(costo)
                        }
                        className="rounded-md border border-border bg-bg-card px-3 py-2 text-sm font-medium text-text-primary transition-colors duration-150 hover:bg-bg-subtle"
                      >
                        {MACCHINARI_TESTI.MODIFICA}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void handleElimina(costo)
                        }
                        className="rounded-md border border-error-500/30 bg-error-50 px-3 py-2 text-sm font-medium text-error-500 transition-colors duration-150 hover:border-error-500"
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
