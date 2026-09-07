"use client";

import { useState } from "react";
import { AlarmClock } from "lucide-react";

import { CORREZIONI_TIMBRATURE_TESTI } from "@/constants/correzioniTimbrature";
import { correggiTimbratura } from "@/services/timbrature/correggiTimbratura";
import { getMessaggioErrore } from "@/lib/errors";
import type { TipoAttivita } from "@/types/attivita";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

type Props = {
  tipo: "ENTRATA" | "USCITA";
  cantiereId?: string | null;
  attivitaTipo?: TipoAttivita | "";
  onCorretto: () => void;
};

function oraAttualeInput() {
  const adesso = new Date();
  return `${String(adesso.getHours()).padStart(2, "0")}:${String(adesso.getMinutes()).padStart(2, "0")}`;
}

export function CorrezioneTimbraturaBanner({ tipo, cantiereId, attivitaTipo, onCorretto }: Props) {
  const toast = useToast();
  const [orario, setOrario] = useState(oraAttualeInput);
  const [invioInCorso, setInvioInCorso] = useState(false);

  const testi =
    tipo === "ENTRATA"
      ? {
          titolo: CORREZIONI_TIMBRATURE_TESTI.BANNER.ENTRATA_TITOLO,
          descrizione: CORREZIONI_TIMBRATURE_TESTI.BANNER.ENTRATA_DESCRIZIONE,
        }
      : {
          titolo: CORREZIONI_TIMBRATURE_TESTI.BANNER.USCITA_TITOLO,
          descrizione: CORREZIONI_TIMBRATURE_TESTI.BANNER.USCITA_DESCRIZIONE,
        };

  const handleConferma = async () => {
    try {
      setInvioInCorso(true);
      await correggiTimbratura({
        tipo,
        orario,
        cantiereId: tipo === "ENTRATA" ? cantiereId : undefined,
        attivitaTipo: tipo === "ENTRATA" && attivitaTipo ? attivitaTipo : undefined,
      });
      toast.success(CORREZIONI_TIMBRATURE_TESTI.MESSAGGI.REGISTRATA);
      onCorretto();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, CORREZIONI_TIMBRATURE_TESTI.ERRORI.GENERICO));
    } finally {
      setInvioInCorso(false);
    }
  };

  return (
    <Card className="p-4 flex items-start gap-3 border-warning-500/50 bg-warning-50">
      <AlarmClock className="h-5 w-5 shrink-0 text-warning-500" />
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium text-text-primary">{testi.titolo}</p>
        <p className="text-xs text-text-muted">{testi.descrizione}</p>
        <div className="flex items-center gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-text-muted">
              {CORREZIONI_TIMBRATURE_TESTI.BANNER.ETICHETTA_ORARIO}
            </span>
            <input
              type="time"
              value={orario}
              onChange={(e) => setOrario(e.target.value)}
              disabled={invioInCorso}
              className="h-9 rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
            />
          </label>
          <Button size="sm" loading={invioInCorso} onClick={() => void handleConferma()}>
            {CORREZIONI_TIMBRATURE_TESTI.BANNER.CONFERMA}
          </Button>
        </div>
      </div>
    </Card>
  );
}
