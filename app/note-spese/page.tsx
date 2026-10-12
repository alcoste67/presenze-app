"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Home } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { NOTE_SPESE_TESTI, LABEL_TIPO_SPESA, LABEL_STATO_NOTA_SPESA, TIPO_SPESA } from "@/constants/noteSpese";
import { dataRomaOggi } from "@/lib/timezoneRoma";
import { comprimiFoto } from "@/lib/compressioneFoto";
import { getMessaggioErrore } from "@/lib/errors";
import { uploadFotoScontrino } from "@/services/noteSpese/uploadFotoScontrino";
import { creaNotaSpesaClient } from "@/services/noteSpese/creaNotaSpesaClient";
import { fetchNoteSpese } from "@/services/noteSpese/fetchNoteSpese";
import { fetchNoteChilometri } from "@/services/noteSpese/fetchNoteChilometri";
import { salvaNotaChilometriClient } from "@/services/noteSpese/salvaNotaChilometriClient";
import type { NotaSpesa, TipoSpesa } from "@/types/noteSpese";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

const TESTI = NOTE_SPESE_TESTI;
const TIPI_SPESA_LISTA: TipoSpesa[] = [
  TIPO_SPESA.PASTO,
  TIPO_SPESA.MATERIALE,
  TIPO_SPESA.FATTURA,
  TIPO_SPESA.ALTRO,
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

const BADGE_STATO: Record<string, string> = {
  IN_ATTESA: "bg-warning-50 text-warning-500",
  APPROVATA: "bg-success-50 text-success-500",
  RIFIUTATA: "bg-error-50 text-error-500",
};

export default function NoteSpesePage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);

  const [dataSpesa, setDataSpesa] = useState(dataRomaOggi());
  const [tipoSpesa, setTipoSpesa] = useState<TipoSpesa>(TIPO_SPESA.PASTO);
  const [importo, setImporto] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [invioSpesaInCorso, setInvioSpesaInCorso] = useState(false);

  const [usaAutoPropria, setUsaAutoPropria] = useState(false);
  const [dataKm, setDataKm] = useState(dataRomaOggi());
  const [km, setKm] = useState("");
  const [invioKmInCorso, setInvioKmInCorso] = useState(false);

  const [noteSpese, setNoteSpese] = useState<NotaSpesa[]>([]);

  const caricaTutto = async () => {
    const [note, chilometri] = await Promise.all([
      fetchNoteSpese(),
      fetchNoteChilometri({ dataInizio: dataRomaOggi(), dataFine: dataRomaOggi() }),
    ]);
    setNoteSpese(note);
    setUsaAutoPropria(chilometri.usaAutoPropria);
    if (chilometri.note[0]) {
      setKm(String(chilometri.note[0].km));
    }
  };

  useEffect(() => {
    let attivo = true;

    (async () => {
      try {
        await caricaTutto();
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, TESTI.ERRORI.CARICAMENTO));
      } finally {
        if (attivo) setLoading(false);
      }
    })();

    return () => {
      attivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInviaSpesa = async () => {
    const importoNumero = Number(importo.replace(",", "."));
    if (!dataSpesa) {
      toast.error(TESTI.ERRORI.DATA_OBBLIGATORIA);
      return;
    }
    if (!importoNumero || importoNumero <= 0) {
      toast.error(TESTI.ERRORI.IMPORTO_NON_VALIDO);
      return;
    }
    if (!fotoFile) {
      toast.error(TESTI.ERRORI.FOTO_OBBLIGATORIA);
      return;
    }

    try {
      setInvioSpesaInCorso(true);
      const blob = await comprimiFoto(fotoFile);
      const fotoScontrinoPath = await uploadFotoScontrino(blob);

      await creaNotaSpesaClient({
        data: dataSpesa,
        tipo: tipoSpesa,
        importo: importoNumero,
        descrizione: descrizione.trim(),
        fotoScontrinoPath,
      });

      setImporto("");
      setDescrizione("");
      setFotoFile(null);
      toast.success(TESTI.SEZIONE_SPESA.INVIATA);
      await caricaTutto();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, TESTI.ERRORI.SALVATAGGIO));
    } finally {
      setInvioSpesaInCorso(false);
    }
  };

  const handleSalvaKm = async () => {
    const kmNumero = Number(km.replace(",", "."));
    if (!dataKm || !Number.isFinite(kmNumero) || kmNumero < 0) {
      toast.error(TESTI.ERRORI.KM_NON_VALIDI);
      return;
    }

    try {
      setInvioKmInCorso(true);
      await salvaNotaChilometriClient({ data: dataKm, km: kmNumero });
      toast.success(TESTI.SEZIONE_KM.SALVATI);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, TESTI.ERRORI.SALVATAGGIO));
    } finally {
      setInvioKmInCorso(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader />

      <main className="mx-auto max-w-[560px] px-5 py-6">
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{TESTI.TITOLO}</span>
        </nav>

        <h1 className="font-heading text-2xl font-medium text-text-primary">{TESTI.TITOLO}</h1>
        <p className="mt-1 text-sm text-text-muted">{TESTI.SOTTOTITOLO}</p>

        {loading ? (
          <p className="mt-6 text-sm text-text-muted">Caricamento...</p>
        ) : (
          <div className="mt-5 flex flex-col gap-5">
            {usaAutoPropria && (
              <Card className="p-5">
                <h2 className="font-heading text-lg font-medium text-text-primary">
                  {TESTI.SEZIONE_KM.TITOLO}
                </h2>
                <div className="mt-4 flex gap-3">
                  <div className="min-w-0 flex-1">
                    <Input
                      label="Data"
                      type="date"
                      className="w-full min-w-0"
                      value={dataKm}
                      onChange={(e) => setDataKm(e.target.value)}
                      disabled={invioKmInCorso}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Input
                      label={TESTI.SEZIONE_KM.ETICHETTA_KM}
                      type="number"
                      min="0"
                      step="0.1"
                      className="w-full min-w-0"
                      value={km}
                      onChange={(e) => setKm(e.target.value)}
                      disabled={invioKmInCorso}
                    />
                  </div>
                </div>
                <Button
                  className="mt-4 w-full"
                  loading={invioKmInCorso}
                  onClick={() => void handleSalvaKm()}
                >
                  {TESTI.SEZIONE_KM.CONFERMA}
                </Button>
              </Card>
            )}

            <Card className="p-5">
              <h2 className="font-heading text-lg font-medium text-text-primary">
                {TESTI.SEZIONE_SPESA.TITOLO}
              </h2>
              <div className="mt-4 flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <Input
                      label={TESTI.SEZIONE_SPESA.ETICHETTA_DATA}
                      type="date"
                      className="w-full min-w-0"
                      value={dataSpesa}
                      onChange={(e) => setDataSpesa(e.target.value)}
                      disabled={invioSpesaInCorso}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Select
                      label={TESTI.SEZIONE_SPESA.ETICHETTA_TIPO}
                      className="w-full min-w-0"
                      value={tipoSpesa}
                      onChange={(e) => setTipoSpesa(e.target.value as TipoSpesa)}
                      disabled={invioSpesaInCorso}
                    >
                      {TIPI_SPESA_LISTA.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {LABEL_TIPO_SPESA[tipo]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <Input
                  label={TESTI.SEZIONE_SPESA.ETICHETTA_IMPORTO}
                  type="number"
                  min="0"
                  step="0.01"
                  value={importo}
                  onChange={(e) => setImporto(e.target.value)}
                  disabled={invioSpesaInCorso}
                />

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-text-primary">
                    {TESTI.SEZIONE_SPESA.ETICHETTA_DESCRIZIONE}
                  </span>
                  <textarea
                    value={descrizione}
                    onChange={(e) => setDescrizione(e.target.value)}
                    disabled={invioSpesaInCorso}
                    rows={2}
                    className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-text-primary">
                    {TESTI.SEZIONE_SPESA.ETICHETTA_FOTO}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={invioSpesaInCorso}
                    onChange={(e) => setFotoFile(e.target.files?.[0] || null)}
                    className="text-sm text-text-primary"
                  />
                </label>
              </div>

              <Button
                className="mt-4 w-full"
                loading={invioSpesaInCorso}
                onClick={() => void handleInviaSpesa()}
              >
                {TESTI.SEZIONE_SPESA.CONFERMA}
              </Button>
            </Card>

            <div className="flex flex-col gap-3">
              <h2 className="font-heading text-lg font-medium text-text-primary">
                {TESTI.ELENCO.TITOLO}
              </h2>
              {noteSpese.length === 0 ? (
                <Card className="p-5">
                  <p className="text-sm text-text-muted">{TESTI.ELENCO.NESSUNA}</p>
                </Card>
              ) : (
                noteSpese.map((nota) => (
                  <Card key={nota.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {LABEL_TIPO_SPESA[nota.tipo]} — {formattaImporto(nota.importo)}
                        </p>
                        <p className="text-xs text-text-muted">{formattaData(nota.data)}</p>
                        {nota.descrizione && (
                          <p className="mt-1 text-xs text-text-muted">{nota.descrizione}</p>
                        )}
                        {nota.stato === "RIFIUTATA" && nota.notaRifiuto && (
                          <p className="mt-1 text-xs text-error-500">{nota.notaRifiuto}</p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${BADGE_STATO[nota.stato] || ""}`}
                      >
                        {LABEL_STATO_NOTA_SPESA[nota.stato]}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
