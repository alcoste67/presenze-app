"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";

import { attivaPromemoriaPush, statoPermessoPush } from "@/services/push/registraPush";
import { getMessaggioErrore } from "@/lib/errors";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

const STORAGE_KEY = "cantivo_push_banner_chiuso";

/** Banner per attivare i promemoria push (timbratura mancante mattina/sera). */
export function PushOptIn() {
  const toast = useToast();
  const [visibile, setVisibile] = useState(false);
  const [attivazioneInCorso, setAttivazioneInCorso] = useState(false);

  useEffect(() => {
    const chiusoInPrecedenza = window.localStorage.getItem(STORAGE_KEY) === "1";
    setVisibile(!chiusoInPrecedenza && statoPermessoPush() === "default");
  }, []);

  const chiudi = () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setVisibile(false);
  };

  const attiva = async () => {
    try {
      setAttivazioneInCorso(true);
      await attivaPromemoriaPush();
      toast.success("Promemoria attivati su questo dispositivo");
      setVisibile(false);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Attivazione non riuscita"));
    } finally {
      setAttivazioneInCorso(false);
    }
  };

  if (!visibile) return null;

  return (
    <Card className="p-4 flex items-start gap-3 border-brand-500/30 bg-brand-50">
      <BellRing className="h-5 w-5 shrink-0 text-brand-600" />
      <div className="flex-1 space-y-2">
        <p className="text-sm font-medium text-text-primary">
          Attiva i promemoria di timbratura
        </p>
        <p className="text-xs text-text-muted">
          Un avviso alle 8:00 se non hai ancora timbrato l&apos;entrata, e uno alle
          17:00 se non hai ancora timbrato l&apos;uscita.
        </p>
        <div className="flex gap-2">
          <Button size="sm" loading={attivazioneInCorso} onClick={() => void attiva()}>
            Attiva
          </Button>
          <Button size="sm" variant="secondary" disabled={attivazioneInCorso} onClick={chiudi}>
            Non ora
          </Button>
        </div>
      </div>
    </Card>
  );
}
