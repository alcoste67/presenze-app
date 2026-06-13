"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CalendarRange,
  Download,
  Home,
  Trash2,
} from "lucide-react";

import { getMessaggioErrore } from "@/lib/errors";
import { isRecord } from "@/lib/typeGuards";
import { FileInputPicker } from "@/components/backoffice/FileInputPicker";
import { API_HEADERS } from "@/constants/api";
import { APP_ROUTES } from "@/constants/routes";
import { REPORT_PRESENZE_TESTI } from "@/constants/reportPresenze";
import { SAL_STATI, SAL_TESTI } from "@/constants/sal";
import { SAL_FREEZE_TESTI } from "@/constants/salFreeze";
import { supabase } from "@/lib/supabase";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { creaSalLavorazioniFoto } from "@/services/sal/creaSalLavorazioniFoto";
import { loadSalLavorazioniFoto } from "@/services/sal/loadSalLavorazioniFoto";
import { loadSalCantiere } from "@/services/lavorazioni/loadSalCantiere";
import {
  loadSalCollaborazioni,
  type LavorazioneCollaboratore,
} from "@/services/collaborazioni/loadSalCollaborazioni";
import type { CantiereBackoffice } from "@/types/cantieri";
import type {
  SalLavorazioneFoto,
  SalCantiere,
  StatoSalLavorazione,
} from "@/types/sal";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────

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

function getStatoBadgeVariant(
  stato: StatoSalLavorazione
) {
  if (stato === SAL_STATI.NON_INIZIATA) {
    return "muted";
  }

  if (stato === SAL_STATI.COMPLETATA) {
    return "success";
  }

  return "warning";
}

function formattaOreUomo(minutiTotali: number) {
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;

  return `${ore}h ${minuti}m`;
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

function getProgressBarClass(percentuale: number) {
  if (percentuale === 0) {
    return "bg-border";
  }
  if (percentuale <= 30) {
    return "bg-warning-500";
  }
  if (percentuale <= 70) {
    return "bg-info-500";
  }
  if (percentuale < 100) {
    return "bg-brand-500";
  }
  return "bg-success-500";
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function BackofficeSalPage() {
  const toast = useToast();

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
  const [lavorazioniCollab, setLavorazioniCollab] =
    useState<LavorazioneCollaboratore[]>([]);
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

        setCantieri(dati);
      } catch (error: unknown) {
        if (attivo) {
          toast.error(getMessaggioErrore(error, SAL_TESTI.ERRORI.GENERICO));
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
  }, [toast]);

  useEffect(() => {
    let attivo = true;

    const caricaSalEFoto = async () => {
      if (!cantiereId) {
        setSal(null);
        setFotoLavorazioni([]);
        setLavorazioniCollab([]);
        setLoadingSal(false);
        setLoadingFoto(false);
        return;
      }

      try {
        setLoadingSal(true);
        setLoadingFoto(true);

        const [salCaricato, fotoCaricate, collabCaricate] =
          await Promise.all([
            loadSalCantiere(cantiereId),
            loadSalLavorazioniFoto({
              cantiereId,
              dataRiferimento,
              limit: 12,
            }),
            loadSalCollaborazioni({ cantiereCommittenteId: cantiereId }),
          ]);

        if (!attivo) {
          return;
        }

        setSal(salCaricato);
        setFotoLavorazioni(fotoCaricate);
        setLavorazioniCollab(collabCaricate);
      } catch (error: unknown) {
        if (attivo) {
          toast.error(getMessaggioErrore(error, SAL_TESTI.ERRORI.GENERICO));
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
  }, [cantiereId, dataRiferimento, toast]);

  const handleCantiereChange = (
    nextCantiereId: string
  ) => {
    setCantiereId(nextCantiereId);
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
      toast.error(getMessaggioErrore(error, SAL_TESTI.ERRORI.GENERICO));
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
      toast.success("Foto caricate con successo");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, SAL_TESTI.ERRORI.GENERICO));
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
      toast.success("PDF scaricato");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, SAL_TESTI.ERRORI.GENERICO));
    } finally {
      setLoadingPdf(false);
    }
  };

  const loading = loadingCantieri || loadingSal;

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            <Link href={APP_ROUTES.BACKOFFICE}>
              <Button variant="secondary" size="sm">
                Back-office
              </Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">
                Timbrature
              </Button>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-[1200px] px-6 py-6 space-y-6">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link href={APP_ROUTES.BACKOFFICE} className="hover:text-text-primary transition-colors duration-150">
            Back-office
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{SAL_TESTI.TITOLO}</span>
        </nav>

        {/* Titolo + Esporta PDF */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="font-heading text-2xl font-medium text-text-primary">
            {SAL_TESTI.TITOLO}
          </h1>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={() => void handleEsportaPdf()}
            loading={loadingPdf}
            disabled={!cantiereId}
          >
            Esporta PDF
          </Button>
        </div>

        {/* Selezione Cantiere */}
        <Card className="p-5">
          <Select
            label={SAL_TESTI.CANTIERE}
            value={cantiereId}
            onChange={(e) =>
              handleCantiereChange(e.target.value)
            }
            disabled={loadingCantieri}
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
          </Select>
        </Card>

        {/* SAL Freeze Info Card */}
        <Card className="border-info-500/30 bg-info-50 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <CalendarRange className="h-6 w-6 text-info-500 mt-0.5" />
              </div>
              <div>
                <h2 className="font-medium text-text-primary">
                  SAL Periodico
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  Hai bisogno di un consolidato periodico? Crea e gestisci i freeze SAL.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
              <Link
                href={
                  cantiereId
                    ? `${APP_ROUTES.BACKOFFICE_SAL_FREEZE}?cantiere=${encodeURIComponent(cantiereId)}`
                    : APP_ROUTES.BACKOFFICE_SAL_FREEZE
                }
              >
                <Button variant="primary" size="sm">
                  {SAL_FREEZE_TESTI.CREA_FREEZE}
                </Button>
              </Link>
              <Link
                href={
                  cantiereId
                    ? `${APP_ROUTES.BACKOFFICE_SAL_FREEZE}?cantiere=${encodeURIComponent(cantiereId)}`
                    : APP_ROUTES.BACKOFFICE_SAL_FREEZE
                }
              >
                <Button variant="secondary" size="sm">
                  {SAL_FREEZE_TESTI.LISTA_FREEZE}
                </Button>
              </Link>
            </div>
          </div>
        </Card>

        {loading && (
          <Card className="p-5">
            <p className="text-text-muted">{SAL_TESTI.CARICAMENTO}</p>
          </Card>
        )}

        {!loadingCantieri && cantieri.length === 0 && (
          <Card className="p-5">
            <p className="text-text-muted">{SAL_TESTI.NESSUN_CANTIERE}</p>
          </Card>
        )}

        {!loading && sal && (
          <>
            {/* KPI Section - 4 mini cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-xs text-text-muted mb-1">Avanzamento</p>
                <p className="text-3xl font-semibold text-text-primary">
                  {sal.avanzamentoTotale}%
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-text-muted mb-1">Ore uomo</p>
                <p className="text-3xl font-semibold text-text-primary">
                  {formattaOreUomo(sal.oreUomoTotaliMinuti)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-text-muted mb-1">Completate</p>
                <p className="text-3xl font-semibold text-success-500">
                  {sal.lavorazioni.filter(
                    (l) => l.stato === SAL_STATI.COMPLETATA
                  ).length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-text-muted mb-1">In corso</p>
                <p className="text-3xl font-semibold text-brand-500">
                  {sal.lavorazioni.filter(
                    (l) => l.stato === SAL_STATI.IN_CORSO
                  ).length}
                </p>
              </Card>
            </div>

            {/* Lavorazioni List */}
            <div className="space-y-4">
              <h2 className="font-heading text-lg font-medium text-text-primary">
                {SAL_TESTI.LAVORAZIONI_ATTIVE}
              </h2>

              {sal.lavorazioni.length === 0 ? (
                <Card className="p-5">
                  <p className="text-text-muted">
                    {SAL_TESTI.NESSUNA_LAVORAZIONE}
                  </p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {sal.lavorazioni.map((lavorazione) => (
                    <Card
                      key={lavorazione.id}
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-medium text-text-primary">
                            {lavorazione.nome}
                          </h3>
                          <p className="text-xs text-text-muted mt-1">
                            Percentuale: {lavorazione.percentuale_completamento}% • Ore: {formattaOreUomo(lavorazione.oreUomoMinuti)}
                          </p>
                        </div>
                        <Badge
                          variant={getStatoBadgeVariant(
                            lavorazione.stato
                          )}
                          size="sm"
                        >
                          {getStatoLabel(lavorazione.stato)}
                        </Badge>
                      </div>

                      {/* Progress bar con colori dinamici */}
                      <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            getProgressBarClass(
                              lavorazione.percentuale_completamento
                            )
                          )}
                          style={{
                            width: `${lavorazione.percentuale_completamento}%`,
                          }}
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Lavorazioni subappaltatore (collaborazioni) */}
            {lavorazioniCollab.length > 0 && (
              <div className="space-y-4">
                <h2 className="font-heading text-lg font-medium text-text-primary">
                  Lavorazioni subappaltatore
                </h2>
                {Array.from(
                  new Set(lavorazioniCollab.map((l) => l.azienda_collaboratrice_nome))
                ).map((azienda) => (
                  <Card key={azienda} className="p-4">
                    <p className="text-sm font-medium text-text-primary mb-3">
                      {azienda}
                    </p>
                    <div className="space-y-3">
                      {lavorazioniCollab
                        .filter((l) => l.azienda_collaboratrice_nome === azienda)
                        .map((l, i) => (
                          <div key={`${azienda}-${i}`}>
                            <div className="flex items-center justify-between gap-3 mb-1">
                              <span className="text-sm text-text-primary">
                                {l.lavorazione_nome}
                              </span>
                              <span className="text-xs text-text-muted">
                                {l.percentuale_completamento}%
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-border overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  getProgressBarClass(l.percentuale_completamento)
                                )}
                                style={{ width: `${l.percentuale_completamento}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Foto Lavorazioni Section */}
        <div className="space-y-6">
          {/* Carica nuove foto */}
          <Card className="p-5">
            <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
              Carica nuove foto
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={SAL_TESTI.DATA_RIFERIMENTO}
                  type="date"
                  value={dataRiferimento}
                  onChange={(e) =>
                    handleDataRiferimentoChange(e.target.value)
                  }
                />

                <Select
                  label={SAL_TESTI.SELEZIONA_LAVORAZIONE}
                  value={fotoLavorazioneId}
                  onChange={(e) =>
                    setFotoLavorazioneId(e.target.value)
                  }
                  disabled={
                    loadingSal ||
                    sal?.lavorazioni.length === 0
                  }
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
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-text-primary">
                  {SAL_TESTI.DESCRIZIONE_FOTO}
                </label>
                <textarea
                  value={fotoDescrizione}
                  onChange={(e) =>
                    setFotoDescrizione(e.target.value)
                  }
                  rows={2}
                  className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 resize-none"
                  placeholder="Descrizione della foto (opzionale)"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <FileInputPicker
                    label={SAL_TESTI.CARICA_FOTO}
                    buttonLabel={SAL_TESTI.AGGIUNGI_FOTO}
                    emptyLabel={
                      SAL_TESTI.NESSUNA_FOTO_SELEZIONATA
                    }
                    selectedFileNames={fotoDaCaricare.map(
                      (foto) => foto.fileName
                    )}
                    accept="image/*"
                    multiple
                    onChange={handleFotoInputChange}
                  />
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSalvaFoto}
                  loading={salvataggioFoto}
                  disabled={
                    salvataggioFoto ||
                    fotoDaCaricare.length === 0 ||
                    !cantiereId
                  }
                  className="h-fit"
                >
                  Salva foto
                </Button>
              </div>
            </div>

            {/* Anteprima foto in coda */}
            {fotoDaCaricare.length > 0 && (
              <div className="mt-5 space-y-3">
                <p className="text-sm font-medium text-text-muted">
                  Anteprima foto selezionate
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {fotoDaCaricare.map((foto) => (
                    <div
                      key={foto.localId}
                      className="relative group"
                    >
                      <Image
                        src={foto.immagine_data_url}
                        alt={foto.fileName}
                        width={160}
                        height={160}
                        className="h-40 w-full rounded-md border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleEliminaFotoDaCaricare(
                            foto.localId
                          )
                        }
                        className="absolute top-1 right-1 p-1 rounded bg-error-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <p className="text-xs text-text-muted mt-1 truncate">
                        {foto.fileName}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Galleria recente */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-lg font-medium text-text-primary">
                {SAL_TESTI.GALLERIA_RECENTE}
              </h2>
              {loadingFoto && (
                <span className="text-xs text-text-muted">
                  {SAL_TESTI.CARICAMENTO}
                </span>
              )}
            </div>

            {!loadingFoto &&
              fotoLavorazioni.length === 0 && (
                <p className="text-sm text-text-muted">
                  {SAL_TESTI.NESSUNA_FOTO}
                </p>
              )}

            {fotoLavorazioni.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {fotoLavorazioni.map((foto) => (
                  <article
                    key={foto.id}
                    className="space-y-2"
                  >
                    <Image
                      src={foto.immagine_data_url}
                      alt={foto.descrizione || foto.id}
                      width={200}
                      height={200}
                      className="h-40 w-full rounded-md border border-border object-cover"
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-text-primary line-clamp-2">
                        {foto.descrizione ||
                          "(senza descrizione)"}
                      </p>
                      <p className="text-xs text-text-muted">
                        {formattaDataBreve(
                          foto.data_riferimento
                        )}
                        {foto.lavorazione_id &&
                          lavorazioniById.get(
                            foto.lavorazione_id
                          ) && (
                            <>
                              {" "}
                              • {
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
          </Card>
        </div>
      </main>
    </div>
  );
}
