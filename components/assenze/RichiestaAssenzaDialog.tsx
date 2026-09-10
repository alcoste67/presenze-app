"use client";

import { useState } from "react";

import { ASSENZE_TESTI } from "@/constants/assenze";
import { getMessaggioErrore } from "@/lib/errors";
import { creaRichiestaAssenzaClient } from "@/services/assenze/salvaRichiestaAssenza";
import type { TipoAssenza } from "@/types/assenze";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

type Props = {
  tipo: TipoAssenza;
  onClose: () => void;
  onInviata: () => void;
};

function getDataOggiInput() {
  const oggi = new Date();
  const year = oggi.getFullYear();
  const month = String(oggi.getMonth() + 1).padStart(2, "0");
  const day = String(oggi.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function RichiestaAssenzaDialog({ tipo, onClose, onInviata }: Props) {
  const toast = useToast();
  const oggi = getDataOggiInput();

  const [dataInizio, setDataInizio] = useState(oggi);
  const [dataFine, setDataFine] = useState(oggi);
  const [giornataIntera, setGiornataIntera] = useState(true);
  const [ore, setOre] = useState("4");
  const [nota, setNota] = useState("");
  const [invio, setInvio] = useState(false);

  const titolo =
    tipo === "FERIE" ? ASSENZE_TESTI.RICHIEDI_FERIE : ASSENZE_TESTI.RICHIEDI_PERMESSO;

  const handleInvia = async () => {
    const oreNumero = Number(ore);
    if (!giornataIntera && (!oreNumero || oreNumero <= 0)) {
      toast.error(ASSENZE_TESTI.ERRORI.ORE_OBBLIGATORIE);
      return;
    }
    if (giornataIntera && dataFine < dataInizio) {
      toast.error(ASSENZE_TESTI.ERRORI.INTERVALLO_NON_VALIDO);
      return;
    }

    try {
      setInvio(true);
      await creaRichiestaAssenzaClient({
        tipo,
        dataInizio,
        dataFine: giornataIntera ? dataFine : dataInizio,
        giornataIntera,
        ore: giornataIntera ? null : oreNumero,
        nota,
      });
      toast.success(ASSENZE_TESTI.MESSAGGI.INVIATA);
      onInviata();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ASSENZE_TESTI.ERRORI.SALVATAGGIO));
    } finally {
      setInvio(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-text-primary/60 p-3 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <Card className="w-full max-w-md p-5">
        <h2 className="font-heading text-lg font-medium text-text-primary">{titolo}</h2>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={giornataIntera ? "primary" : "secondary"}
              className="flex-1"
              onClick={() => setGiornataIntera(true)}
              disabled={invio}
            >
              {ASSENZE_TESTI.GIORNATA_INTERA}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={!giornataIntera ? "primary" : "secondary"}
              className="flex-1"
              onClick={() => setGiornataIntera(false)}
              disabled={invio}
            >
              {ASSENZE_TESTI.PARZIALE}
            </Button>
          </div>

          {giornataIntera ? (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={ASSENZE_TESTI.DATA_INIZIO}
                type="date"
                value={dataInizio}
                onChange={(e) => {
                  setDataInizio(e.target.value);
                  if (e.target.value > dataFine) setDataFine(e.target.value);
                }}
                disabled={invio}
              />
              <Input
                label={ASSENZE_TESTI.DATA_FINE}
                type="date"
                min={dataInizio}
                value={dataFine}
                onChange={(e) => setDataFine(e.target.value)}
                disabled={invio}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={ASSENZE_TESTI.DATA_INIZIO}
                type="date"
                value={dataInizio}
                onChange={(e) => setDataInizio(e.target.value)}
                disabled={invio}
              />
              <Input
                label={ASSENZE_TESTI.ORE}
                type="number"
                min="1"
                max="12"
                value={ore}
                onChange={(e) => setOre(e.target.value)}
                disabled={invio}
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-text-primary">
              {ASSENZE_TESTI.NOTA}
            </label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder={ASSENZE_TESTI.NOTA_PLACEHOLDER}
              disabled={invio}
              rows={2}
              className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Button className="flex-1" loading={invio} onClick={() => void handleInvia()}>
            {ASSENZE_TESTI.INVIA_RICHIESTA}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={invio}>
            {ASSENZE_TESTI.ANNULLA}
          </Button>
        </div>
      </Card>
    </div>
  );
}
