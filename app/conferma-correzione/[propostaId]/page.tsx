"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Home } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { ANOMALIE_TIMBRATURE_TESTI } from "@/constants/anomalieTimbrature";
import { getMessaggioErrore } from "@/lib/errors";
import { caricaPropostaCorrezione } from "@/services/timbrature/caricaPropostaCorrezione";
import { rispondiPropostaCorrezione } from "@/services/timbrature/rispondiPropostaCorrezione";
import type { PropostaCorrezioneInfo } from "@/types/anomalieTimbrature";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";

const TESTI = ANOMALIE_TIMBRATURE_TESTI.PAGINA_CONFERMA;

function formattaDataOra(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function ConfermaCorrezionePage() {
  const params = useParams<{ propostaId: string }>();
  const toast = useToast();

  const propostaId = params?.propostaId || "";

  const [loading, setLoading] = useState(true);
  const [proposta, setProposta] = useState<PropostaCorrezioneInfo | null>(null);
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [mostraRifiuto, setMostraRifiuto] = useState(false);
  const [nota, setNota] = useState("");
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [esito, setEsito] = useState<"CONFERMATA" | "RIFIUTATA" | null>(null);

  useEffect(() => {
    let attivo = true;

    const init = async () => {
      try {
        const dati = await caricaPropostaCorrezione(propostaId);
        if (attivo) setProposta(dati);
      } catch (error: unknown) {
        if (attivo)
          setErroreCaricamento(getMessaggioErrore(error, ANOMALIE_TIMBRATURE_TESTI.ERRORI.PROPOSTA_NON_TROVATA));
      } finally {
        if (attivo) setLoading(false);
      }
    };

    void init();
    return () => {
      attivo = false;
    };
  }, [propostaId]);

  const handleConferma = async () => {
    try {
      setInvioInCorso(true);
      await rispondiPropostaCorrezione({ propostaId, azione: "CONFERMA" });
      setEsito("CONFERMATA");
      toast.success(TESTI.ESITO_CONFERMATO);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO));
    } finally {
      setInvioInCorso(false);
    }
  };

  const handleRifiuta = async () => {
    if (!nota.trim()) {
      toast.error(ANOMALIE_TIMBRATURE_TESTI.ERRORI.NOTA_OBBLIGATORIA_RIFIUTO);
      return;
    }

    try {
      setInvioInCorso(true);
      await rispondiPropostaCorrezione({ propostaId, azione: "RIFIUTA", notaRifiuto: nota.trim() });
      setEsito("RIFIUTATA");
      toast.success(TESTI.ESITO_RIFIUTATO);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO));
    } finally {
      setInvioInCorso(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader />

      <main className="mx-auto max-w-[520px] px-5 py-6">
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{TESTI.TITOLO}</span>
        </nav>

        <h1 className="font-heading text-2xl font-medium text-text-primary">{TESTI.TITOLO}</h1>

        {loading && <p className="mt-6 text-sm text-text-muted">{TESTI.CARICAMENTO}</p>}

        {!loading && erroreCaricamento && (
          <Card className="mt-5 p-5">
            <p className="text-sm text-text-muted">{erroreCaricamento}</p>
          </Card>
        )}

        {!loading && proposta && (
          <div className="mt-5 flex flex-col gap-5">
            {esito ? (
              <Card className="p-5">
                <p className="text-sm text-text-primary">
                  {esito === "CONFERMATA" ? TESTI.ESITO_CONFERMATO : TESTI.ESITO_RIFIUTATO}
                </p>
              </Card>
            ) : proposta.stato !== "IN_ATTESA" ? (
              <Card className="p-5">
                <p className="text-sm text-text-primary">{TESTI.GIA_GESTITA}</p>
              </Card>
            ) : (
              <>
                <Card className="p-5">
                  <p className="text-sm text-text-muted">{TESTI.DESCRIZIONE}</p>
                  <p className="mt-2 text-lg font-medium text-text-primary">
                    {formattaDataOra(proposta.orarioProposto)}
                  </p>
                  {proposta.propostoDaNome && (
                    <p className="mt-1 text-xs text-text-muted">Proposto da {proposta.propostoDaNome}</p>
                  )}
                </Card>

                {!mostraRifiuto ? (
                  <div className="flex flex-col gap-2">
                    <Button loading={invioInCorso} onClick={() => void handleConferma()}>
                      {TESTI.CONFERMA}
                    </Button>
                    <Button variant="secondary" disabled={invioInCorso} onClick={() => setMostraRifiuto(true)}>
                      {TESTI.RIFIUTA}
                    </Button>
                  </div>
                ) : (
                  <Card className="p-5">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-text-primary">{TESTI.ETICHETTA_NOTA}</span>
                      <textarea
                        value={nota}
                        onChange={(e) => setNota(e.target.value)}
                        disabled={invioInCorso}
                        rows={3}
                        className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle"
                      />
                    </label>
                    <div className="mt-3 flex gap-2">
                      <Button loading={invioInCorso} onClick={() => void handleRifiuta()}>
                        {TESTI.INVIA_RIFIUTO}
                      </Button>
                      <Button variant="secondary" disabled={invioInCorso} onClick={() => setMostraRifiuto(false)}>
                        {TESTI.ANNULLA}
                      </Button>
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
