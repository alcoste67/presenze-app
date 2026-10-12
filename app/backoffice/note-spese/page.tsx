"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Home, ImageIcon } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import {
  LABEL_STATO_NOTA_SPESA,
  LABEL_TIPO_SPESA,
  NOTE_SPESE_TESTI,
  STATO_NOTA_SPESA,
} from "@/constants/noteSpese";
import { getMessaggioErrore } from "@/lib/errors";
import { fetchNoteSpese } from "@/services/noteSpese/fetchNoteSpese";
import { approvaNotaSpesaClient } from "@/services/noteSpese/approvaNotaSpesaClient";
import { creaUrlFotoScontrino } from "@/services/noteSpese/creaUrlFotoScontrino";
import type { NotaSpesa, StatoNotaSpesa } from "@/types/noteSpese";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

const TESTI = NOTE_SPESE_TESTI;

const BADGE_VARIANT_STATO: Record<StatoNotaSpesa, BadgeProps["variant"]> = {
  IN_ATTESA: "warning",
  APPROVATA: "success",
  RIFIUTATA: "error",
};

const FILTRI_STATO: Array<{ value: StatoNotaSpesa | "TUTTE"; label: string }> = [
  { value: STATO_NOTA_SPESA.IN_ATTESA, label: "In attesa" },
  { value: STATO_NOTA_SPESA.APPROVATA, label: "Approvate" },
  { value: STATO_NOTA_SPESA.RIFIUTATA, label: "Rifiutate" },
  { value: "TUTTE", label: "Tutte" },
];

function formattaData(data: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${data}T12:00:00Z`));
}

function formattaImporto(importo: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(importo);
}

export default function BackofficeNoteSpesePage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [filtroStato, setFiltroStato] = useState<StatoNotaSpesa | "TUTTE">(
    STATO_NOTA_SPESA.IN_ATTESA
  );
  const [note, setNote] = useState<NotaSpesa[]>([]);
  const [azioneInCorsoId, setAzioneInCorsoId] = useState<string | null>(null);
  const [approvazioneRichiesta, setApprovazioneRichiesta] = useState<NotaSpesa | null>(null);
  const [rifiutoApertoId, setRifiutoApertoId] = useState<string | null>(null);
  const [motivoRifiuto, setMotivoRifiuto] = useState("");

  const carica = async (stato: StatoNotaSpesa | "TUTTE") => {
    setLoading(true);
    try {
      const risultato = await fetchNoteSpese(stato === "TUTTE" ? {} : { stato });
      setNote(risultato);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, TESTI.ERRORI.CARICAMENTO));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void carica(filtroStato);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroStato]);

  const handleVediFoto = async (path: string) => {
    try {
      const url = await creaUrlFotoScontrino(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, TESTI.ERRORI.CARICAMENTO));
    }
  };

  const handleApprova = async () => {
    if (!approvazioneRichiesta) return;

    const notaId = approvazioneRichiesta.id;
    setApprovazioneRichiesta(null);
    setAzioneInCorsoId(notaId);
    try {
      await approvaNotaSpesaClient({ notaId, stato: "APPROVATA" });
      toast.success(LABEL_STATO_NOTA_SPESA.APPROVATA);
      await carica(filtroStato);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, TESTI.ERRORI.SALVATAGGIO));
    } finally {
      setAzioneInCorsoId(null);
    }
  };

  const handleRifiuta = async (notaId: string) => {
    const motivo = motivoRifiuto.trim();
    if (!motivo) {
      toast.error(TESTI.ERRORI.NOTA_RIFIUTO_OBBLIGATORIA);
      return;
    }

    setAzioneInCorsoId(notaId);
    try {
      await approvaNotaSpesaClient({ notaId, stato: "RIFIUTATA", notaRifiuto: motivo });
      toast.success(LABEL_STATO_NOTA_SPESA.RIFIUTATA);
      setRifiutoApertoId(null);
      setMotivoRifiuto("");
      await carica(filtroStato);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, TESTI.ERRORI.SALVATAGGIO));
    } finally {
      setAzioneInCorsoId(null);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader />

      <main className="mx-auto max-w-[800px] px-5 py-6">
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link
            href={APP_ROUTES.BACKOFFICE}
            className="hover:text-text-primary transition-colors duration-150"
          >
            Backoffice
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">Note spese</span>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-medium text-text-primary">
            Approvazione note spese
          </h1>
          <Select
            className="w-44"
            value={filtroStato}
            onChange={(e) => setFiltroStato(e.target.value as StatoNotaSpesa | "TUTTE")}
          >
            {FILTRI_STATO.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          {loading ? (
            <p className="text-sm text-text-muted">Caricamento...</p>
          ) : note.length === 0 ? (
            <Card className="p-5">
              <p className="text-sm text-text-muted">{TESTI.ELENCO.NESSUNA}</p>
            </Card>
          ) : (
            note.map((nota) => (
              <Card key={nota.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {nota.dipendenteNome} — {LABEL_TIPO_SPESA[nota.tipo]} —{" "}
                      {formattaImporto(nota.importo)}
                    </p>
                    <p className="text-xs text-text-muted">{formattaData(nota.data)}</p>
                    {nota.descrizione && (
                      <p className="mt-1 text-xs text-text-muted">{nota.descrizione}</p>
                    )}
                    {nota.stato === "RIFIUTATA" && nota.notaRifiuto && (
                      <p className="mt-1 text-xs text-error-500">Motivo: {nota.notaRifiuto}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={BADGE_VARIANT_STATO[nota.stato]}>
                      {LABEL_STATO_NOTA_SPESA[nota.stato]}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ImageIcon className="h-4 w-4" />}
                      onClick={() => void handleVediFoto(nota.fotoScontrinoPath)}
                    >
                      Scontrino
                    </Button>
                  </div>
                </div>

                {nota.stato === "IN_ATTESA" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      loading={azioneInCorsoId === nota.id}
                      onClick={() => setApprovazioneRichiesta(nota)}
                    >
                      Approva
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={azioneInCorsoId === nota.id}
                      onClick={() =>
                        setRifiutoApertoId(rifiutoApertoId === nota.id ? null : nota.id)
                      }
                    >
                      Rifiuta
                    </Button>
                  </div>
                )}

                {rifiutoApertoId === nota.id && (
                  <div className="mt-3 flex flex-col gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-text-primary">
                        Motivo del rifiuto
                      </span>
                      <textarea
                        value={motivoRifiuto}
                        onChange={(e) => setMotivoRifiuto(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                      />
                    </label>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setRifiutoApertoId(null);
                          setMotivoRifiuto("");
                        }}
                      >
                        Annulla
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        loading={azioneInCorsoId === nota.id}
                        onClick={() => void handleRifiuta(nota.id)}
                      >
                        Conferma rifiuto
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </main>

      {approvazioneRichiesta && (
        <ConfirmDialog
          title="Approva spesa"
          message={`Confermi l'approvazione di ${formattaImporto(approvazioneRichiesta.importo)} per ${approvazioneRichiesta.dipendenteNome}?`}
          confirmLabel="Approva"
          onConfirm={() => void handleApprova()}
          onCancel={() => setApprovazioneRichiesta(null)}
        />
      )}
    </div>
  );
}
