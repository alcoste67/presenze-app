"use client";

import Link from "next/link";
import type {
  ChangeEvent,
  FormEvent,
} from "react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  LAVORAZIONI_IMPORT,
  LAVORAZIONI_LIMITI,
  LAVORAZIONI_TESTI,
} from "@/constants/lavorazioni";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { aggiornaLavorazioneCantiere } from "@/services/lavorazioni/aggiornaLavorazioneCantiere";
import { creaLavorazioneCantiere } from "@/services/lavorazioni/creaLavorazioneCantiere";
import { creaLavorazioniCantiere } from "@/services/lavorazioni/creaLavorazioniCantiere";
import { estraiLavorazioniDaComputo } from "@/services/lavorazioni/estraiLavorazioniDaComputo";
import { loadLavorazioniCantiere } from "@/services/lavorazioni/loadLavorazioniCantiere";
import type { CantiereBackoffice } from "@/types/cantieri";
import type {
  LavorazioneCantiere,
  LavorazioneCantiereInput,
  LavorazioneCantiereUpdate,
  LavorazioneImportPreview,
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

function normalizzaNomeLavorazione(
  nome: string
) {
  return nome.trim().replace(/\s+/g, " ");
}

function getChiaveNome(nome: string) {
  return normalizzaNomeLavorazione(
    nome
  ).toLowerCase();
}

function normalizzaPreviewImport(
  lavorazioniImport: LavorazioneImportPreview[],
  lavorazioniEsistenti: LavorazioneCantiere[]
) {
  const nomiUsati = new Set(
    lavorazioniEsistenti.map((lavorazione) =>
      getChiaveNome(lavorazione.nome)
    )
  );

  return [...lavorazioniImport]
    .sort((a, b) => a.ordine - b.ordine)
    .map((lavorazione) =>
      normalizzaNomeLavorazione(
        lavorazione.nome
      )
    )
    .filter((nome) => {
      const chiave = getChiaveNome(nome);

      if (!chiave || nomiUsati.has(chiave)) {
        return false;
      }

      nomiUsati.add(chiave);
      return true;
    })
    .slice(
      0,
      LAVORAZIONI_LIMITI.IMPORT_MAX_LAVORAZIONI
    )
    .map((nome, index) => ({
      nome,
      ordine: index + 1,
    }));
}

function getProssimoOrdine(
  lavorazioni: LavorazioneCantiere[]
) {
  if (lavorazioni.length === 0) {
    return 1;
  }

  return (
    Math.max(
      ...lavorazioni.map(
        (lavorazione) =>
          lavorazione.ordine
      )
    ) + 1
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
    fileComputo,
    setFileComputo,
  ] = useState<File | null>(null);
  const [
    previewImport,
    setPreviewImport,
  ] = useState<LavorazioneImportPreview[]>([]);
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
  const [
    estrazioneImport,
    setEstrazioneImport,
  ] = useState(false);
  const [
    salvataggioImport,
    setSalvataggioImport,
  ] = useState(false);
  const [errore, setErrore] = useState<
    string | null
  >(null);
  const [messaggio, setMessaggio] =
    useState<string | null>(null);

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setLavorazioneInModificaId(null);
  };

  const resetImport = () => {
    setFileComputo(null);
    setPreviewImport([]);
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
    resetImport();
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

  const handleFileComputoChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0] || null;

    setFileComputo(file);
    setPreviewImport([]);
    setErrore(null);
    setMessaggio(null);
  };

  const handleEstraiLavorazioniImport =
    async () => {
      if (!cantiereId) {
        setErrore(
          LAVORAZIONI_TESTI.ERRORI
            .CANTIERE_OBBLIGATORIO
        );
        return;
      }

      if (!fileComputo) {
        setErrore(
          LAVORAZIONI_TESTI.ERRORI
            .FILE_CSV_OBBLIGATORIO
        );
        return;
      }

      try {
        setEstrazioneImport(true);
        setErrore(null);
        setMessaggio(null);

        const lavorazioniEstratte =
          await estraiLavorazioniDaComputo(
            fileComputo
          );
        const preview =
          normalizzaPreviewImport(
            lavorazioniEstratte,
            lavorazioni
          );

        if (preview.length === 0) {
          setPreviewImport([]);
          setErrore(
            LAVORAZIONI_TESTI.ERRORI
              .NESSUNA_LAVORAZIONE_IMPORT
          );
          return;
        }

        setPreviewImport(preview);
        setMessaggio(
          LAVORAZIONI_TESTI.MESSAGGI
            .IMPORT_PRONTO
        );
      } catch (error: unknown) {
        setErrore(getMessaggioErrore(error));
      } finally {
        setEstrazioneImport(false);
      }
    };

  const aggiornaPreviewImport = (
    index: number,
    lavorazione: LavorazioneImportPreview
  ) => {
    setPreviewImport((previewCorrente) =>
      previewCorrente.map(
        (lavorazioneCorrente, currentIndex) =>
          currentIndex === index
            ? lavorazione
            : lavorazioneCorrente
      )
    );
    setErrore(null);
  };

  const rimuoviPreviewImport = (
    index: number
  ) => {
    setPreviewImport((previewCorrente) =>
      previewCorrente
        .filter(
          (_lavorazione, currentIndex) =>
            currentIndex !== index
        )
        .map((lavorazione, nextIndex) => ({
          ...lavorazione,
          ordine: nextIndex + 1,
        }))
    );
    setErrore(null);
  };

  const confermaImportLavorazioni =
    async () => {
      if (!cantiereId) {
        setErrore(
          LAVORAZIONI_TESTI.ERRORI
            .CANTIERE_OBBLIGATORIO
        );
        return;
      }

      const preview =
        normalizzaPreviewImport(
          previewImport,
          lavorazioni
        );

      if (preview.length === 0) {
        setErrore(
          LAVORAZIONI_TESTI.ERRORI
            .IMPORT_NON_VALIDO
        );
        return;
      }

      try {
        setSalvataggioImport(true);
        setErrore(null);
        setMessaggio(null);

        const nuoveLavorazioni =
          await creaLavorazioniCantiere({
            cantiereId,
            lavorazioni: preview,
            ordineIniziale:
              getProssimoOrdine(lavorazioni),
          });

        setLavorazioni(
          (lavorazioniCorrenti) =>
            ordinaLavorazioni([
              ...lavorazioniCorrenti,
              ...nuoveLavorazioni,
            ])
        );
        setPercentualiDraft(
          (percentualiCorrenti) => ({
            ...percentualiCorrenti,
            ...getPercentualiDraft(
              nuoveLavorazioni
            ),
          })
        );
        resetImport();
        setMessaggio(
          LAVORAZIONI_TESTI.MESSAGGI
            .IMPORT_COMPLETATO
        );
      } catch (error: unknown) {
        setErrore(getMessaggioErrore(error));
      } finally {
        setSalvataggioImport(false);
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
  const bloccoImport =
    estrazioneImport || salvataggioImport;

  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
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
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {LAVORAZIONI_TESTI.BACKOFFICE}
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {LAVORAZIONI_TESTI.TIMBRATURE}
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

        <section className="mb-6 rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
          <label className="block max-w-xl">
            <span className="mb-1 block text-sm font-medium text-industrial-muted">
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
              className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
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

        {!loadingCantieri &&
          cantieri.length > 0 && (
            <section className="mb-6 rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-semibold">
                  {
                    LAVORAZIONI_TESTI.IMPORTA_COMPUTO
                  }
                </h2>

                {previewImport.length > 0 && (
                  <button
                    type="button"
                    onClick={resetImport}
                    disabled={bloccoImport}
                    className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
                  >
                    {LAVORAZIONI_TESTI.ANNULLA}
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <label className="block flex-1">
                  <span className="mb-1 block text-sm font-medium text-industrial-muted">
                    {
                      LAVORAZIONI_TESTI.FILE_COMPUTO
                    }
                  </span>
                  <input
                    type="file"
                    accept={
                      LAVORAZIONI_IMPORT.FILE_ACCEPT
                    }
                    onChange={
                      handleFileComputoChange
                    }
                    disabled={
                      !cantiereId || bloccoImport
                    }
                    className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                  />
                </label>

                <button
                  type="button"
                  onClick={() =>
                    void handleEstraiLavorazioniImport()
                  }
                  disabled={
                    !cantiereId ||
                    !fileComputo ||
                    bloccoImport
                  }
                  className="rounded-lg border border-industrial-orange bg-industrial-orange px-4 py-3 font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover active:border-industrial-orange-active active:bg-industrial-orange-active disabled:bg-industrial-border disabled:text-industrial-muted"
                >
                  {estrazioneImport
                    ? LAVORAZIONI_TESTI.ESTRAZIONE
                    : LAVORAZIONI_TESTI.ESTRAI_LAVORAZIONI}
                </button>
              </div>

              {previewImport.length > 0 && (
                <div className="mt-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold">
                      {
                        LAVORAZIONI_TESTI.ANTEPRIMA_IMPORT
                      }
                    </h3>

                    <button
                      type="button"
                      onClick={() =>
                        void confermaImportLavorazioni()
                      }
                      disabled={
                        bloccoImport ||
                        previewImport.length === 0
                      }
                      className="rounded-lg border border-industrial-success-text bg-industrial-success-text px-4 py-2 font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange hover:bg-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active disabled:bg-industrial-border disabled:text-industrial-muted"
                    >
                      {salvataggioImport
                        ? LAVORAZIONI_TESTI.SALVATAGGIO
                        : LAVORAZIONI_TESTI.CONFERMA_IMPORT}
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-industrial-border-soft text-industrial-muted">
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
                          <th className="py-3 text-right font-semibold">
                            {
                              LAVORAZIONI_TESTI.AZIONI
                            }
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {previewImport.map(
                          (
                            lavorazione,
                            index
                          ) => (
                            <tr
                              key={`${lavorazione.ordine}-${index}`}
                              className="border-b border-industrial-border-soft last:border-b-0"
                            >
                              <td className="py-3 pr-4">
                                <input
                                  type="number"
                                  min="1"
                                  value={
                                    lavorazione.ordine
                                  }
                                  onChange={(
                                    event
                                  ) => {
                                    const ordine =
                                      Number(
                                        event
                                          .target
                                          .value
                                      );

                                    aggiornaPreviewImport(
                                      index,
                                      {
                                        ...lavorazione,
                                        ordine:
                                          Number.isInteger(
                                            ordine
                                          )
                                            ? ordine
                                            : LAVORAZIONI_LIMITI.ORDINE_DEFAULT,
                                      }
                                    );
                                  }}
                                  disabled={
                                    bloccoImport
                                  }
                                  className="w-24 rounded-lg border border-industrial-border bg-industrial-control p-2 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                                />
                              </td>
                              <td className="py-3 pr-4">
                                <input
                                  value={
                                    lavorazione.nome
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    aggiornaPreviewImport(
                                      index,
                                      {
                                        ...lavorazione,
                                        nome: event
                                          .target
                                          .value,
                                      }
                                    )
                                  }
                                  disabled={
                                    bloccoImport
                                  }
                                  className="w-full min-w-64 rounded-lg border border-industrial-border bg-industrial-control p-2 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                                />
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    rimuoviPreviewImport(
                                      index
                                    )
                                  }
                                  disabled={
                                    bloccoImport
                                  }
                                  className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
                                >
                                  {
                                    LAVORAZIONI_TESTI.RIMUOVI
                                  }
                                </button>
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

        {loadingCantieri && (
          <p className="text-industrial-muted">
            {LAVORAZIONI_TESTI.CARICAMENTO}
          </p>
        )}

        {!loadingCantieri &&
          cantieri.length === 0 && (
            <p className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-muted shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
              {
                LAVORAZIONI_TESTI.NESSUN_CANTIERE
              }
            </p>
          )}

        {!loadingCantieri &&
          cantieri.length > 0 && (
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
                      className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-industrial-muted">
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
                      className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-industrial-muted">
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
                      className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                    />
                  </label>

                  <label className="flex items-center gap-3 text-sm font-medium text-industrial-muted">
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
                      className="rounded-lg border border-industrial-orange bg-industrial-orange px-4 py-3 font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover active:border-industrial-orange-active active:bg-industrial-orange-active disabled:bg-industrial-border disabled:text-industrial-muted"
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
                        className="rounded-lg border border-industrial-border bg-industrial-control px-4 py-3 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
                      >
                        {LAVORAZIONI_TESTI.ANNULLA}
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
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
                    className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
                  >
                    {LAVORAZIONI_TESTI.AGGIORNA}
                  </button>
                </div>

                {loadingLavorazioni && (
                  <p className="text-industrial-muted">
                    {
                      LAVORAZIONI_TESTI.CARICAMENTO
                    }
                  </p>
                )}

                {!loadingLavorazioni &&
                  lavorazioni.length === 0 && (
                    <p className="text-industrial-muted">
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
                          <tr className="border-b border-industrial-border-soft text-industrial-muted">
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
                                className="border-b border-industrial-border-soft last:border-b-0"
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
                                      className="w-20 rounded-lg border border-industrial-border bg-industrial-control p-2 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
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
                                      className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
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
                                        ? "rounded-full bg-industrial-success-bg px-3 py-1 text-xs font-semibold text-industrial-success-text"
                                        : "rounded-full bg-industrial-bg-soft px-3 py-1 text-xs font-semibold text-industrial-muted"
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
                                      className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
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
                                      className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:text-industrial-muted-strong"
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
