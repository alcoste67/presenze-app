"use client";

import { useState } from "react";

import { ASSENZE_TESTI } from "@/constants/assenze";
import { BLOCCO_GIORNO_PRECEDENTE_TESTI } from "@/constants/bloccoGiornoPrecedente";
import { dataRomaDi } from "@/lib/timezoneRoma";
import { getMessaggioErrore } from "@/lib/errors";
import { chiudiTurnoPrecedenteClient } from "@/services/timbrature/chiudiTurnoPrecedenteClient";
import { creaRichiestaAssenzaClient } from "@/services/assenze/salvaRichiestaAssenza";
import type { BloccoGiornoPrecedente as BloccoGiornoPrecedenteInfo } from "@/types/bloccoGiornoPrecedente";
import type { TipoAssenza } from "@/types/assenze";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const TESTI = BLOCCO_GIORNO_PRECEDENTE_TESTI;

function formattaData(dataYYYYMMDD: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${dataYYYYMMDD}T12:00:00Z`));
}

function formattaDataOra(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function oraRomaDi(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function ChiudiTurnoAperto({
  apertoDalle,
  onRisolto,
}: {
  apertoDalle: string;
  onRisolto: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState(dataRomaDi(apertoDalle));
  const [ora, setOra] = useState(oraRomaDi(new Date().toISOString()));
  const [invio, setInvio] = useState(false);

  const handleConferma = async () => {
    if (!data || !ora) {
      toast.error(TESTI.ERRORI.ORARIO_OBBLIGATORIO);
      return;
    }

    try {
      setInvio(true);
      await chiudiTurnoPrecedenteClient({ data, ora });
      toast.success(TESTI.TURNO_APERTO.CHIUSO);
      onRisolto();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, TESTI.ERRORI.GENERICO));
    } finally {
      setInvio(false);
    }
  };

  return (
    <Card className="border-warning-500/40 bg-warning-50 p-5">
      <h2 className="font-heading text-lg font-medium text-text-primary">
        {TESTI.TURNO_APERTO.TITOLO}
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        {TESTI.TURNO_APERTO.DESCRIZIONE_PREFIX} {formattaDataOra(apertoDalle)}:{" "}
        {TESTI.TURNO_APERTO.DESCRIZIONE_SUFFIX}
      </p>

      <div className="mt-4 flex gap-3">
        <div className="min-w-0 flex-1">
          <Input
            label="Data"
            type="date"
            className="w-full min-w-0"
            value={data}
            onChange={(e) => setData(e.target.value)}
            disabled={invio}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Input
            label={TESTI.TURNO_APERTO.ETICHETTA_ORARIO}
            type="time"
            className="w-full min-w-0"
            value={ora}
            onChange={(e) => setOra(e.target.value)}
            disabled={invio}
          />
        </div>
      </div>

      <Button className="mt-4 w-full" loading={invio} onClick={() => void handleConferma()}>
        {TESTI.TURNO_APERTO.CONFERMA}
      </Button>
    </Card>
  );
}

function GiustificaGiornataVuota({
  data,
  onRisolto,
}: {
  data: string;
  onRisolto: () => void;
}) {
  const toast = useToast();
  const [tipo, setTipo] = useState<TipoAssenza>("FERIE");
  const [nota, setNota] = useState("");
  const [invio, setInvio] = useState(false);

  const handleConferma = async () => {
    try {
      setInvio(true);
      await creaRichiestaAssenzaClient({
        tipo,
        dataInizio: data,
        dataFine: data,
        giornataIntera: true,
        ore: null,
        nota: nota.trim(),
      });
      toast.success(TESTI.GIORNATA_VUOTA.INVIATA);
      onRisolto();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, TESTI.ERRORI.GENERICO));
    } finally {
      setInvio(false);
    }
  };

  return (
    <Card className="border-warning-500/40 bg-warning-50 p-5">
      <h2 className="font-heading text-lg font-medium text-text-primary">
        {TESTI.GIORNATA_VUOTA.TITOLO}
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        {TESTI.GIORNATA_VUOTA.DESCRIZIONE_PREFIX} {formattaData(data)}:{" "}
        {TESTI.GIORNATA_VUOTA.DESCRIZIONE_SUFFIX}
      </p>

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={tipo === "FERIE" ? "primary" : "secondary"}
          className="flex-1"
          onClick={() => setTipo("FERIE")}
          disabled={invio}
        >
          {ASSENZE_TESTI.FERIE}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tipo === "PERMESSO" ? "primary" : "secondary"}
          className="flex-1"
          onClick={() => setTipo("PERMESSO")}
          disabled={invio}
        >
          {ASSENZE_TESTI.PERMESSO}
        </Button>
      </div>

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-sm font-medium text-text-primary">
          {TESTI.GIORNATA_VUOTA.ETICHETTA_NOTA}
        </span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          disabled={invio}
          rows={2}
          className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </label>

      <Button className="mt-4 w-full" loading={invio} onClick={() => void handleConferma()}>
        {TESTI.GIORNATA_VUOTA.CONFERMA}
      </Button>
    </Card>
  );
}

export function BloccoGiornoPrecedente({
  blocco,
  onRisolto,
}: {
  blocco: BloccoGiornoPrecedenteInfo;
  onRisolto: () => void;
}) {
  if (blocco.tipo === "TURNO_APERTO") {
    return <ChiudiTurnoAperto apertoDalle={blocco.apertoDalle} onRisolto={onRisolto} />;
  }

  return <GiustificaGiornataVuota data={blocco.data} onRisolto={onRisolto} />;
}
