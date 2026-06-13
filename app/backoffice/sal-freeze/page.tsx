"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Home,
  Download,
  Plus,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { getMessaggioErrore } from "@/lib/errors";
import { isRecord } from "@/lib/typeGuards";
import { SelectCantiere } from "@/components/cantieri/SelectCantiere";
import { API_HEADERS, API_ROUTES } from "@/constants/api";
import { APP_ROUTES } from "@/constants/routes";
import { SAL_TESTI } from "@/constants/sal";
import {
  SAL_FREEZE_EXPORT,
  SAL_FREEZE_TESTI,
} from "@/constants/salFreeze";
import { supabase } from "@/lib/supabase";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadSalLavorazioniFoto } from "@/services/sal/loadSalLavorazioniFoto";
import { loadSalFreezeMensili } from "@/services/salFreeze/loadSalFreezeMensili";
import { loadSalFreezeDettaglio } from "@/services/salFreeze/loadSalFreezeDettaglio";
import {
  loadSalCollaborazioni,
  type LavorazioneCollaboratore,
} from "@/services/collaborazioni/loadSalCollaborazioni";
import type { CantiereBackoffice } from "@/types/cantieri";
import type { SalLavorazioneFoto } from "@/types/sal";
import type {
  SalFreezeDettaglio,
  SalFreezeMensile,
} from "@/types/salFreeze";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

type RuoloUtente = "ADMIN" | "RESPONSABILE" | null;

// ─── Helpers ──────────────────────────────────────────────────────────────

function getLocalDateIso(data = new Date()) {
  const year = data.getFullYear();
  const month = String(data.getMonth() + 1).padStart(2, "0");
  const day = String(data.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPrimoGiornoMese(data = new Date()) {
  const mese = new Date(data.getFullYear(), data.getMonth(), 1);
  return getLocalDateIso(mese);
}

function getUltimoGiornoMese(data = new Date()) {
  const mese = new Date(data.getFullYear(), data.getMonth() + 1, 0);
  return getLocalDateIso(mese);
}

function getMessaggioApi(payload: unknown): string | null {
  if (!isRecord(payload)) return null;

  const errorMessage =
    typeof payload.errorMessage === "string"
      ? payload.errorMessage
      : typeof payload.errore === "string"
        ? payload.errore
        : typeof payload.error === "string"
          ? payload.error
          : null;

  const step = typeof payload.step === "string" ? payload.step : null;

  if (errorMessage && step) return `${errorMessage}. Step: ${step}`;
  if (errorMessage) return errorMessage;
  return null;
}

function formattaData(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT").format(new Date(`${value}T00:00:00`));
}

function formattaDataConOra(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
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

function getDeltaIcon(value: number) {
  if (value > 0) return <TrendingUp className="h-4 w-4" />;
  if (value < 0) return <TrendingDown className="h-4 w-4" />;
  return <Minus className="h-4 w-4" />;
}

function getDeltaBadgeVariant(value: number) {
  if (value > 0) return "success";
  if (value < 0) return "error";
  return "muted";
}

function getFreezePeriodoLabel(freeze: SalFreezeMensile) {
  return `${formattaData(freeze.period_start)} - ${formattaData(freeze.period_end)}`;
}

function getPreviewUrlSicura(value?: string | null) {
  if (!value) return null;
  if (/^data:image\/(png|jpe?g|webp);base64,/i.test(value) || /^https?:\/\//i.test(value)) {
    return value;
  }
  return null;
}

function scaricaBlobFile({ blob, nomeFile }: { blob: Blob; nomeFile: string }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getNomeFileDaResponse(response: Response) {
  const contentDisposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(contentDisposition);
  return match?.[1] || SAL_FREEZE_EXPORT.PDF.DEFAULT_FILENAME;
}

async function getMessaggioErroreExport({
  response,
  tipo,
}: {
  response: Response;
  tipo: "pdf" | "excel" | "excel-mensile";
}) {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    const payload = await response.json().catch(() => null);
    const errorMessage =
      isRecord(payload) && typeof payload.errorMessage === "string"
        ? payload.errorMessage
        : isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : null;
    const tipoLabel =
      tipo === "pdf" ? "PDF" : tipo === "excel" ? "Excel" : "Excel mensile";
    return `Errore export ${tipoLabel}: ${errorMessage || "Errore sconosciuto"}`;
  }

  return `Errore export: status ${response.status}`;
}

export default function BackofficeSalFreezePage() {
  const toast = useToast();

  // State
  const [cantieri, setCantieri] = useState<CantiereBackoffice[]>([]);
  const [cantiereId, setCantiereId] = useState("");
  const [periodStart, setPeriodStart] = useState(getPrimoGiornoMese());
  const [periodEnd, setPeriodEnd] = useState(getUltimoGiornoMese());
  const [periodStartExportMensile, setPeriodStartExportMensile] = useState(getPrimoGiornoMese());
  const [periodEndExportMensile, setPeriodEndExportMensile] = useState(getUltimoGiornoMese());
  const [cantiereIdsExportMensile, setCantiereIdsExportMensile] = useState<string[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<SalLavorazioneFoto[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [freezeList, setFreezeList] = useState<SalFreezeMensile[]>([]);
  const [freezeSelezionatoId, setFreezeSelezionatoId] = useState("");
  const [freezeDettaglio, setFreezeDettaglio] = useState<SalFreezeDettaglio | null>(null);
  const [loadingCantieri, setLoadingCantieri] = useState(true);
  const [loadingDatiCantiere, setLoadingDatiCantiere] = useState(false);
  const [lavorazioniCollab, setLavorazioniCollab] = useState<LavorazioneCollaboratore[]>([]);
  const [loadingDettaglio, setLoadingDettaglio] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingExcelMensile, setLoadingExcelMensile] = useState(false);
  const [ruoloUtente, setRuoloUtente] = useState<RuoloUtente>(null);
  const [loadingRuolo, setLoadingRuolo] = useState(true);

  const puoCreareFreeze = ruoloUtente === "ADMIN";
  const puoEsportareMensile = ruoloUtente === "ADMIN" || ruoloUtente === "RESPONSABILE";

  const fotoById = useMemo(
    () => new Map(recentPhotos.map((foto) => [foto.id, foto])),
    [recentPhotos]
  );

  const fotoSelezionate = useMemo(
    () =>
      selectedPhotoIds
        .map((photoId) => fotoById.get(photoId))
        .filter((foto): foto is SalLavorazioneFoto => Boolean(foto)),
    [fotoById, selectedPhotoIds]
  );

  const cantiereSelezionato = useMemo(
    () => cantieri.find((cantiere) => cantiere.id === cantiereId) || null,
    [cantieri, cantiereId]
  );

  const freezeDettaglioDaMostrare =
    freezeSelezionatoId && freezeDettaglio ? freezeDettaglio : null;

  const freezeSelezionatoAnnullato = Boolean(
    freezeDettaglioDaMostrare?.freeze.annullato_at
  );

  // Effects
  useEffect(() => {
    let attivo = true;

    const caricaRuolo = async () => {
      try {
        const user = await loadUtenteAuth();
        if (!attivo) return;

        if (!user?.email) {
          setRuoloUtente(null);
          return;
        }

        const utenteAdmin = await isAdmin(user.email);
        if (!attivo) return;

        if (utenteAdmin) {
          setRuoloUtente("ADMIN");
          return;
        }

        const utenteResponsabile = await isResponsabile(user.email);
        if (!attivo) return;

        setRuoloUtente(utenteResponsabile ? "RESPONSABILE" : null);
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, SAL_FREEZE_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoadingRuolo(false);
      }
    };

    void caricaRuolo();
    return () => {
      attivo = false;
    };
  }, [toast]);

  useEffect(() => {
    let attivo = true;

    const caricaCantieri = async () => {
      try {
        const dati = await loadCantieriBackoffice();
        if (!attivo) return;
        setCantieri(dati);
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, SAL_FREEZE_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoadingCantieri(false);
      }
    };

    void caricaCantieri();
    return () => {
      attivo = false;
    };
  }, [toast]);

  useEffect(() => {
    let attivo = true;

    const caricaDatiCantiere = async () => {
      if (!cantiereId) {
        setRecentPhotos([]);
        setFreezeList([]);
        setFreezeSelezionatoId("");
        setFreezeDettaglio(null);
        setLavorazioniCollab([]);
        setLoadingDatiCantiere(false);
        return;
      }

      try {
        setLoadingDatiCantiere(true);

        const [foto, freeze, collab] = await Promise.all([
          loadSalLavorazioniFoto({ cantiereId, dataRiferimento: getLocalDateIso(), limit: 100 }),
          loadSalFreezeMensili({ cantiereId }),
          loadSalCollaborazioni({ cantiereCommittenteId: cantiereId }),
        ]);

        if (!attivo) return;

        setRecentPhotos(foto);
        setFreezeList(freeze);
        setLavorazioniCollab(collab);

        if (freeze.length > 0) {
          setFreezeSelezionatoId(freeze[0].id);
        } else {
          setFreezeSelezionatoId("");
          setFreezeDettaglio(null);
        }
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, SAL_FREEZE_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoadingDatiCantiere(false);
      }
    };

    void caricaDatiCantiere();
    return () => {
      attivo = false;
    };
  }, [cantiereId, toast]);

  useEffect(() => {
    let attivo = true;

    const caricaDettaglio = async () => {
      if (!freezeSelezionatoId) {
        setFreezeDettaglio(null);
        return;
      }

      try {
        setLoadingDettaglio(true);
        const dettaglio = await loadSalFreezeDettaglio({ freezeId: freezeSelezionatoId });
        if (attivo) setFreezeDettaglio(dettaglio);
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, SAL_FREEZE_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoadingDettaglio(false);
      }
    };

    void caricaDettaglio();
    return () => {
      attivo = false;
    };
  }, [freezeSelezionatoId, toast]);

  // Handlers
  const caricaStoricoFreeze = useCallback(
    async ({
      cantiereIdCorrente,
      freezeIdDaSelezionare,
    }: {
      cantiereIdCorrente: string;
      freezeIdDaSelezionare?: string | null;
    }): Promise<string | null> => {
      const freezeAggiornati = await loadSalFreezeMensili({ cantiereId: cantiereIdCorrente });
      setFreezeList(freezeAggiornati);

      if (freezeAggiornati.length === 0) {
        setFreezeSelezionatoId("");
        setFreezeDettaglio(null);
        return null;
      }

      const freezeIdValido =
        freezeIdDaSelezionare && freezeAggiornati.some((freeze) => freeze.id === freezeIdDaSelezionare)
          ? freezeIdDaSelezionare
          : freezeAggiornati[0].id;

      setFreezeSelezionatoId(freezeIdValido);
      return freezeIdValido;
    },
    []
  );

  const handleTogglePhoto = (photoId: string) => {
    setSelectedPhotoIds((correnti) =>
      correnti.includes(photoId) ? correnti.filter((id) => id !== photoId) : [...correnti, photoId]
    );
  };

  const handleCreaFreeze = async () => {
    if (!puoCreareFreeze) return;
    if (!cantiereId) {
      toast.error(SAL_FREEZE_TESTI.ERRORI.INPUT_NON_VALIDO);
      return;
    }

    try {
      setSalvataggio(true);

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error(SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO);

      const response = await fetch("/api/sal-freeze/create", {
        method: "POST",
        headers: {
          [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
        },
        body: JSON.stringify({
          cantiereId,
          periodStart,
          periodEnd,
          selectedPhotoIds,
          note,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(getMessaggioApi(payload) || SAL_FREEZE_TESTI.ERRORI.GENERICO);
      }

      const freezeIdCreato =
        isRecord(payload) && typeof payload.freezeId === "string"
          ? payload.freezeId
          : isRecord(payload) && isRecord(payload.freeze) && typeof payload.freeze.id === "string"
            ? payload.freeze.id
            : null;

      const freezeIdSelezionato = await caricaStoricoFreeze({
        cantiereIdCorrente: cantiereId,
        freezeIdDaSelezionare: freezeIdCreato,
      });

      if (freezeIdSelezionato) {
        const dettaglioCreato = await loadSalFreezeDettaglio({ freezeId: freezeIdSelezionato });
        setFreezeDettaglio(dettaglioCreato);
      }

      toast.success(SAL_FREEZE_TESTI.MESSAGGI.FREEZE_CREATO);
      setNote("");
      setSelectedPhotoIds([]);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, SAL_FREEZE_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleEsportaPdf = async () => {
    const freezeId = freezeDettaglioDaMostrare?.freeze.id || null;

    if (!freezeId || freezeSelezionatoAnnullato) {
      toast.error("Seleziona un SAL periodo prima di esportare");
      return;
    }

    try {
      setLoadingPdf(true);

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error(SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO);

      const cantiereNomePdf =
        cantiereSelezionato?.nome || freezeDettaglioDaMostrare?.freeze.cantiere_id || "";
      const pdfUrl =
        `${API_ROUTES.REPORT_SAL_FREEZE_PDF}?${SAL_FREEZE_EXPORT.QUERY.FREEZE_ID}=${encodeURIComponent(freezeId)}&${SAL_FREEZE_EXPORT.QUERY.CANTIERE_NOME}=${encodeURIComponent(cantiereNomePdf)}`;

      const response = await fetch(pdfUrl, {
        headers: {
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
        },
      });

      const contentType = response.headers.get("content-type") || "";

      if (response.redirected || !contentType.includes("application/pdf")) {
        const erroreExport = await getMessaggioErroreExport({ response, tipo: "pdf" });
        toast.error(erroreExport);
        return;
      }

      if (!response.ok) {
        const erroreExport = await getMessaggioErroreExport({ response, tipo: "pdf" });
        toast.error(erroreExport);
        return;
      }

      scaricaBlobFile({
        blob: await response.blob(),
        nomeFile: getNomeFileDaResponse(response),
      });
      toast.success("PDF scaricato");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, SAL_FREEZE_TESTI.ERRORI.GENERICO));
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleEsportaExcel = async () => {
    if (!freezeDettaglioDaMostrare || freezeSelezionatoAnnullato) return;

    try {
      setLoadingExcel(true);

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error(SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO);

      const response = await fetch(
        `${API_ROUTES.REPORT_SAL_FREEZE_EXCEL}?${SAL_FREEZE_EXPORT.QUERY.FREEZE_ID}=${encodeURIComponent(freezeDettaglioDaMostrare.freeze.id)}&${SAL_FREEZE_EXPORT.QUERY.CANTIERE_NOME}=${encodeURIComponent(cantiereSelezionato?.nome || freezeDettaglioDaMostrare.freeze.cantiere_id)}`,
        {
          headers: {
            [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
          },
        }
      );

      const contentType = response.headers.get("content-type") || "";

      if (response.redirected || !contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
        const erroreExport = await getMessaggioErroreExport({ response, tipo: "excel" });
        toast.error(erroreExport);
        return;
      }

      if (!response.ok) {
        const erroreExport = await getMessaggioErroreExport({ response, tipo: "excel" });
        toast.error(erroreExport);
        return;
      }

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(contentDisposition);

      link.href = url;
      link.download = match?.[1] || SAL_FREEZE_EXPORT.EXCEL.DEFAULT_FILENAME;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel scaricato");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, SAL_FREEZE_TESTI.ERRORI.GENERICO));
    } finally {
      setLoadingExcel(false);
    }
  };

  const handleToggleCantiereExportMensile = (cantiereIdDaToccare: string) => {
    setCantiereIdsExportMensile((correnti) =>
      correnti.includes(cantiereIdDaToccare)
        ? correnti.filter((id) => id !== cantiereIdDaToccare)
        : [...correnti, cantiereIdDaToccare]
    );
  };

  const handleEsportaExcelMensile = async () => {
    if (!periodStartExportMensile || !periodEndExportMensile || cantiereIdsExportMensile.length === 0) {
      toast.error(SAL_FREEZE_TESTI.NESSUN_CANTIERE_SELEZIONATO);
      return;
    }

    try {
      setLoadingExcelMensile(true);

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error(SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO);

      const response = await fetch(API_ROUTES.REPORT_SAL_FREEZE_EXCEL_MULTIPLO, {
        method: "POST",
        headers: {
          [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
        },
        body: JSON.stringify({
          periodStart: periodStartExportMensile,
          periodEnd: periodEndExportMensile,
          cantiereIds: cantiereIdsExportMensile,
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      if (response.redirected || !contentType.includes(SAL_FREEZE_EXPORT.EXCEL_MULTIPLO.MIME_TYPE)) {
        const erroreExport = await getMessaggioErroreExport({ response, tipo: "excel-mensile" });
        toast.error(erroreExport);
        return;
      }

      if (!response.ok) {
        const erroreExport = await getMessaggioErroreExport({ response, tipo: "excel-mensile" });
        toast.error(erroreExport);
        return;
      }

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(contentDisposition);

      link.href = url;
      link.download = match?.[1] || SAL_FREEZE_EXPORT.EXCEL_MULTIPLO.DEFAULT_FILENAME;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel scaricato");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, SAL_FREEZE_TESTI.ERRORI.GENERICO));
    } finally {
      setLoadingExcelMensile(false);
    }
  };

  const loading = loadingCantieri || loadingRuolo;

  if (loading) {
    return (
      <div className="min-h-dvh bg-bg-base">
        <AppHeader />
        <main className="mx-auto max-w-[1200px] px-6 py-6">
          <p className="text-text-muted">{SAL_TESTI.CARICAMENTO}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <Link href={APP_ROUTES.BACKOFFICE}>
            <Button variant="secondary" size="sm">
              Back-office
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-[1200px] px-6 py-6 space-y-6">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link href={APP_ROUTES.BACKOFFICE} className="hover:text-text-primary transition-colors">
            Back-office
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{SAL_FREEZE_TESTI.TITOLO}</span>
        </nav>

        {/* Titolo */}
        <div>
          <h1 className="font-heading text-2xl font-medium text-text-primary">
            {SAL_FREEZE_TESTI.TITOLO}
          </h1>
          <p className="text-sm text-text-muted mt-2">
            {SAL_FREEZE_TESTI.CARD_DESCRIZIONE}
          </p>
        </div>

        {/* 1. Selezione Cantiere */}
        <Card className="p-5">
          <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
            {SAL_FREEZE_TESTI.CANTIERE}
          </h2>
          <SelectCantiere
            cantieri={cantieri}
            cantiereId={cantiereId}
            onChange={setCantiereId}
            disabled={loadingDatiCantiere}
          />
        </Card>

        {/* Lavorazioni subappaltatore (collaborazioni accettate) */}
        {lavorazioniCollab.length > 0 && (
          <Card className="p-5">
            <h2 className="font-heading text-lg font-medium text-text-primary mb-1">
              Lavorazioni subappaltatore
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Avanzamento condiviso dalle aziende collegate a questo cantiere
              (sola lettura, incluso nel SAL unico).
            </p>
            <div className="space-y-4">
              {Array.from(
                new Set(lavorazioniCollab.map((l) => l.azienda_collaboratrice_nome))
              ).map((azienda) => (
                <div key={azienda}>
                  <p className="text-sm font-medium text-text-primary mb-2">{azienda}</p>
                  <div className="space-y-2">
                    {lavorazioniCollab
                      .filter((l) => l.azienda_collaboratrice_nome === azienda)
                      .map((l, i) => (
                        <div key={`${azienda}-${i}`}>
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="text-sm text-text-primary">{l.lavorazione_nome}</span>
                            <span className="text-xs text-text-muted">{l.percentuale_completamento}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                            <div
                              className="h-full rounded-full bg-brand-500 transition-all"
                              style={{ width: `${l.percentuale_completamento}%` }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 2. Crea nuovo SAL periodo (ADMIN only) */}
        {puoCreareFreeze && (
          <Card className="p-5 space-y-6">
            <h2 className="font-heading text-lg font-medium text-text-primary">
              {SAL_FREEZE_TESTI.CREA_FREEZE}
            </h2>

            {/* Data periodo */}
            <div className="space-y-3">
              <h3 className="font-medium text-text-primary text-sm">Periodo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={SAL_FREEZE_TESTI.DATA_INIZIO}
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
                <Input
                  label={SAL_FREEZE_TESTI.DATA_FINE}
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            {/* Foto recenti */}
            <div className="space-y-3">
              <h3 className="font-medium text-text-primary text-sm">
                {SAL_FREEZE_TESTI.FOTO_RECENTI}
              </h3>

              {loadingDatiCantiere ? (
                <p className="text-sm text-text-muted">{SAL_TESTI.CARICAMENTO}</p>
              ) : recentPhotos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {recentPhotos.map((foto) => {
                    const selezionata = selectedPhotoIds.includes(foto.id);
                    const previewUrl = getPreviewUrlSicura(foto.immagine_data_url);

                    return (
                      <label
                        key={foto.id}
                        className={cn(
                          "overflow-hidden rounded-md border transition-colors duration-150 cursor-pointer",
                          selezionata
                            ? "border-brand-500 bg-brand-50"
                            : "border-border hover:border-brand-500"
                        )}
                      >
                        <div className="flex flex-col gap-2 p-2">
                          <input
                            type="checkbox"
                            checked={selezionata}
                            onChange={() => handleTogglePhoto(foto.id)}
                            className="h-4 w-4 accent-brand-500"
                          />
                          {previewUrl && (
                            <Image
                              src={previewUrl}
                              alt={foto.descrizione}
                              width={140}
                              height={140}
                              className="h-32 w-full rounded object-cover"
                            />
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-muted">{SAL_TESTI.NESSUNA_FOTO}</p>
              )}
            </div>

            {/* Note */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">
                {SAL_FREEZE_TESTI.NOTE}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 resize-none"
                placeholder="Note opzionali"
              />
            </div>

            {/* Anteprima foto selezionate */}
            {fotoSelezionate.length > 0 && (
              <div className="space-y-3 rounded-md bg-bg-subtle p-4 border border-border">
                <h4 className="font-medium text-text-primary text-sm">
                  Anteprima ({fotoSelezionate.length} foto selezionate)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {fotoSelezionate.map((foto) => {
                    const previewUrl = getPreviewUrlSicura(foto.immagine_data_url);
                    return (
                      <div key={foto.id} className="overflow-hidden rounded-md border border-border">
                        {previewUrl && (
                          <Image
                            src={previewUrl}
                            alt={foto.descrizione}
                            width={160}
                            height={160}
                            className="h-40 w-full object-cover"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottoni azione */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-border">
              <Button
                variant="primary"
                loading={salvataggio}
                icon={<Plus className="h-4 w-4" />}
                disabled={!cantiereId}
                onClick={() => void handleCreaFreeze()}
              >
                Crea SAL periodo
              </Button>
            </div>
          </Card>
        )}

        {/* 3. Export Excel multi-cantiere (ADMIN/RESPONSABILE) */}
        {puoEsportareMensile && (
          <Card className="p-5 space-y-4">
            <h2 className="font-heading text-lg font-medium text-text-primary">
              {SAL_FREEZE_TESTI.ESPORTA_EXCEL_MENSILE_TITOLO}
            </h2>

            {/* Date range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Data inizio"
                type="date"
                value={periodStartExportMensile}
                onChange={(e) => setPeriodStartExportMensile(e.target.value)}
              />
              <Input
                label="Data fine"
                type="date"
                value={periodEndExportMensile}
                onChange={(e) => setPeriodEndExportMensile(e.target.value)}
              />
            </div>

            {/* Select cantieri */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-text-primary">
                  {SAL_FREEZE_TESTI.SELEZIONA_CANTIERI_EXPORT}
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setCantiereIdsExportMensile(
                      cantiereIdsExportMensile.length === cantieri.length
                        ? []
                        : cantieri.map((c) => c.id)
                    )
                  }
                  className="text-xs font-semibold text-brand-500 hover:text-brand-600 transition-colors"
                >
                  {cantiereIdsExportMensile.length === cantieri.length
                    ? "Deseleziona tutti"
                    : "Seleziona tutti"}
                </button>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto border border-border rounded-md p-3">
                {cantieri.map((cantiere) => {
                  const selezionato = cantiereIdsExportMensile.includes(cantiere.id);
                  return (
                    <label
                      key={cantiere.id}
                      className={cn(
                        "flex items-start gap-3 p-2 rounded-md cursor-pointer transition-colors",
                        selezionato
                          ? "bg-brand-50 border border-brand-500/30"
                          : "border border-transparent hover:bg-bg-subtle"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selezionato}
                        onChange={() => handleToggleCantiereExportMensile(cantiere.id)}
                        className="mt-0.5 h-4 w-4 accent-brand-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{cantiere.nome}</p>
                        {cantiere.indirizzo && (
                          <p className="text-xs text-text-muted mt-0.5">{cantiere.indirizzo}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Bottone export */}
            <div className="flex justify-end pt-3 border-t border-border">
              <Button
                variant="primary"
                loading={loadingExcelMensile}
                icon={<Download className="h-4 w-4" />}
                disabled={cantiereIdsExportMensile.length === 0}
                onClick={() => void handleEsportaExcelMensile()}
              >
                {loadingExcelMensile ? SAL_TESTI.CARICAMENTO : SAL_FREEZE_TESTI.ESPORTA_EXCEL_MENSILE}
              </Button>
            </div>
          </Card>
        )}

        {/* 4. Storico SAL periodi */}
        {cantiereId && (
          <Card className="p-5">
            <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
              {SAL_FREEZE_TESTI.LISTA_FREEZE}
            </h2>

            {loadingDatiCantiere ? (
              <p className="text-sm text-text-muted">{SAL_TESTI.CARICAMENTO}</p>
            ) : freezeList.length === 0 ? (
              <p className="text-sm text-text-muted">{SAL_FREEZE_TESTI.NESSUN_DATO}</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                {/* Lista freeze (sinistra) */}
                <div className="space-y-2 order-2 lg:order-1">
                  {freezeList.map((freeze) => {
                    const selezionato = freeze.id === freezeSelezionatoId;
                    return (
                      <button
                        key={freeze.id}
                        onClick={() => setFreezeSelezionatoId(freeze.id)}
                        className={cn(
                          "w-full text-left p-3 rounded-md border transition-colors",
                          selezionato
                            ? "bg-brand-50 border-brand-500/30"
                            : "border-border hover:border-brand-500"
                        )}
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-sm text-text-primary">
                            {getFreezePeriodoLabel(freeze)}
                          </p>
                          <p className="text-xs text-text-muted">
                            {formattaDataConOra(freeze.freeze_at)}
                          </p>
                          {freeze.note && (
                            <p className="text-xs text-text-muted line-clamp-2 mt-1">
                              {freeze.note}
                            </p>
                          )}
                          <Badge
                            variant={freeze.annullato_at ? "error" : "success"}
                            size="sm"
                            className="mt-2"
                          >
                            {freeze.annullato_at ? "Annullato" : "Attivo"}
                          </Badge>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Dettaglio freeze (destra) */}
                <div className="order-1 lg:order-2 space-y-6">
                  {freezeSelezionatoId && loadingDettaglio && (
                    <p className="text-sm text-text-muted">{SAL_TESTI.CARICAMENTO}</p>
                  )}

                  {freezeDettaglioDaMostrare && (
                    <>
                      {/* Bottoni export in alto */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Download className="h-4 w-4" />}
                          loading={loadingPdf}
                          disabled={freezeSelezionatoAnnullato}
                          onClick={() => void handleEsportaPdf()}
                        >
                          Esporta PDF
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Download className="h-4 w-4" />}
                          loading={loadingExcel}
                          disabled={freezeSelezionatoAnnullato}
                          onClick={() => void handleEsportaExcel()}
                        >
                          Esporta Excel
                        </Button>
                      </div>

                      {/* KPI cards */}
                      {(() => {
                        const lavorazioni = freezeDettaglioDaMostrare.lavorazioni;
                        const avanzamentoMedio =
                          lavorazioni.length > 0
                            ? Math.round(
                                lavorazioni.reduce((sum, l) => sum + l.percentuale_attuale, 0) /
                                  lavorazioni.length
                              )
                            : 0;
                        const deltaMedio =
                          lavorazioni.length > 0
                            ? lavorazioni.reduce((sum, l) => sum + l.delta_percentuale, 0) /
                              lavorazioni.length
                            : 0;
                        const oreUomoTotali = lavorazioni.reduce((sum, l) => sum + l.ore_uomo_minuti, 0);

                        return (
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <Card className="p-3">
                              <p className="text-xs text-text-muted mb-1">Avanzamento</p>
                              <p className="text-2xl font-semibold text-text-primary">{avanzamentoMedio}%</p>
                            </Card>
                            <Card className="p-3">
                              <p className="text-xs text-text-muted mb-1">Delta vs precedente</p>
                              <div className="flex items-center gap-2 mt-2">
                                {getDeltaIcon(deltaMedio)}
                                <span className="text-lg font-semibold text-text-primary">
                                  {formattaDeltaPercentuale(deltaMedio)}
                                </span>
                              </div>
                            </Card>
                            <Card className="p-3">
                              <p className="text-xs text-text-muted mb-1">Foto consolidate</p>
                              <p className="text-2xl font-semibold text-text-primary">
                                {freezeDettaglioDaMostrare.foto.length}
                              </p>
                            </Card>
                            <Card className="p-3">
                              <p className="text-xs text-text-muted mb-1">Ore uomo</p>
                              <p className="text-xl font-semibold text-text-primary">
                                {formattaOreUomo(oreUomoTotali)}
                              </p>
                            </Card>
                          </div>
                        );
                      })()}

                      {/* Tabella lavorazioni */}
                      <div className="space-y-3">
                        <h3 className="font-medium text-text-primary text-sm">
                          {SAL_TESTI.SELEZIONA_LAVORAZIONE}
                        </h3>

                        {freezeDettaglioDaMostrare.lavorazioni.length === 0 ? (
                          <p className="text-sm text-text-muted">{SAL_TESTI.NESSUNA_LAVORAZIONE}</p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead className="bg-bg-subtle border-b border-border">
                                <tr className="text-xs font-medium text-text-muted uppercase">
                                  <th className="p-3 text-left">Lavorazione</th>
                                  <th className="p-3 text-right">Prec. %</th>
                                  <th className="p-3 text-right">Att. %</th>
                                  <th className="p-3 text-right">Delta</th>
                                  <th className="p-3 text-right">Ore</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {freezeDettaglioDaMostrare.lavorazioni.map((lav) => (
                                  <tr key={lav.id} className="hover:bg-bg-subtle transition-colors">
                                    <td className="p-3 font-medium text-text-primary">
                                      {lav.lavorazione_nome_snapshot}
                                    </td>
                                    <td className="p-3 text-right text-text-muted">
                                      {lav.percentuale_precedente}%
                                    </td>
                                    <td className="p-3 text-right text-text-primary font-medium">
                                      {lav.percentuale_attuale}%
                                    </td>
                                    <td className="p-3 text-right">
                                      <Badge
                                        variant={getDeltaBadgeVariant(lav.delta_percentuale)}
                                        size="sm"
                                        className="inline-flex items-center gap-1"
                                      >
                                        {getDeltaIcon(lav.delta_percentuale)}
                                        {formattaDeltaPercentuale(lav.delta_percentuale)}
                                      </Badge>
                                    </td>
                                    <td className="p-3 text-right text-text-muted">
                                      {formattaOreUomo(lav.ore_uomo_minuti)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Foto */}
                      {freezeDettaglioDaMostrare.foto.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="font-medium text-text-primary text-sm">
                            {SAL_FREEZE_TESTI.FOTO_SELEZIONATE_TITOLO}
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {freezeDettaglioDaMostrare.foto.map((foto) => {
                              const previewUrl = getPreviewUrlSicura(foto.preview_url);
                              return (
                                <figure
                                  key={foto.id}
                                  className="overflow-hidden rounded-md border border-border"
                                >
                                  {previewUrl && (
                                    <Image
                                      src={previewUrl}
                                      alt={foto.descrizione}
                                      width={200}
                                      height={200}
                                      className="h-40 w-full object-cover"
                                    />
                                  )}
                                  <figcaption className="p-2 bg-bg-subtle">
                                    <p className="text-xs text-text-primary line-clamp-2">
                                      {foto.descrizione || formattaData(foto.data_riferimento)}
                                    </p>
                                  </figcaption>
                                </figure>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Macchinari */}
                      {freezeDettaglioDaMostrare.macchinari.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="font-medium text-text-primary text-sm">
                            {SAL_FREEZE_TESTI.MACCHINARI}
                          </h3>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead className="bg-bg-subtle border-b border-border">
                                <tr className="text-xs font-medium text-text-muted uppercase">
                                  <th className="p-3 text-left">Tipo</th>
                                  <th className="p-3 text-left">Descrizione</th>
                                  <th className="p-3 text-right">Ore</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {freezeDettaglioDaMostrare.macchinari.map((mach) => (
                                  <tr key={mach.id} className="hover:bg-bg-subtle transition-colors">
                                    <td className="p-3 font-medium text-text-primary">
                                      {mach.tipo_macchinario_snapshot}
                                    </td>
                                    <td className="p-3 text-text-muted">
                                      {mach.descrizione_snapshot}
                                    </td>
                                    <td className="p-3 text-right text-text-muted">
                                      {mach.ore_utilizzo}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}
