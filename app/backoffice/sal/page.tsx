"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { API_HEADERS } from "@/constants/api";
import { REPORT_PRESENZE_TESTI } from "@/constants/reportPresenze";
import {
  SAL_STATI,
  SAL_TESTI,
} from "@/constants/sal";
import { supabase } from "@/lib/supabase";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { creaSalLavorazioniFoto } from "@/services/sal/creaSalLavorazioniFoto";
import { loadSalLavorazioniFoto } from "@/services/sal/loadSalLavorazioniFoto";
import { loadSalCantiere } from "@/services/lavorazioni/loadSalCantiere";
import type { CantiereBackoffice } from "@/types/cantieri";
import type {
  SalLavorazioneFoto,
  SalCantiere,
  SalLavorazione,
  StatoSalLavorazione,
} from "@/types/sal";

function getMessaggioErrore(error: unknown) {
  return error instanceof Error
    ? error.message
    : SAL_TESTI.ERRORI.GENERICO;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function leggiMessaggioErrorePdf(
  response: Response
) {
  try {
    const payload = await response.json();

    if (
      isRecord(payload) &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  } catch {
    return SAL_TESTI.ERRORI.GENERICO;
  }

  return SAL_TESTI.ERRORI.GENERICO;
}

function getNomeFilePdf(response: Response) {
  const contentDisposition =
    response.headers.get("Content-Disposition") ||
    "";
  const match = /filename="([^"]+)"/.exec(
    contentDisposition
  );

  return match?.[1] || "SAL.pdf";
}

function scaricaBlobPdf({
  blob,
  nomeFile,
}: {
  blob: Blob;
  nomeFile: string;
}) {
  const url = URL.createObjectURL(blob);
  const link =
    document.createElement("a");

  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

  return `${ore}${SAL_TESTI.UNITA_ORA} ${minuti}${SAL_TESTI.UNITA_MINUTO}`;
}

function formattaDataIso(data: Date) {
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

function getDataOggi() {
  return formattaDataIso(new Date());
}

function formattaDataBreve(data: string) {
  if (!data) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT").format(
    new Date(`${data}T00:00:00`)
  );
}

function BarraProgresso({
  percentuale,
}: {
  percentuale: number;
}) {
  return (
    <div className="h-3 w-full overflow-hidden rounded-full bg-industrial-border-soft">
      <div
        className="h-full rounded-full bg-industrial-orange"
        style={{
          width: `${percentuale}%`,
        }}
      />
    </div>
  );
}

function RigaLavorazione({
  lavorazione,
}: {
  lavorazione: SalLavorazione;
}) {
  return (
    <li className="rounded-lg border border-industrial-border-soft bg-industrial-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-industrial-text">
            {lavorazione.nome}
          </h3>
          <p className="mt-1 text-sm text-industrial-muted">
            {SAL_TESTI.PERCENTUALE}:{" "}
            {
              lavorazione.percentuale_completamento
            }
            %
          </p>
          <p className="mt-1 text-sm text-industrial-muted">
            {SAL_TESTI.ORE_UOMO}:{" "}
            {formattaOreUomo(
              lavorazione.oreUomoMinuti
            )}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatoClassName(
            lavorazione.stato
          )}`}
        >
          {getStatoLabel(lavorazione.stato)}
        </span>
      </div>

      <div className="mt-4">
        <BarraProgresso
          percentuale={
            lavorazione.percentuale_completamento
          }
        />
      </div>
    </li>
  );
}

export default function BackofficeSalPage() {
  const [cantieri, setCantieri] = useState<
    CantiereBackoffice[]
  >([]);
  const [cantiereId, setCantiereId] =
    useState("");
  const [dataRiferimento, setDataRiferimento] =
    useState(getDataOggi());
  const [sal, setSal] =
    useState<SalCantiere | null>(null);
  const [fotoLavorazioni, setFotoLavorazioni] =
    useState<SalLavorazioneFoto[]>([]);
  const [fotoDaCaricare, setFotoDaCaricare] =
    useState<
      {
        localId: string;
        fileName: string;
        immagine_data_url: string;
      }[]
    >([]);
  const [fotoDescrizione, setFotoDescrizione] =
    useState("");
  const [fotoLavorazioneId, setFotoLavorazioneId] =
    useState("");
  const [loadingCantieri, setLoadingCantieri] =
    useState(true);
  const [loadingSal, setLoadingSal] =
    useState(false);
  const [loadingFoto, setLoadingFoto] =
    useState(false);
  const [salvataggioFoto, setSalvataggioFoto] =
    useState(false);
  const [loadingPdf, setLoadingPdf] =
    useState(false);
  const [errore, setErrore] = useState<
    string | null
  >(null);

  const lavorazioniById = useMemo(
    () =>
      new Map(
        sal?.lavorazioni.map((lavorazione) => [
          lavorazione.id,
          lavorazione,
        ]) || []
      ),
    [sal]
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

        const primoCantiereId =
          dati[0]?.id || "";

        setCantieri(dati);
        setCantiereId(primoCantiereId);
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

  useEffect(() => {
    let attivo = true;

    const caricaSalEFoto = async () => {
      if (!cantiereId) {
        setSal(null);
        setFotoLavorazioni([]);
        setLoadingSal(false);
        setLoadingFoto(false);
        return;
      }

      try {
        setLoadingSal(true);
        setLoadingFoto(true);
        setErrore(null);

        const [salCaricato, fotoCaricate] =
          await Promise.all([
            loadSalCantiere(cantiereId),
            loadSalLavorazioniFoto({
              cantiereId,
              dataRiferimento,
              limit: 12,
            }),
          ]);

        if (!attivo) {
          return;
        }

        setSal(salCaricato);
        setFotoLavorazioni(fotoCaricate);
      } catch (error: unknown) {
        if (attivo) {
          setErrore(
            getMessaggioErrore(error)
          );
        }
      } finally {
        if (attivo) {
          setLoadingSal(false);
          setLoadingFoto(false);
        }
      }
    };

    void caricaSalEFoto();

    return () => {
      attivo = false;
    };
  }, [cantiereId, dataRiferimento]);

  const handleCantiereChange = (
    nextCantiereId: string
  ) => {
    setCantiereId(nextCantiereId);
    setErrore(null);
    setFotoDaCaricare([]);
    setFotoDescrizione("");
    setFotoLavorazioneId("");
  };

  const handleDataRiferimentoChange = (
    nextDataRiferimento: string
  ) => {
    setDataRiferimento(nextDataRiferimento);
  };

  const leggiFileComeDataUrl = (
    file: File
  ) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(
          new Error(
            SAL_TESTI.ERRORI.GENERICO
          )
        );
      };

      reader.onerror = () => {
        reject(
          new Error(
            SAL_TESTI.ERRORI.GENERICO
          )
        );
      };

      reader.readAsDataURL(file);
    });

  const handleFotoInputChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(
      event.target.files || []
    );

    if (files.length === 0) {
      return;
    }

    try {
      const fotoDataUrl =
        await Promise.all(
          files.map(async (file) => {
            if (
              !file.type.startsWith("image/")
            ) {
              throw new Error(
                SAL_TESTI.ERRORI.GENERICO
              );
            }

            return leggiFileComeDataUrl(file);
          })
        );

      setFotoDaCaricare((fotoCorrenti) => [
        ...fotoCorrenti,
        ...fotoDataUrl.map(
          (immagineDataUrl, index) => ({
            localId: `${Date.now()}-${index}`,
            fileName: files[index]?.name || "",
            immagine_data_url:
              immagineDataUrl,
          })
        ),
      ]);
      event.target.value = "";
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    }
  };

  const handleEliminaFotoDaCaricare = (
    localId: string
  ) => {
    setFotoDaCaricare((fotoCorrenti) =>
      fotoCorrenti.filter(
        (foto) => foto.localId !== localId
      )
    );
  };

  const handleSalvaFoto = async () => {
    if (
      !cantiereId ||
      fotoDaCaricare.length === 0
    ) {
      return;
    }

    try {
      setSalvataggioFoto(true);
      setErrore(null);

      const fotoSalvate =
        await creaSalLavorazioniFoto({
          foto: fotoDaCaricare.map((foto) => ({
            cantiere_id: cantiereId,
            lavorazione_id:
              fotoLavorazioneId || null,
            timbratura_id: null,
            data_riferimento:
              dataRiferimento,
            immagine_data_url:
              foto.immagine_data_url,
            descrizione:
              fotoDescrizione.trim(),
          })),
        });

      setFotoLavorazioni((fotoCorrenti) => [
        ...fotoSalvate,
        ...fotoCorrenti,
      ].slice(0, 12));
      setFotoDaCaricare([]);
      setFotoDescrizione("");
      setFotoLavorazioneId("");
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggioFoto(false);
    }
  };

  const handleEsportaPdf = async () => {
    if (!cantiereId) {
      return;
    }

    try {
      setLoadingPdf(true);
      setErrore(null);

      const { data, error } =
        await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const accessToken =
        data.session?.access_token;

      if (!accessToken) {
        throw new Error(
          REPORT_PRESENZE_TESTI.ERRORI
            .SESSIONE_MANCANTE
        );
      }

      const response = await fetch(
        `/api/report/sal-pdf?cantiereId=${encodeURIComponent(cantiereId)}&dataRiferimento=${encodeURIComponent(dataRiferimento)}`,
        {
          headers: {
            [API_HEADERS.AUTHORIZATION]:
              `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          await leggiMessaggioErrorePdf(response)
        );
      }

      scaricaBlobPdf({
        blob: await response.blob(),
        nomeFile: getNomeFilePdf(response),
      });
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setLoadingPdf(false);
    }
  };

  const loading = loadingCantieri || loadingSal;

  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {SAL_TESTI.TITOLO}
            </h1>
          </div>

          <div className="flex gap-4 text-sm font-semibold">
            {cantiereId ? (
              <button
                type="button"
                onClick={handleEsportaPdf}
                disabled={loadingPdf}
                className="rounded-lg border border-industrial-orange bg-industrial-orange px-3 py-2 text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover active:border-industrial-orange-active active:bg-industrial-orange-active"
              >
                {loadingPdf
                  ? SAL_TESTI.CARICAMENTO
                  : SAL_TESTI.ESPORTA_PDF}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-lg border border-industrial-border-soft bg-industrial-surface-strong px-3 py-2 text-industrial-muted-strong"
              >
                {SAL_TESTI.ESPORTA_PDF}
              </button>
            )}
            <Link
              href="/backoffice"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {SAL_TESTI.BACKOFFICE}
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {SAL_TESTI.TIMBRATURE}
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
              {SAL_TESTI.CANTIERE}
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
                {SAL_TESTI.SELEZIONA_CANTIERE}
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

        <section className="mb-6 rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">
                {SAL_TESTI.FOTO_LAVORAZIONI}
              </h2>
              <p className="mt-1 text-sm text-industrial-muted">
                {SAL_TESTI.FOTO_CARICATE}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-industrial-muted">
                {SAL_TESTI.DATA_RIFERIMENTO}
              </span>
              <input
                type="date"
                value={dataRiferimento}
                onChange={(event) =>
                  handleDataRiferimentoChange(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {SAL_TESTI.SELEZIONA_LAVORAZIONE}
                </span>
                <select
                  value={fotoLavorazioneId}
                  onChange={(event) =>
                    setFotoLavorazioneId(
                      event.target.value
                    )
                  }
                  disabled={
                    loadingSal ||
                    sal?.lavorazioni.length === 0
                  }
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                >
                  <option value="">
                    {SAL_TESTI.SELEZIONA_LAVORAZIONE}
                  </option>
                  {sal?.lavorazioni.map(
                    (lavorazione) => (
                      <option
                        key={lavorazione.id}
                        value={lavorazione.id}
                      >
                        {lavorazione.nome}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {SAL_TESTI.DESCRIZIONE_FOTO}
                </span>
                <textarea
                  value={fotoDescrizione}
                  onChange={(event) =>
                    setFotoDescrizione(
                      event.target.value
                    )
                  }
                  rows={3}
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange"
                />
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block flex-1 min-w-[220px]">
              <span className="mb-1 block text-sm font-medium text-industrial-muted">
                {SAL_TESTI.CARICA_FOTO}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleFotoInputChange}
                className="block w-full rounded-lg border border-dashed border-industrial-border bg-industrial-control p-3 text-sm text-industrial-muted file:mr-3 file:rounded-md file:border-0 file:bg-industrial-orange file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-industrial-orange-hover"
              />
            </label>

            <button
              type="button"
              onClick={handleSalvaFoto}
              disabled={
                salvataggioFoto ||
                fotoDaCaricare.length === 0 ||
                !cantiereId
              }
              className="rounded-lg border border-industrial-orange bg-industrial-orange px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover disabled:border-industrial-border-soft disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
            >
              {salvataggioFoto
                ? SAL_TESTI.CARICAMENTO
                : SAL_TESTI.AGGIUNGI_FOTO}
            </button>
          </div>

          {fotoDaCaricare.length > 0 && (
            <div className="mt-5">
              <p className="mb-3 text-sm font-medium text-industrial-muted">
                {
                  SAL_TESTI.ANTEPRIMA_FOTO_SELEZIONATE
                }
              </p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {fotoDaCaricare.map((foto) => (
                  <div
                    key={foto.localId}
                    className="rounded-lg border border-industrial-border-soft bg-industrial-bg-soft p-3"
                  >
                    <Image
                      src={foto.immagine_data_url}
                      alt={foto.fileName}
                      width={640}
                      height={360}
                      unoptimized
                      className="h-40 w-full rounded-md object-cover"
                    />
                    <div className="mt-3 flex items-start justify-between gap-2">
                      <p className="text-xs text-industrial-muted">
                        {foto.fileName}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          handleEliminaFotoDaCaricare(
                            foto.localId
                          )
                        }
                        className="text-xs font-semibold text-industrial-orange transition-colors duration-200 ease-out hover:text-industrial-orange-hover"
                      >
                        {SAL_TESTI.RIMUOVI}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">
                {SAL_TESTI.GALLERIA_RECENTE}
              </h3>
              {loadingFoto && (
                <span className="text-sm text-industrial-muted">
                  {SAL_TESTI.CARICAMENTO}
                </span>
              )}
            </div>

            {!loadingFoto &&
              fotoLavorazioni.length === 0 && (
                <p className="rounded-lg border border-industrial-border-soft bg-industrial-bg-soft p-4 text-sm text-industrial-muted">
                  {SAL_TESTI.NESSUNA_FOTO}
                </p>
              )}

            {fotoLavorazioni.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {fotoLavorazioni.map((foto) => (
                  <article
                    key={foto.id}
                    className="rounded-lg border border-industrial-border-soft bg-industrial-bg-soft p-3"
                  >
                    <Image
                      src={foto.immagine_data_url}
                      alt={foto.descrizione || foto.id}
                      width={640}
                      height={360}
                      unoptimized
                      className="h-44 w-full rounded-md object-cover"
                    />
                    <div className="mt-3 space-y-1">
                      <p className="text-sm font-medium text-industrial-text">
                        {foto.descrizione ||
                          SAL_TESTI.DESCRIZIONE_FOTO}
                      </p>
                      <p className="text-xs text-industrial-muted">
                        {formattaDataBreve(
                          foto.data_riferimento
                        )}
                        {foto.lavorazione_id &&
                          lavorazioniById.get(
                            foto.lavorazione_id
                          ) && (
                            <>
                              {" "}
                              -{" "}
                              {
                                lavorazioniById.get(
                                  foto.lavorazione_id
                                )?.nome
                              }
                            </>
                          )}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {loading && (
          <p className="text-industrial-muted">
            {SAL_TESTI.CARICAMENTO}
          </p>
        )}

        {!loadingCantieri &&
          cantieri.length === 0 && (
            <p className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-muted shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
              {SAL_TESTI.NESSUN_CANTIERE}
            </p>
          )}

        {!loading && sal && (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
              <p className="text-sm font-medium text-industrial-muted">
                {
                  SAL_TESTI.AVANZAMENTO_TOTALE
                }
              </p>
              <p className="mt-3 text-4xl font-bold">
                {sal.avanzamentoTotale}%
              </p>
              <p className="mt-3 text-sm font-medium text-industrial-muted">
                {SAL_TESTI.ORE_UOMO_TOTALI}:{" "}
                {formattaOreUomo(
                  sal.oreUomoTotaliMinuti
                )}
              </p>
              <div className="mt-4">
                <BarraProgresso
                  percentuale={
                    sal.avanzamentoTotale
                  }
                />
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-xl font-semibold">
                {SAL_TESTI.LAVORAZIONI_ATTIVE}
              </h2>

              {sal.lavorazioni.length === 0 ? (
                <p className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-muted shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
                  {
                    SAL_TESTI.NESSUNA_LAVORAZIONE
                  }
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {sal.lavorazioni.map(
                    (lavorazione) => (
                      <RigaLavorazione
                        key={lavorazione.id}
                        lavorazione={lavorazione}
                      />
                    )
                  )}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
