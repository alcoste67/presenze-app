"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlarmClock, CalendarOff, Home, Stethoscope } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { RUOLI_DIPENDENTE } from "@/constants/ruoliDipendente";
import { ANOMALIE_TIMBRATURE_TESTI } from "@/constants/anomalieTimbrature";
import { ASSENZE_TESTI, LABEL_TIPO_ASSENZA, TIPO_ASSENZA } from "@/constants/assenze";
import { supabase } from "@/lib/supabase";
import { dataRomaDi, dataRomaOggi } from "@/lib/timezoneRoma";
import { getMessaggioErrore } from "@/lib/errors";
import { loadDipendenteByUserId } from "@/services/dipendenti/loadDipendenteByUserId";
import { loadCantieri } from "@/services/cantieri/loadCantieri";
import { caricaTurnoAperto } from "@/services/timbrature/caricaTurnoAperto";
import { proponiCorrezioneAdmin } from "@/services/timbrature/proponiCorrezioneAdmin";
import { annullaPropostaCorrezioneAdmin } from "@/services/timbrature/annullaPropostaCorrezioneAdmin";
import { creaGiornataLavorataAdmin } from "@/services/timbrature/creaGiornataLavorataAdmin";
import { compilaGiornataVuotaClient } from "@/services/assenze/fetchCompilaGiornataVuota";
import { registraMalattiaClient } from "@/services/assenze/registraMalattiaClient";
import type { TurnoApertoInfo } from "@/types/anomalieTimbrature";
import type { TipoAssenzaEsteso } from "@/types/assenze";
import type { TipoAttivita } from "@/types/attivita";

import { AppHeader } from "@/components/ui/AppHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { SelectCantiere } from "@/components/cantieri/SelectCantiere";
import { SelectAttivita } from "@/components/attivita/SelectAttivita";

type ModalitaGiornataVuota = "ASSENZA" | "LAVORATA";

const TIPI_GIORNATA_VUOTA: TipoAssenzaEsteso[] = [
  TIPO_ASSENZA.FERIE,
  TIPO_ASSENZA.PERMESSO,
  TIPO_ASSENZA.ALTRO,
];

const TESTI = ANOMALIE_TIMBRATURE_TESTI.PAGINA_CORREZIONE;
const TESTI_TABELLA = TESTI.TABELLA;

const RIGA_TURNO_APERTO = "turno";

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

function formattaDataBreve(dataYYYYMMDD: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${dataYYYYMMDD}T12:00:00Z`));
}

export default function CorreggiTimbraturaPage() {
  const router = useRouter();
  const params = useParams<{ dipendenteId: string }>();
  const toast = useToast();

  const dipendenteId = params?.dipendenteId || "";

  const [loading, setLoading] = useState(true);
  const [autorizzato, setAutorizzato] = useState(false);
  const [turno, setTurno] = useState<TurnoApertoInfo | null>(null);
  const [giornateVuote, setGiornateVuote] = useState<string[]>([]);
  const [dipendenteNome, setDipendenteNome] = useState("");
  const [dataUscita, setDataUscita] = useState("");
  const [oraUscita, setOraUscita] = useState("");
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [propostaIdInAnnullamento, setPropostaIdInAnnullamento] = useState<string | null>(null);

  // Riga aperta nella tabella anomalie: RIGA_TURNO_APERTO, una data
  // (YYYY-MM-DD) per un giorno vuoto, o null se nessuna riga è espansa.
  const [rigaAperta, setRigaAperta] = useState<string | null>(null);

  const [modalitaGiornataVuota, setModalitaGiornataVuota] = useState<ModalitaGiornataVuota>(
    "ASSENZA"
  );
  const [tipoGiornataVuota, setTipoGiornataVuota] = useState<TipoAssenzaEsteso>(
    TIPO_ASSENZA.FERIE
  );
  const [notaGiornataVuota, setNotaGiornataVuota] = useState("");
  const [invioGiornataVuotaInCorso, setInvioGiornataVuotaInCorso] = useState(false);

  const [cantieri, setCantieri] = useState<{ id: string; nome: string }[]>([]);
  const [cantiereIdLavorata, setCantiereIdLavorata] = useState("");
  const [attivitaTipoLavorata, setAttivitaTipoLavorata] = useState<TipoAttivita | "">("");
  const [oraIngressoLavorata, setOraIngressoLavorata] = useState("08:00");
  const [oraUscitaLavorata, setOraUscitaLavorata] = useState("17:00");
  const [invioGiornataLavorataInCorso, setInvioGiornataLavorataInCorso] = useState(false);

  const [dataInizioMalattia, setDataInizioMalattia] = useState(dataRomaOggi());
  const [dataFineMalattia, setDataFineMalattia] = useState(dataRomaOggi());
  const [notaMalattia, setNotaMalattia] = useState("");
  const [invioMalattiaInCorso, setInvioMalattiaInCorso] = useState(false);

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

        loadCantieri()
          .then((lista) => {
            if (attivo) setCantieri(lista);
          })
          .catch(() => {
            if (attivo) setCantieri([]);
          });

        const dati = await caricaTurnoAperto(dipendenteId);
        if (!attivo) return;

        setDipendenteNome(dati.dipendenteNome);
        setTurno(dati.turnoAperto);
        setGiornateVuote(dati.giornateVuote || []);
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

  const apriRigaTurnoAperto = () => {
    if (turno) {
      setDataUscita(dataRomaDi(turno.apertoDalle));
      setOraUscita(oraRomaDi(new Date().toISOString()));
    }
    setRigaAperta((precedente) => (precedente === RIGA_TURNO_APERTO ? null : RIGA_TURNO_APERTO));
  };

  const apriRigaGiornoVuoto = (data: string) => {
    setModalitaGiornataVuota("ASSENZA");
    setTipoGiornataVuota(TIPO_ASSENZA.FERIE);
    setNotaGiornataVuota("");
    setCantiereIdLavorata("");
    setAttivitaTipoLavorata("");
    setOraIngressoLavorata("08:00");
    setOraUscitaLavorata("17:00");
    setRigaAperta((precedente) => (precedente === data ? null : data));
  };

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

  const handleCompilaGiornataVuota = async (data: string) => {
    if (tipoGiornataVuota === TIPO_ASSENZA.ALTRO && !notaGiornataVuota.trim()) {
      toast.error(ASSENZE_TESTI.ERRORI.NOTA_OBBLIGATORIA_ALTRO);
      return;
    }

    try {
      setInvioGiornataVuotaInCorso(true);
      await compilaGiornataVuotaClient({
        dipendenteId,
        data,
        tipo: tipoGiornataVuota,
        nota: notaGiornataVuota.trim(),
      });
      setGiornateVuote((precedente) => precedente.filter((g) => g !== data));
      setRigaAperta(null);
      toast.success(ASSENZE_TESTI.MESSAGGI.APPROVATA);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ASSENZE_TESTI.ERRORI.SALVATAGGIO));
    } finally {
      setInvioGiornataVuotaInCorso(false);
    }
  };

  const handleCreaGiornataLavorata = async (data: string) => {
    if (!cantiereIdLavorata && !attivitaTipoLavorata) {
      toast.error("Seleziona un cantiere oppure un'attività");
      return;
    }
    if (cantiereIdLavorata && attivitaTipoLavorata) {
      toast.error("Seleziona solo un cantiere oppure solo un'attività");
      return;
    }

    try {
      setInvioGiornataLavorataInCorso(true);
      await creaGiornataLavorataAdmin({
        dipendenteId,
        data,
        oraIngresso: oraIngressoLavorata,
        oraUscita: oraUscitaLavorata,
        cantiereId: cantiereIdLavorata || null,
        attivitaTipo: attivitaTipoLavorata || null,
      });
      setGiornateVuote((precedente) => precedente.filter((g) => g !== data));
      setRigaAperta(null);
      toast.success("Giornata registrata");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ASSENZE_TESTI.ERRORI.SALVATAGGIO));
    } finally {
      setInvioGiornataLavorataInCorso(false);
    }
  };

  const handleRegistraMalattia = async () => {
    if (!dataInizioMalattia || !dataFineMalattia) {
      toast.error(ASSENZE_TESTI.ERRORI.DATE_OBBLIGATORIE);
      return;
    }
    if (dataFineMalattia < dataInizioMalattia) {
      toast.error(ASSENZE_TESTI.ERRORI.INTERVALLO_NON_VALIDO);
      return;
    }

    try {
      setInvioMalattiaInCorso(true);
      await registraMalattiaClient({
        dipendenteId,
        dataInizio: dataInizioMalattia,
        dataFine: dataFineMalattia,
        nota: notaMalattia.trim(),
      });
      setGiornateVuote((precedente) =>
        precedente.filter((g) => g < dataInizioMalattia || g > dataFineMalattia)
      );
      setNotaMalattia("");
      toast.success(ASSENZE_TESTI.MALATTIA.REGISTRATA);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ASSENZE_TESTI.ERRORI.SALVATAGGIO));
    } finally {
      setInvioMalattiaInCorso(false);
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

  const nessunaAnomalia = !turno && giornateVuote.length === 0;

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

        {!loading && (
          <div className="mt-5 flex flex-col gap-3">
            <h2 className="font-heading text-lg font-medium text-text-primary">
              {TESTI_TABELLA.TITOLO}
            </h2>

            {nessunaAnomalia ? (
              <Card className="p-5">
                <p className="text-sm text-text-muted">{TESTI_TABELLA.NESSUNA_ANOMALIA}</p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2">
                {turno && (
                  <Card className="p-0 overflow-hidden">
                    <button
                      type="button"
                      onClick={apriRigaTurnoAperto}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <AlarmClock className="h-5 w-5 shrink-0 text-warning-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {formattaDataBreve(dataRomaDi(turno.apertoDalle))}
                          </p>
                          <p className="text-xs text-text-muted">
                            {TESTI_TABELLA.TIPO_TURNO_APERTO_PREFIX} {Math.floor(turno.oreNette)}
                            {TESTI_TABELLA.TIPO_TURNO_APERTO_SUFFIX}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-brand-500">
                        {rigaAperta === RIGA_TURNO_APERTO ? TESTI_TABELLA.CHIUDI : TESTI_TABELLA.CORREGGI}
                      </span>
                    </button>

                    {rigaAperta === RIGA_TURNO_APERTO && (
                      <div className="border-t border-border p-4">
                        <p className="text-xs text-text-muted">
                          {TESTI.APERTO_DALLE} {formattaDataOra(turno.apertoDalle)} —{" "}
                          {Math.floor(turno.oreNette)} {TESTI.ORE_NETTE}
                        </p>

                        {turno.proposteInAttesa.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-text-primary">
                              {turno.proposteInAttesa.length === 1
                                ? "Proposta in attesa di conferma"
                                : `${turno.proposteInAttesa.length} proposte in attesa di conferma`}
                            </p>
                            <ul className="mt-2 flex flex-col gap-2">
                              {turno.proposteInAttesa.map((p) => (
                                <li
                                  key={p.id}
                                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                                >
                                  <div>
                                    <p className="text-sm text-text-primary">
                                      Uscita: {formattaDataOra(p.orarioProposto)}
                                    </p>
                                    <p className="text-xs text-text-muted">
                                      Inviata il {formattaDataOra(p.creatoIl)}
                                    </p>
                                  </div>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    loading={propostaIdInAnnullamento === p.id}
                                    onClick={() => void handleAnnullaProposta(p.id)}
                                  >
                                    Annulla
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-3">
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
                        <Button
                          className="mt-3 w-full"
                          size="sm"
                          loading={invioInCorso}
                          onClick={() => void handleConferma()}
                        >
                          {TESTI.CONFERMA}
                        </Button>
                      </div>
                    )}
                  </Card>
                )}

                {giornateVuote.map((data) => (
                  <Card key={data} className="p-0 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => apriRigaGiornoVuoto(data)}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left"
                    >
                      <div className="flex items-start gap-3">
                        <CalendarOff className="h-5 w-5 shrink-0 text-warning-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {formattaDataBreve(data)}
                          </p>
                          <p className="text-xs text-text-muted">{TESTI_TABELLA.TIPO_GIORNO_VUOTO}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-brand-500">
                        {rigaAperta === data ? TESTI_TABELLA.CHIUDI : TESTI_TABELLA.CORREGGI}
                      </span>
                    </button>

                    {rigaAperta === data && (
                      <div className="border-t border-border p-4">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={modalitaGiornataVuota === "ASSENZA" ? "primary" : "secondary"}
                            className="flex-1"
                            onClick={() => setModalitaGiornataVuota("ASSENZA")}
                          >
                            Giustifica assenza
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={modalitaGiornataVuota === "LAVORATA" ? "primary" : "secondary"}
                            className="flex-1"
                            onClick={() => setModalitaGiornataVuota("LAVORATA")}
                          >
                            Ha lavorato
                          </Button>
                        </div>

                        {modalitaGiornataVuota === "ASSENZA" ? (
                          <div className="mt-3">
                            <Select
                              label="Tipo"
                              className="w-full"
                              value={tipoGiornataVuota}
                              onChange={(e) =>
                                setTipoGiornataVuota(e.target.value as TipoAssenzaEsteso)
                              }
                              disabled={invioGiornataVuotaInCorso}
                            >
                              {TIPI_GIORNATA_VUOTA.map((tipo) => (
                                <option key={tipo} value={tipo}>
                                  {LABEL_TIPO_ASSENZA[tipo]}
                                </option>
                              ))}
                            </Select>
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
                              className="mt-3 w-full"
                              size="sm"
                              loading={invioGiornataVuotaInCorso}
                              onClick={() => void handleCompilaGiornataVuota(data)}
                            >
                              Registra giornata
                            </Button>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <div className="flex gap-3">
                              <div className="min-w-0 flex-1">
                                <Input
                                  label="Ingresso"
                                  type="time"
                                  className="w-full min-w-0"
                                  value={oraIngressoLavorata}
                                  onChange={(e) => setOraIngressoLavorata(e.target.value)}
                                  disabled={invioGiornataLavorataInCorso}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <Input
                                  label="Uscita"
                                  type="time"
                                  className="w-full min-w-0"
                                  value={oraUscitaLavorata}
                                  onChange={(e) => setOraUscitaLavorata(e.target.value)}
                                  disabled={invioGiornataLavorataInCorso}
                                />
                              </div>
                            </div>
                            <div className="mt-3 grid gap-3">
                              <SelectCantiere
                                cantieri={cantieri}
                                cantiereId={cantiereIdLavorata}
                                onChange={(id) => {
                                  setCantiereIdLavorata(id);
                                  setAttivitaTipoLavorata("");
                                }}
                                disabled={invioGiornataLavorataInCorso}
                              />
                              <SelectAttivita
                                attivitaTipo={attivitaTipoLavorata}
                                onChange={(tipo) => {
                                  setAttivitaTipoLavorata(tipo);
                                  if (tipo) setCantiereIdLavorata("");
                                }}
                                disabled={invioGiornataLavorataInCorso}
                              />
                            </div>
                            <Button
                              className="mt-3 w-full"
                              size="sm"
                              loading={invioGiornataLavorataInCorso}
                              onClick={() => void handleCreaGiornataLavorata(data)}
                            >
                              Registra giornata lavorata
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && (
          <div className="mt-6 flex flex-col gap-3">
            <h2 className="font-heading text-lg font-medium text-text-primary flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-text-muted" />
              {ASSENZE_TESTI.MALATTIA.TITOLO}
            </h2>
            <Card className="p-5">
              <p className="text-xs text-text-muted">{ASSENZE_TESTI.MALATTIA.DESCRIZIONE}</p>
              <div className="mt-3 flex gap-3">
                <div className="min-w-0 flex-1">
                  <Input
                    label={ASSENZE_TESTI.MALATTIA.ETICHETTA_DATA_INIZIO}
                    type="date"
                    className="w-full min-w-0"
                    value={dataInizioMalattia}
                    onChange={(e) => setDataInizioMalattia(e.target.value)}
                    disabled={invioMalattiaInCorso}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    label={ASSENZE_TESTI.MALATTIA.ETICHETTA_DATA_FINE}
                    type="date"
                    className="w-full min-w-0"
                    value={dataFineMalattia}
                    onChange={(e) => setDataFineMalattia(e.target.value)}
                    disabled={invioMalattiaInCorso}
                  />
                </div>
              </div>
              <label className="mt-3 flex flex-col gap-1">
                <span className="text-sm font-medium text-text-primary">
                  {ASSENZE_TESTI.MALATTIA.ETICHETTA_NOTA}
                </span>
                <textarea
                  value={notaMalattia}
                  onChange={(e) => setNotaMalattia(e.target.value)}
                  disabled={invioMalattiaInCorso}
                  rows={2}
                  className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle"
                />
              </label>
              <Button
                className="mt-4 w-full"
                loading={invioMalattiaInCorso}
                onClick={() => void handleRegistraMalattia()}
              >
                {ASSENZE_TESTI.MALATTIA.CONFERMA}
              </Button>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
