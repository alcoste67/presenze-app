"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlarmClock, Home } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { ANOMALIE_TIMBRATURE_TESTI } from "@/constants/anomalieTimbrature";
import { supabase } from "@/lib/supabase";
import { dataRomaDi } from "@/lib/timezoneRoma";
import { getMessaggioErrore } from "@/lib/errors";
import { loadDipendenteByUserId } from "@/services/dipendenti/loadDipendenteByUserId";
import { caricaTurnoAperto } from "@/services/timbrature/caricaTurnoAperto";
import { proponiCorrezioneAdmin } from "@/services/timbrature/proponiCorrezioneAdmin";
import type { TurnoApertoInfo } from "@/types/anomalieTimbrature";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const TESTI = ANOMALIE_TIMBRATURE_TESTI.PAGINA_CORREZIONE;

function oraRomaDi(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
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

export default function CorreggiTimbraturaPage() {
  const router = useRouter();
  const params = useParams<{ dipendenteId: string }>();
  const toast = useToast();

  const dipendenteId = params?.dipendenteId || "";

  const [loading, setLoading] = useState(true);
  const [autorizzato, setAutorizzato] = useState(false);
  const [turno, setTurno] = useState<TurnoApertoInfo | null>(null);
  const [dataUscita, setDataUscita] = useState("");
  const [oraUscita, setOraUscita] = useState("");
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [propostaInviata, setPropostaInviata] = useState(false);

  useEffect(() => {
    let attivo = true;

    const init = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const dipendente = user ? await loadDipendenteByUserId(user.id) : null;
        const puoCorreggere =
          !!dipendente &&
          [RUOLI_DIPENDENTE.ADMIN, RUOLI_DIPENDENTE.SUPERADMIN].includes(
            dipendente.ruolo as typeof RUOLI_DIPENDENTE.ADMIN | typeof RUOLI_DIPENDENTE.SUPERADMIN
          );

        if (!attivo) return;
        if (!puoCorreggere) {
          toast.error(ANOMALIE_TIMBRATURE_TESTI.ERRORI.NON_AUTORIZZATO);
          router.replace(APP_ROUTES.HOME);
          return;
        }
        setAutorizzato(true);

        const dati = await caricaTurnoAperto(dipendenteId);
        if (!attivo) return;

        setTurno(dati);
        if (dati) {
          setDataUscita(dataRomaDi(dati.apertoDalle));
          setOraUscita(oraRomaDi(new Date().toISOString()));
        }
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoading(false);
      }
    };

    void init();
    return () => {
      attivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dipendenteId]);

  const handleConferma = async () => {
    if (!dataUscita || !oraUscita) {
      toast.error(ANOMALIE_TIMBRATURE_TESTI.ERRORI.DATA_ORARIO_OBBLIGATORI);
      return;
    }

    try {
      setInvioInCorso(true);
      await proponiCorrezioneAdmin({ dipendenteId, data: dataUscita, ora: oraUscita });
      setPropostaInviata(true);
      toast.success(TESTI.PROPOSTA_INVIATA);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO));
    } finally {
      setInvioInCorso(false);
    }
  };

  if (!autorizzato && loading) {
    return (
      <div className="min-h-dvh bg-bg-base">
        <AppHeader />
        <main className="mx-auto max-w-[560px] px-5 py-6">
          <p className="text-sm text-text-muted">{TESTI.CARICAMENTO}</p>
        </main>
      </div>
    );
  }

  if (!autorizzato) return null;

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

        {loading && <p className="mt-6 text-sm text-text-muted">{TESTI.CARICAMENTO}</p>}

        {!loading && !turno && (
          <Card className="mt-5 p-5">
            <p className="text-sm text-text-muted">{TESTI.NESSUN_TURNO_APERTO}</p>
          </Card>
        )}

        {!loading && turno && (
          <div className="mt-5 flex flex-col gap-5">
            <Card className="p-5 flex items-start gap-3">
              <AlarmClock className="h-5 w-5 shrink-0 text-warning-500" />
              <div>
                <p className="text-sm font-medium text-text-primary">{turno.dipendenteNome}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {TESTI.APERTO_DALLE} {formattaDataOra(turno.apertoDalle)} — {Math.floor(turno.oreNette)}{" "}
                  {TESTI.ORE_NETTE}
                </p>
              </div>
            </Card>

            {turno.propostaInAttesa ? (
              <Card className="p-5">
                <p className="text-sm text-text-primary">
                  {TESTI.GIA_IN_ATTESA_PREFIX} {formattaDataOra(turno.propostaInAttesa.creatoIl)}, per le{" "}
                  {formattaDataOra(turno.propostaInAttesa.orarioProposto)}.
                </p>
              </Card>
            ) : propostaInviata ? (
              <Card className="p-5">
                <p className="text-sm text-text-primary">{TESTI.PROPOSTA_INVIATA}</p>
              </Card>
            ) : (
              <Card className="p-5">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label={TESTI.ETICHETTA_DATA}
                    type="date"
                    value={dataUscita}
                    onChange={(e) => setDataUscita(e.target.value)}
                    disabled={invioInCorso}
                  />
                  <Input
                    label={TESTI.ETICHETTA_ORARIO}
                    type="time"
                    value={oraUscita}
                    onChange={(e) => setOraUscita(e.target.value)}
                    disabled={invioInCorso}
                  />
                </div>
                <Button className="mt-4 w-full" loading={invioInCorso} onClick={() => void handleConferma()}>
                  {TESTI.CONFERMA}
                </Button>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
