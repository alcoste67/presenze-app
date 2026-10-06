"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlarmClock, Home } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { ANOMALIE_TIMBRATURE_TESTI } from "@/constants/anomalieTimbrature";
import { ASSENZE_TESTI, LABEL_TIPO_ASSENZA, TIPO_ASSENZA } from "@/constants/assenze";
import { supabase } from "@/lib/supabase";
import { dataRomaDi, dataRomaOggi } from "@/lib/timezoneRoma";
import { getMessaggioErrore } from "@/lib/errors";
import { loadDipendenteByUserId } from "@/services/dipendenti/loadDipendenteByUserId";
import { caricaTurnoAperto } from "@/services/timbrature/caricaTurnoAperto";
import { proponiCorrezioneAdmin } from "@/services/timbrature/proponiCorrezioneAdmin";
import { annullaPropostaCorrezioneAdmin } from "@/services/timbrature/annullaPropostaCorrezioneAdmin";
import { compilaGiornataVuotaClient } from "@/services/assenze/fetchCompilaGiornataVuota";
import type { TurnoApertoInfo } from "@/types/anomalieTimbrature";
import type { TipoAssenzaEsteso } from "@/types/assenze";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

const TIPI_GIORNATA_VUOTA: TipoAssenzaEsteso[] = [
  TIPO_ASSENZA.FERIE,
  TIPO_ASSENZA.PERMESSO,
  TIPO_ASSENZA.ALTRO,
];

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
  const [dipendenteNome, setDipendenteNome] = useState("");
  const [dataUscita, setDataUscita] = useState("");
  const [oraUscita, setOraUscita] = useState("");
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [propostaIdInAnnullamento, setPropostaIdInAnnullamento] = useState<string | null>(null);

  const [dataGiornataVuota, setDataGiornataVuota] = useState(dataRomaOggi());
  const [tipoGiornataVuota, setTipoGiornataVuota] = useState<TipoAssenzaEsteso>(
    TIPO_ASSENZA.FERIE
  );
  const [notaGiornataVuota, setNotaGiornataVuota] = useState("");
  const [invioGiornataVuotaInCorso, setInvioGiornataVuotaInCorso] = useState(false);
  const [giornataVuotaCompilata, setGiornataVuotaCompilata] = useState(false);

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

        setDipendenteNome(dati.dipendenteNome);
        setTurno(dati.turnoAperto);
        if (dati.turnoAperto) {
          setDataUscita(dataRomaDi(dati.turnoAperto.apertoDalle));
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
      const dati = await caricaTurnoAperto(dipendenteId);
      setTurno(dati.turnoAperto);
      toast.success(TESTI.PROPOSTA_INVIATA);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO));
    } finally {
      setInvioInCorso(false);
    }
  };

  const handleAnnullaProposta = async (propostaId: string) => {
    try {
      setPropostaIdInAnnullamento(propostaId);
      await annullaPropostaCorrezioneAdmin(propostaId);
      setTurno((precedente) =>
        precedente
          ? {
              ...precedente,
              proposteInAttesa: precedente.proposteInAttesa.filter((p) => p.id !== propostaId),
            }
          : precedente
      );
      toast.success("Proposta annullata");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ANOMALIE_TIMBRATURE_TESTI.ERRORI.GENERICO));
    } finally {
      setPropostaIdInAnnullamento(null);
    }
  };

  const handleCompilaGiornataVuota = async () => {
    if (tipoGiornataVuota === TIPO_ASSENZA.ALTRO && !notaGiornataVuota.trim()) {
      toast.error(ASSENZE_TESTI.ERRORI.NOTA_OBBLIGATORIA_ALTRO);
      return;
    }

    try {
      setInvioGiornataVuotaInCorso(true);
      await compilaGiornataVuotaClient({
        dipendenteId,
        data: dataGiornataVuota,
        tipo: tipoGiornataVuota,
        nota: notaGiornataVuota.trim(),
      });
      setGiornataVuotaCompilata(true);
      setNotaGiornataVuota("");
      toast.success(ASSENZE_TESTI.MESSAGGI.APPROVATA);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ASSENZE_TESTI.ERRORI.SALVATAGGIO));
    } finally {
      setInvioGiornataVuotaInCorso(false);
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
        {!loading && dipendenteNome && (
          <p className="mt-1 text-sm text-text-muted">{dipendenteNome}</p>
        )}

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

            {turno.proposteInAttesa.length > 0 && (
              <Card className="p-5">
                <p className="text-sm font-medium text-text-primary">
                  {turno.proposteInAttesa.length === 1
                    ? "Proposta in attesa di conferma"
                    : `${turno.proposteInAttesa.length} proposte in attesa di conferma`}
                </p>
                <ul className="mt-3 flex flex-col gap-2">
                  {turno.proposteInAttesa.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm text-text-primary">Uscita: {formattaDataOra(p.orarioProposto)}</p>
                        <p className="text-xs text-text-muted">Inviata il {formattaDataOra(p.creatoIl)}</p>
                      </div>
                      <Button
                        variant="secondary"
                        loading={propostaIdInAnnullamento === p.id}
                        onClick={() => void handleAnnullaProposta(p.id)}
                      >
                        Annulla
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-text-muted">
                  Puoi inviare un&apos;altra proposta qui sotto: si aggiungerà a queste, il dipendente
                  le vedrà tutte e confermandone una le altre verranno annullate automaticamente.
                </p>
              </Card>
            )}

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
          </div>
        )}

        {!loading && (
          <div className="mt-8 flex flex-col gap-3">
            <h2 className="font-heading text-lg font-medium text-text-primary">
              Giornata senza timbrature{dipendenteNome ? ` — ${dipendenteNome}` : ""}
            </h2>
            <p className="text-xs text-text-muted">
              Se un giorno lavorativo di {dipendenteNome || "questo dipendente"} risulta senza
              nessuna timbratura, classificalo come ferie, permesso o altro: la giornata verrà
              registrata come già approvata.
            </p>

            {giornataVuotaCompilata ? (
              <Card className="p-5">
                <p className="text-sm text-text-primary">Giornata registrata</p>
              </Card>
            ) : (
              <Card className="p-5">
                <div className="flex gap-3">
                  <div className="min-w-0 flex-1">
                    <Input
                      label="Data"
                      type="date"
                      className="w-full min-w-0"
                      value={dataGiornataVuota}
                      onChange={(e) => setDataGiornataVuota(e.target.value)}
                      disabled={invioGiornataVuotaInCorso}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Select
                      label="Tipo"
                      className="w-full min-w-0"
                      value={tipoGiornataVuota}
                      onChange={(e) => setTipoGiornataVuota(e.target.value as TipoAssenzaEsteso)}
                      disabled={invioGiornataVuotaInCorso}
                    >
                      {TIPI_GIORNATA_VUOTA.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {LABEL_TIPO_ASSENZA[tipo]}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                {tipoGiornataVuota === TIPO_ASSENZA.ALTRO && (
                  <label className="mt-3 flex flex-col gap-1">
                    <span className="text-sm font-medium text-text-primary">Motivo</span>
                    <textarea
                      value={notaGiornataVuota}
                      onChange={(e) => setNotaGiornataVuota(e.target.value)}
                      disabled={invioGiornataVuotaInCorso}
                      rows={2}
                      className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle"
                    />
                  </label>
                )}
                <Button
                  className="mt-4 w-full"
                  loading={invioGiornataVuotaInCorso}
                  onClick={() => void handleCompilaGiornataVuota()}
                >
                  Registra giornata
                </Button>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
