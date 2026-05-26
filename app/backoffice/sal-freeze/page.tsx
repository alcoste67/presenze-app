"use client";

import Link from "next/link";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import { SelectCantiere } from "@/components/cantieri/SelectCantiere";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { APP_ROUTES } from "@/constants/routes";
import { SAL_TESTI } from "@/constants/sal";
import {
  SAL_FREEZE_EXPORT,
  SAL_FREEZE_TESTI,
  SAL_FREEZE_STORAGE_BUCKET,
} from "@/constants/salFreeze";
import { supabase } from "@/lib/supabase";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadSalLavorazioniFoto } from "@/services/sal/loadSalLavorazioniFoto";
import { loadSalFreezeMensili } from "@/services/salFreeze/loadSalFreezeMensili";
import { loadSalFreezeDettaglio } from "@/services/salFreeze/loadSalFreezeDettaglio";
import type { CantiereBackoffice } from "@/types/cantieri";
import type { SalLavorazioneFoto } from "@/types/sal";
import type {
  SalFreezeDettaglio,
  SalFreezeMensile,
} from "@/types/salFreeze";

type RuoloUtente = "ADMIN" | "RESPONSABILE" | null;

function getLocalDateIso(data = new Date()) {
  const year = data.getFullYear();
  const month = String(data.getMonth() + 1).padStart(
    2,
    "0"
  );
  const day = String(data.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getPrimoGiornoMese(data = new Date()) {
  const mese = new Date(
    data.getFullYear(),
    data.getMonth(),
    1
  );

  return getLocalDateIso(mese);
}

function getUltimoGiornoMese(data = new Date()) {
  const mese = new Date(
    data.getFullYear(),
    data.getMonth() + 1,
    0
  );

  return getLocalDateIso(mese);
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

function getMessaggioErrore(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return SAL_FREEZE_TESTI.ERRORI.GENERICO;
}

function getMessaggioApi(
  payload: unknown
): string | null {
  if (!isRecord(payload)) {
    return null;
  }

  const errorMessage =
    typeof payload.errorMessage === "string"
      ? payload.errorMessage
      : typeof payload.errore === "string"
        ? payload.errore
        : typeof payload.error === "string"
          ? payload.error
          : null;

  const step =
    typeof payload.step === "string"
      ? payload.step
      : null;

  if (errorMessage && step) {
    return `${errorMessage}. Step: ${step}`;
  }

  if (errorMessage) {
    return errorMessage;
  }

  return null;
}

function getMessaggioErroreExportFallback(
  tipo: "pdf" | "excel"
) {
  return tipo === "pdf"
    ? SAL_FREEZE_TESTI.ERRORI.ESPORTAZIONE_PDF_FALLITA
    : SAL_FREEZE_TESTI.ERRORI.ESPORTAZIONE_EXCEL_FALLITA;
}

function getNomeFilePdf(response: Response) {
  const contentDisposition =
    response.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(
    contentDisposition
  );

  return (
    match?.[1] || SAL_FREEZE_EXPORT.PDF.DEFAULT_FILENAME
  );
}

function scaricaBlobPdf({
  blob,
  nomeFile,
}: {
  blob: Blob;
  nomeFile: string;
}) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formattaData(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT").format(
    new Date(`${value}T00:00:00`)
  );
}

function formattaDataConOra(value: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formattaOreUomo(minutiTotali: number) {
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;

  return `${ore}h ${minuti}m`;
}

function formattaDeltaPercentuale(value: number) {
  const segno = value > 0 ? "+" : "";

  return `${segno}${value.toFixed(0)}%`;
}

function getDeltaClassName(value: number) {
  if (value > 0) {
    return "bg-industrial-success-bg text-industrial-success-text";
  }

  if (value < 0) {
    return "bg-red-50 text-red-700";
  }

  return "bg-industrial-bg-soft text-industrial-muted";
}

function getFreezePeriodoLabel(
  freeze: SalFreezeMensile
) {
  return `${formattaData(freeze.period_start)} - ${formattaData(freeze.period_end)}`;
}

function isBucketPath(value: string) {
  return value.startsWith(
    `${SAL_FREEZE_STORAGE_BUCKET}/`
  );
}

function estraiPathStorage(value: string) {
  if (!isBucketPath(value)) {
    return null;
  }

  return value.slice(
    SAL_FREEZE_STORAGE_BUCKET.length + 1
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-4 shadow-[0_12px_28px_rgb(36_38_43/0.08)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-industrial-text">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-industrial-muted">
              {subtitle}
            </p>
          ) : null}
        </div>

        {action ? <div>{action}</div> : null}
      </div>

      {children}
    </section>
  );
}

function FreezeBadge({
  annullato,
}: {
  annullato: boolean;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${annullato ? "bg-red-50 text-red-700" : "bg-industrial-success-bg text-industrial-success-text"}`}
    >
      {annullato ? "Annullato" : "Attivo"}
    </span>
  );
}

export default function BackofficeSalFreezePage() {
  const [cantieri, setCantieri] = useState<
    CantiereBackoffice[]
  >([]);
  const [cantiereId, setCantiereId] =
    useState("");
  const [periodStart, setPeriodStart] = useState(
    getPrimoGiornoMese()
  );
  const [periodEnd, setPeriodEnd] = useState(
    getUltimoGiornoMese()
  );
  const [recentPhotos, setRecentPhotos] = useState<
    SalLavorazioneFoto[]
  >([]);
  const [selectedPhotoIds, setSelectedPhotoIds] =
    useState<string[]>([]);
  const [note, setNote] = useState("");
  const [freezeList, setFreezeList] = useState<
    SalFreezeMensile[]
  >([]);
  const [freezeSelezionatoId, setFreezeSelezionatoId] =
    useState("");
  const [freezeDettaglio, setFreezeDettaglio] =
    useState<SalFreezeDettaglio | null>(null);
  const [loadingCantieri, setLoadingCantieri] =
    useState(true);
  const [loadingDatiCantiere, setLoadingDatiCantiere] =
    useState(false);
  const [loadingDettaglio, setLoadingDettaglio] =
    useState(false);
  const [salvataggio, setSalvataggio] =
    useState(false);
  const [loadingPdf, setLoadingPdf] =
    useState(false);
  const [loadingExcel, setLoadingExcel] =
    useState(false);
  const [errore, setErrore] = useState<
    string | null
  >(null);
  const [erroreExport, setErroreExport] = useState<
    string | null
  >(null);
  const [messaggio, setMessaggio] = useState<
    string | null
  >(null);
  const [ruoloUtente, setRuoloUtente] =
    useState<RuoloUtente>(null);
  const [loadingRuolo, setLoadingRuolo] =
    useState(true);

  const puoCreareFreeze = ruoloUtente === "ADMIN";

  const fotoById = useMemo(
    () =>
      new Map(
        recentPhotos.map((foto) => [foto.id, foto])
      ),
    [recentPhotos]
  );

  const fotoSelezionate = useMemo(
    () =>
      selectedPhotoIds
        .map((photoId) => fotoById.get(photoId))
        .filter(
          (foto): foto is SalLavorazioneFoto =>
            Boolean(foto)
        ),
    [fotoById, selectedPhotoIds]
  );

  const cantiereSelezionato = useMemo(
    () =>
      cantieri.find(
        (cantiere) => cantiere.id === cantiereId
      ) || null,
    [cantieri, cantiereId]
  );

  const freezeDettaglioDaMostrare =
    freezeSelezionatoId && freezeDettaglio
      ? freezeDettaglio
      : null;

  const freezeSelezionatoAnnullato = Boolean(
    freezeDettaglioDaMostrare?.freeze.annullato_at
  );

  const caricaStoricoFreeze = async ({
    cantiereIdCorrente,
    freezeIdDaSelezionare,
  }: {
    cantiereIdCorrente: string;
    freezeIdDaSelezionare?: string | null;
  }): Promise<string | null> => {
    const freezeAggiornati =
      await loadSalFreezeMensili({
        cantiereId: cantiereIdCorrente,
      });

    setFreezeList(freezeAggiornati);

    if (freezeAggiornati.length === 0) {
      setFreezeSelezionatoId("");
      setFreezeDettaglio(null);
      return null;
    }

    const freezeIdValido =
      freezeIdDaSelezionare &&
      freezeAggiornati.some(
        (freeze) => freeze.id === freezeIdDaSelezionare
      )
        ? freezeIdDaSelezionare
        : freezeAggiornati[0].id;

    setFreezeSelezionatoId(freezeIdValido);

    return freezeIdValido;
  };

  useEffect(() => {
    let attivo = true;

    const caricaRuolo = async () => {
      try {
        const user = await loadUtenteAuth();

        if (!attivo) {
          return;
        }

        if (!user?.email) {
          setRuoloUtente(null);
          return;
        }

        const utenteAdmin = await isAdmin(user.email);

        if (!attivo) {
          return;
        }

        if (utenteAdmin) {
          setRuoloUtente("ADMIN");
          return;
        }

        const utenteResponsabile =
          await isResponsabile(user.email);

        if (!attivo) {
          return;
        }

        if (utenteResponsabile) {
          setRuoloUtente("RESPONSABILE");
          return;
        }

        setRuoloUtente(null);
      } catch (error: unknown) {
        if (attivo) {
          setErrore(getMessaggioErrore(error));
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
        const dati = await loadCantieriBackoffice();

        if (!attivo) {
          return;
        }

        setCantieri(dati);
      } catch (error: unknown) {
        if (attivo) {
          setErrore(getMessaggioErrore(error));
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

  const handleCantiereChange = (nextCantiereId: string) => {
    setCantiereId(nextCantiereId);
    setSelectedPhotoIds([]);
    setNote("");
    setRecentPhotos([]);
    setFreezeList([]);
    setFreezeSelezionatoId("");
    setFreezeDettaglio(null);
    setErrore(null);
    setMessaggio(null);
  };

  useEffect(() => {
    if (!cantiereId) {
      return;
    }

    let attivo = true;

    const caricaDati = async () => {
      try {
        setLoadingDatiCantiere(true);

        const [freeze, foto] = await Promise.all([
          loadSalFreezeMensili({
            cantiereId,
          }),
          puoCreareFreeze
            ? loadSalLavorazioniFoto({
                cantiereId,
                limit: 12,
              })
            : Promise.resolve([] as SalLavorazioneFoto[]),
        ]);

        if (!attivo) {
          return;
        }

        setFreezeList(freeze);
        setRecentPhotos(foto);

        if (freeze.length > 0) {
          setFreezeSelezionatoId((corrente) =>
            corrente && freeze.some((item) => item.id === corrente)
              ? corrente
              : freeze[0].id
          );
        } else {
          setFreezeSelezionatoId("");
          setFreezeDettaglio(null);
        }
      } catch (error: unknown) {
        if (attivo) {
          setErrore(getMessaggioErrore(error));
        }
      } finally {
        if (attivo) {
          setLoadingDatiCantiere(false);
        }
      }
    };

    void caricaDati();

    return () => {
      attivo = false;
    };
  }, [cantiereId, puoCreareFreeze]);

  useEffect(() => {
    if (!freezeSelezionatoId) {
      return;
    }

    let attivo = true;

    const caricaDettaglio = async () => {
      try {
        setLoadingDettaglio(true);
        const dettaglio = await loadSalFreezeDettaglio({
          freezeId: freezeSelezionatoId,
        });

        if (!attivo) {
          return;
        }

        setFreezeDettaglio(dettaglio);
      } catch (error: unknown) {
        if (attivo) {
          setErrore(getMessaggioErrore(error));
        }
      } finally {
        if (attivo) {
          setLoadingDettaglio(false);
        }
      }
    };

    void caricaDettaglio();

    return () => {
      attivo = false;
    };
  }, [freezeSelezionatoId]);

  const handleTogglePhoto = (photoId: string) => {
    setSelectedPhotoIds((correnti) => {
      if (correnti.includes(photoId)) {
        return correnti.filter((id) => id !== photoId);
      }

      return [...correnti, photoId];
    });
    setMessaggio(null);
  };

  const handleCreaFreeze = async () => {
    if (!puoCreareFreeze) {
      return;
    }

    if (!cantiereId) {
      setErrore(SAL_FREEZE_TESTI.ERRORI.INPUT_NON_VALIDO);
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error(
          SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO
        );
      }

      const response = await fetch(
        "/api/sal-freeze/create",
        {
          method: "POST",
          headers: {
            [API_HEADERS.CONTENT_TYPE]:
              API_HEADERS.APPLICATION_JSON,
            [API_HEADERS.AUTHORIZATION]:
              `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
          },
          body: JSON.stringify({
            cantiereId,
            periodStart,
            periodEnd,
            selectedPhotoIds,
            note,
          }),
        }
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          getMessaggioApi(payload) ||
            SAL_FREEZE_TESTI.ERRORI.GENERICO
        );
      }

      const freezeIdCreato =
        isRecord(payload) &&
        typeof payload.freezeId === "string"
          ? payload.freezeId
          : isRecord(payload) &&
              isRecord(payload.freeze) &&
              typeof payload.freeze.id === "string"
            ? payload.freeze.id
            : null;

      const freezeIdSelezionato = await caricaStoricoFreeze({
        cantiereIdCorrente: cantiereId,
        freezeIdDaSelezionare: freezeIdCreato,
      });

      if (freezeIdSelezionato) {
        const dettaglioCreato =
          await loadSalFreezeDettaglio({
            freezeId: freezeIdSelezionato,
          });

        setFreezeDettaglio(dettaglioCreato);
      }

      setMessaggio(
        SAL_FREEZE_TESTI.MESSAGGI.FREEZE_CREATO
      );

      setNote("");
      setSelectedPhotoIds([]);
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleEsportaPdf = async () => {
    if (!freezeDettaglioDaMostrare || freezeSelezionatoAnnullato) {
      return;
    }

    try {
      setLoadingPdf(true);
      setErroreExport(null);

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error(
          SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO
        );
      }

      const response = await fetch(
        `${API_ROUTES.REPORT_SAL_FREEZE_PDF}?${SAL_FREEZE_EXPORT.QUERY.FREEZE_ID}=${encodeURIComponent(freezeDettaglioDaMostrare.freeze.id)}&${SAL_FREEZE_EXPORT.QUERY.CANTIERE_NOME}=${encodeURIComponent(cantiereSelezionato?.nome || freezeDettaglioDaMostrare.freeze.cantiere_id)}`,
        {
          headers: {
            [API_HEADERS.AUTHORIZATION]:
              `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
          },
        }
      );
      const contentType =
        response.headers.get("content-type") || "";

      if (
        response.redirected ||
        !contentType.includes("application/pdf")
      ) {
        console.error("[sal-period-export-error]", {
          freezeId: freezeDettaglioDaMostrare.freeze.id,
          type: "pdf",
          status: response.status,
          contentType,
        });

        setErroreExport(
          getMessaggioErroreExportFallback("pdf")
        );
        return;
      }

      if (!response.ok) {
        console.error("[sal-period-export-error]", {
          freezeId: freezeDettaglioDaMostrare.freeze.id,
          type: "pdf",
          status: response.status,
          contentType,
        });

        setErroreExport(
          getMessaggioErroreExportFallback("pdf")
        );
        return;
      }

      scaricaBlobPdf({
        blob: await response.blob(),
        nomeFile: getNomeFilePdf(response),
      });
    } catch (error: unknown) {
      const freezeId =
        freezeDettaglioDaMostrare?.freeze.id || null;
      const errorMessage = getMessaggioErrore(error);

      console.error("[sal-period-export-error]", {
        freezeId,
        type: "pdf",
        errorMessage,
      });

      setErroreExport(errorMessage);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleEsportaExcel = async () => {
    if (!freezeDettaglioDaMostrare || freezeSelezionatoAnnullato) {
      return;
    }

    try {
      setLoadingExcel(true);
      setErroreExport(null);

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error(
          SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO
        );
      }

      const response = await fetch(
        `${API_ROUTES.REPORT_SAL_FREEZE_EXCEL}?${SAL_FREEZE_EXPORT.QUERY.FREEZE_ID}=${encodeURIComponent(freezeDettaglioDaMostrare.freeze.id)}&${SAL_FREEZE_EXPORT.QUERY.CANTIERE_NOME}=${encodeURIComponent(cantiereSelezionato?.nome || freezeDettaglioDaMostrare.freeze.cantiere_id)}`,
        {
          headers: {
            [API_HEADERS.AUTHORIZATION]:
              `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
          },
        }
      );
      const contentType =
        response.headers.get("content-type") || "";

      if (
        response.redirected ||
        !contentType.includes(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      ) {
        console.error("[sal-period-export-error]", {
          freezeId: freezeDettaglioDaMostrare.freeze.id,
          type: "excel",
          status: response.status,
          contentType,
        });

        setErroreExport(
          getMessaggioErroreExportFallback("excel")
        );
        return;
      }

      if (!response.ok) {
        console.error("[sal-period-export-error]", {
          freezeId: freezeDettaglioDaMostrare.freeze.id,
          type: "excel",
          status: response.status,
          contentType,
        });

        setErroreExport(
          getMessaggioErroreExportFallback("excel")
        );
        return;
      }

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      const contentDisposition =
        response.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(
        contentDisposition
      );

      link.href = url;
      link.download =
        match?.[1] ||
        SAL_FREEZE_EXPORT.EXCEL.DEFAULT_FILENAME;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const freezeId =
        freezeDettaglioDaMostrare?.freeze.id || null;
      const errorMessage = getMessaggioErrore(error);

      console.error("[sal-period-export-error]", {
        freezeId,
        type: "excel",
        errorMessage,
      });

      setErroreExport(errorMessage);
    } finally {
      setLoadingExcel(false);
    }
  };

  const handleAnnullaFreeze = async () => {
    if (
      !puoCreareFreeze ||
      !freezeDettaglioDaMostrare ||
      freezeSelezionatoAnnullato
    ) {
      return;
    }

    const conferma = window.confirm(
      `Annullare il freeze del periodo ${getFreezePeriodoLabel(freezeDettaglioDaMostrare.freeze)}?`
    );

    if (!conferma) {
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      const accessToken = data.session?.access_token;

      if (!accessToken) {
        throw new Error(
          SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO
        );
      }

      const response = await fetch(
        "/api/sal-freeze/annulla",
        {
          method: "POST",
          headers: {
            [API_HEADERS.CONTENT_TYPE]:
              API_HEADERS.APPLICATION_JSON,
            [API_HEADERS.AUTHORIZATION]:
              `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
          },
          body: JSON.stringify({
            freezeId: freezeDettaglioDaMostrare.freeze.id,
          }),
        }
      );

      const payload = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          getMessaggioApi(payload) ||
            SAL_FREEZE_TESTI.ERRORI.GENERICO
        );
      }

      const freezeIdSelezionato = await caricaStoricoFreeze({
        cantiereIdCorrente: cantiereId,
        freezeIdDaSelezionare:
          freezeDettaglioDaMostrare.freeze.id,
      });

      if (freezeIdSelezionato) {
        const dettaglioAggiornato =
          await loadSalFreezeDettaglio({
            freezeId: freezeIdSelezionato,
          });

        setFreezeDettaglio(dettaglioAggiornato);
      }
      setMessaggio(
        SAL_FREEZE_TESTI.MESSAGGI.FREEZE_ANNULLATO
      );
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const loading = loadingRuolo || loadingCantieri;
  const loadingDati =
    loadingDatiCantiere || loadingDettaglio;

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
        <div className="mx-auto max-w-7xl text-sm text-industrial-muted">
          {SAL_TESTI.CARICAMENTO}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-4 text-industrial-text sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-industrial-muted-strong">
              {SAL_FREEZE_TESTI.BACKOFFICE}
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              {SAL_FREEZE_TESTI.TITOLO}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-industrial-muted">
              {SAL_FREEZE_TESTI.CARD_DESCRIZIONE}
            </p>
          </div>

          <Link
            href={APP_ROUTES.BACKOFFICE}
            className="rounded-xl border border-industrial-border bg-industrial-control px-4 py-3 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
          >
            {SAL_FREEZE_TESTI.BACKOFFICE}
          </Link>
        </div>

        {errore ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errore}
          </div>
        ) : null}

        {messaggio ? (
          <div className="mb-4 rounded-xl border border-industrial-success-bg bg-industrial-success-bg px-4 py-3 text-sm text-industrial-success-text">
            {messaggio}
          </div>
        ) : null}

        {erroreExport ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {erroreExport}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <SectionCard
              title={SAL_FREEZE_TESTI.CANTIERE}
              subtitle={
                cantiereSelezionato?.indirizzo || undefined
              }
            >
              <SelectCantiere
                cantieri={cantieri}
                cantiereId={cantiereId}
                onChange={handleCantiereChange}
                disabled={loadingDati}
              />

              {!cantieri.length ? (
                <p className="mt-3 text-sm text-industrial-muted">
                  {SAL_FREEZE_TESTI.NESSUN_CANTIERE}
                </p>
              ) : null}
            </SectionCard>

            {puoCreareFreeze ? (
              <SectionCard
                title={SAL_FREEZE_TESTI.PERIODO_MESE}
                subtitle={SAL_FREEZE_TESTI.CREA_FREEZE_CTA}
              >
                <div className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-industrial-muted-strong">
                      {SAL_FREEZE_TESTI.DATA_INIZIO}
                    </span>
                    <input
                      type="date"
                      value={periodStart}
                      onChange={(event) =>
                        setPeriodStart(event.target.value)
                      }
                      className="form-field"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-xs font-medium uppercase tracking-[0.24em] text-industrial-muted-strong">
                      {SAL_FREEZE_TESTI.DATA_FINE}
                    </span>
                    <input
                      type="date"
                      value={periodEnd}
                      onChange={(event) =>
                        setPeriodEnd(event.target.value)
                      }
                      className="form-field"
                    />
                  </label>
                </div>
              </SectionCard>
            ) : null}

            {puoCreareFreeze ? (
              <SectionCard
                title={SAL_FREEZE_TESTI.FOTO_RECENTI}
                subtitle={SAL_FREEZE_TESTI.FOTO_SELEZIONATE}
              >
                {loadingDati ? (
                  <p className="text-sm text-industrial-muted">
                    {SAL_TESTI.CARICAMENTO}
                  </p>
                ) : recentPhotos.length > 0 ? (
                  <div className="grid gap-3">
                    {recentPhotos.map((foto) => {
                      const selezionata =
                        selectedPhotoIds.includes(
                          foto.id
                        );

                      return (
                        <label
                          key={foto.id}
                          className={`overflow-hidden rounded-xl border transition-colors duration-200 ease-out ${selezionata ? "border-industrial-orange bg-orange-50" : "border-industrial-border-soft bg-industrial-surface-strong"}`}
                        >
                          <div className="flex gap-3 p-3">
                            <input
                              type="checkbox"
                              checked={selezionata}
                              onChange={() =>
                                handleTogglePhoto(foto.id)
                              }
                              className="mt-1 h-4 w-4 rounded border-industrial-border text-industrial-orange"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-industrial-bg-soft">
                                <img
                                  src={foto.immagine_data_url}
                                  alt={
                                    foto.descrizione ||
                                    SAL_FREEZE_TESTI.FOTO_RECENTI
                                  }
                                  className="h-full w-full object-cover"
                                />
                              </div>

                              <p className="mt-2 text-sm font-medium text-industrial-text">
                                {foto.descrizione ||
                                  SAL_FREEZE_TESTI.FOTO_RECENTI}
                              </p>
                              <p className="mt-1 text-xs text-industrial-muted-strong">
                                {formattaData(
                                  foto.data_riferimento
                                )}
                              </p>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-industrial-muted">
                    {SAL_FREEZE_TESTI.NESSUNA_FOTO}
                  </p>
                )}
              </SectionCard>
            ) : null}

            {puoCreareFreeze ? (
              <SectionCard
                title={SAL_FREEZE_TESTI.ANTEPRIMA_FOTO_SELEZIONATE}
                subtitle={`${fotoSelezionate.length} foto`}
              >
                {fotoSelezionate.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {fotoSelezionate.map((foto) => (
                      <figure
                        key={foto.id}
                        className="overflow-hidden rounded-xl border border-industrial-border-soft bg-industrial-surface-strong"
                      >
                        <div className="aspect-[4/3] bg-industrial-bg-soft">
                          <img
                            src={foto.immagine_data_url}
                            alt={
                              foto.descrizione ||
                              SAL_FREEZE_TESTI
                                .ANTEPRIMA_FOTO_SELEZIONATE
                            }
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <figcaption className="p-3 text-sm text-industrial-muted">
                          {foto.descrizione ||
                            formattaData(
                              foto.data_riferimento
                            )}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-industrial-muted">
                    {SAL_TESTI.NESSUNA_FOTO_SELEZIONATA}
                  </p>
                )}
              </SectionCard>
            ) : null}

            {puoCreareFreeze ? (
              <SectionCard
                title={SAL_FREEZE_TESTI.NOTE}
              >
                <textarea
                  value={note}
                  onChange={(event) =>
                    setNote(event.target.value)
                  }
                  placeholder={SAL_FREEZE_TESTI.NOTE}
                  className="form-field min-h-28"
                />
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleCreaFreeze()}
                    disabled={
                      salvataggio || !cantiereId
                    }
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-industrial-orange bg-industrial-orange px-5 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover active:border-industrial-orange-active active:bg-industrial-orange-active disabled:cursor-not-allowed disabled:border-industrial-border-soft disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
                  >
                    {salvataggio
                      ? SAL_TESTI.CARICAMENTO
                      : SAL_FREEZE_TESTI.CREA_FREEZE}
                  </button>
                </div>
              </SectionCard>
            ) : (
              <SectionCard
                title={SAL_FREEZE_TESTI.CREA_FREEZE}
                subtitle={SAL_FREEZE_TESTI.SOLO_ADMIN_CREA}
              >
                <p className="text-sm text-industrial-muted">
                  {SAL_FREEZE_TESTI.SOLO_ADMIN_CREA}
                </p>
              </SectionCard>
            )}

            <SectionCard
              title={SAL_FREEZE_TESTI.LISTA_FREEZE}
              subtitle={
                cantiereSelezionato
                  ? cantiereSelezionato.nome
                  : undefined
              }
            >
              {loadingDati ? (
                <p className="text-sm text-industrial-muted">
                  {SAL_TESTI.CARICAMENTO}
                </p>
              ) : freezeList.length > 0 ? (
                <div className="grid gap-2">
                  {freezeList.map((freeze) => {
                    const selezionato =
                      freeze.id === freezeSelezionatoId;

                    return (
                      <button
                        key={freeze.id}
                        type="button"
                        onClick={() =>
                          setFreezeSelezionatoId(freeze.id)
                        }
                        className={`rounded-xl border p-3 text-left transition-colors duration-200 ease-out ${selezionato ? "border-industrial-orange bg-orange-50" : "border-industrial-border-soft bg-industrial-surface-strong hover:border-industrial-orange hover:text-industrial-orange"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-industrial-text">
                              {getFreezePeriodoLabel(
                                freeze
                              )}
                            </p>
                            <p className="mt-1 text-xs text-industrial-muted">
                              {formattaDataConOra(
                                freeze.freeze_at
                              )}
                            </p>
                            {freeze.note ? (
                              <p className="mt-2 line-clamp-2 text-sm text-industrial-muted-strong">
                                {freeze.note}
                              </p>
                            ) : null}
                          </div>

                          <FreezeBadge
                            annullato={
                              Boolean(freeze.annullato_at)
                            }
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-industrial-muted">
                  {SAL_FREEZE_TESTI.NESSUN_FREEZE}
                </p>
              )}
            </SectionCard>
          </div>

          <div className="space-y-6">
            <SectionCard
              title={SAL_FREEZE_TESTI.DETTAGLIO_FREEZE}
              subtitle={
                freezeDettaglioDaMostrare?.freeze
                  ? getFreezePeriodoLabel(
                      freezeDettaglioDaMostrare.freeze
                    )
                  : undefined
              }
              action={
                freezeDettaglioDaMostrare ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <FreezeBadge
                      annullato={freezeSelezionatoAnnullato}
                    />

                    {!freezeSelezionatoAnnullato ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void handleEsportaPdf()
                          }
                          disabled={loadingPdf}
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-industrial-border bg-industrial-control px-4 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:cursor-not-allowed disabled:border-industrial-border-soft disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
                        >
                          {loadingPdf
                            ? SAL_TESTI.CARICAMENTO
                            : SAL_FREEZE_TESTI.ESPORTA_PDF}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleEsportaExcel()
                          }
                          disabled={loadingExcel}
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-industrial-border bg-industrial-control px-4 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white disabled:cursor-not-allowed disabled:border-industrial-border-soft disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
                        >
                          {loadingExcel
                            ? SAL_TESTI.CARICAMENTO
                            : SAL_FREEZE_TESTI.ESPORTA_EXCEL}
                        </button>
                      </>
                    ) : null}

                    {puoCreareFreeze &&
                    !freezeSelezionatoAnnullato ? (
                      <button
                        type="button"
                        onClick={() =>
                          void handleAnnullaFreeze()
                        }
                        disabled={salvataggio}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition-colors duration-200 ease-out hover:border-red-300 hover:bg-red-100 active:bg-red-200 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {SAL_FREEZE_TESTI.ANNULLA_FREEZE}
                      </button>
                    ) : null}
                  </div>
                ) : undefined
              }
            >
              {loadingDati ? (
                <p className="text-sm text-industrial-muted">
                  {SAL_TESTI.CARICAMENTO}
                </p>
              ) : freezeDettaglioDaMostrare ? (
                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-industrial-border-soft bg-industrial-surface-strong p-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-industrial-muted-strong">
                        {SAL_FREEZE_TESTI.CANTIERE}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-industrial-text">
                        {cantiereSelezionato?.nome ||
                          freezeDettaglioDaMostrare.freeze.cantiere_id}
                      </p>
                    </div>

                    <div className="rounded-xl border border-industrial-border-soft bg-industrial-surface-strong p-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-industrial-muted-strong">
                        {SAL_FREEZE_TESTI.PERIODO_MESE}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-industrial-text">
                        {getFreezePeriodoLabel(
                          freezeDettaglioDaMostrare.freeze
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-industrial-border-soft bg-industrial-surface-strong p-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-industrial-muted-strong">
                        {SAL_FREEZE_TESTI.FOTO_SELEZIONATE}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-industrial-text">
                        {freezeDettaglioDaMostrare.foto.length}
                      </p>
                    </div>

                    <div className="rounded-xl border border-industrial-border-soft bg-industrial-surface-strong p-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-industrial-muted-strong">
                        {SAL_FREEZE_TESTI.MACCHINARI}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-industrial-text">
                        {freezeDettaglioDaMostrare.macchinari.length}
                      </p>
                    </div>
                  </div>

                  {freezeSelezionatoAnnullato ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      Freeze annullato.
                    </div>
                  ) : null}

                  <div className="overflow-hidden rounded-xl border border-industrial-border-soft">
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-left text-sm">
                        <thead className="bg-industrial-bg-soft text-xs uppercase tracking-[0.2em] text-industrial-muted-strong">
                          <tr>
                            <th className="px-4 py-3">
                              {SAL_TESTI.SELEZIONA_LAVORAZIONE}
                            </th>
                            <th className="px-4 py-3">
                              {SAL_FREEZE_TESTI.PERCENTUALE_PRECEDENTE}
                            </th>
                            <th className="px-4 py-3">
                              {SAL_FREEZE_TESTI.PERCENTUALE_ATTUALE}
                            </th>
                            <th className="px-4 py-3">
                              {SAL_FREEZE_TESTI.DELTA_PERCENTUALE}
                            </th>
                            <th className="px-4 py-3">
                              {SAL_FREEZE_TESTI.ORE_UOMO}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {freezeDettaglioDaMostrare.lavorazioni.map(
                            (lavorazione) => (
                              <tr
                                key={lavorazione.id}
                                className="border-t border-industrial-border-soft bg-industrial-surface"
                              >
                                <td className="px-4 py-3 font-medium text-industrial-text">
                                  {
                                    lavorazione.lavorazione_nome_snapshot
                                  }
                                </td>
                                <td className="px-4 py-3 text-industrial-muted">
                                  {lavorazione.percentuale_precedente}
                                  %
                                </td>
                                <td className="px-4 py-3 text-industrial-text">
                                  {lavorazione.percentuale_attuale}
                                  %
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${getDeltaClassName(
                                      lavorazione.delta_percentuale
                                    )}`}
                                  >
                                    {formattaDeltaPercentuale(
                                      lavorazione.delta_percentuale
                                    )}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-industrial-muted">
                                  {formattaOreUomo(
                                    lavorazione.ore_uomo_minuti
                                  )}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-industrial-text">
                      {SAL_FREEZE_TESTI.FOTO_SELEZIONATE_TITOLO}
                    </h3>

                    {freezeDettaglioDaMostrare.foto.length > 0 ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {freezeDettaglioDaMostrare.foto.map((foto) => (
                          <figure
                            key={foto.id}
                            className="overflow-hidden rounded-xl border border-industrial-border-soft bg-industrial-surface-strong"
                          >
                            <div className="aspect-[4/3] bg-industrial-bg-soft">
                              {foto.preview_url ? (
                                <img
                                  src={foto.preview_url}
                                  alt={foto.descrizione}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-sm text-industrial-muted">
                                  Preview non disponibile
                                </div>
                              )}
                            </div>
                            <figcaption className="space-y-1 p-3">
                              <p className="text-sm font-medium text-industrial-text">
                                {foto.descrizione ||
                                  formattaData(
                                    foto.data_riferimento
                                  )}
                              </p>
                              <p className="text-xs text-industrial-muted">
                                {formattaData(
                                  foto.data_riferimento
                                )}
                              </p>
                              <p className="break-all text-[11px] text-industrial-muted-strong">
                                {estraiPathStorage(
                                  foto.storage_path_snapshot
                                ) || foto.storage_path_snapshot}
                              </p>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-industrial-muted">
                        {SAL_TESTI.NESSUNA_FOTO}
                      </p>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-industrial-text">
                      {SAL_FREEZE_TESTI.MACCHINARI}
                    </h3>

                    {freezeDettaglioDaMostrare.macchinari.length > 0 ? (
                      <div className="mt-3 overflow-hidden rounded-xl border border-industrial-border-soft">
                        <div className="overflow-x-auto">
                          <table className="min-w-full border-collapse text-left text-sm">
                            <thead className="bg-industrial-bg-soft text-xs uppercase tracking-[0.2em] text-industrial-muted-strong">
                              <tr>
                                <th className="px-4 py-3">
                                  Tipo
                                </th>
                                <th className="px-4 py-3">
                                  Descrizione
                                </th>
                                <th className="px-4 py-3">
                                  Ore utilizzo
                                </th>
                                <th className="px-4 py-3">
                                  Note
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {freezeDettaglioDaMostrare.macchinari.map(
                                (macchinario) => (
                                  <tr
                                    key={macchinario.id}
                                    className="border-t border-industrial-border-soft bg-industrial-surface"
                                  >
                                    <td className="px-4 py-3 font-medium text-industrial-text">
                                      {
                                        macchinario.tipo_macchinario_snapshot
                                      }
                                    </td>
                                    <td className="px-4 py-3 text-industrial-muted">
                                      {
                                        macchinario.descrizione_snapshot
                                      }
                                    </td>
                                    <td className="px-4 py-3 text-industrial-muted">
                                      {macchinario.ore_utilizzo}
                                    </td>
                                    <td className="px-4 py-3 text-industrial-muted">
                                      {macchinario.note}
                                    </td>
                                  </tr>
                                )
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-industrial-muted">
                        {SAL_FREEZE_TESTI.NESSUN_DATO}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-industrial-muted">
                  {loadingDettaglio
                    ? SAL_TESTI.CARICAMENTO
                    : SAL_FREEZE_TESTI.NESSUN_DETTAGLIO}
                </p>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </main>
  );
}
