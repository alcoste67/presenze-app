"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Home, Pencil, Plus, Trash2, X } from "lucide-react";

import { getMessaggioErrore } from "@/lib/errors";
import {
  ASSENZE_TESTI,
  LABEL_STATO_RICHIESTA_ASSENZA,
  LABEL_TIPO_ASSENZA,
} from "@/constants/assenze";
import { PIANIFICAZIONI_TESTI } from "@/constants/pianificazioni";
import { APP_ROUTES } from "@/constants/routes";

import { fetchRichiesteAssenza } from "@/services/assenze/fetchRichiesteAssenza";
import { aggiornaStatoRichiestaClient } from "@/services/assenze/salvaRichiestaAssenza";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadDipendenti } from "@/services/dipendenti/loadDipendenti";
import { loadMacchinariPubblici } from "@/services/macchinari/loadMacchinariPubblici";
import { fetchPianificazioni } from "@/services/pianificazioni/fetchPianificazioni";
import {
  aggiornaPianificazioneClient,
  creaPianificazioneClient,
  eliminaPianificazioneClient,
} from "@/services/pianificazioni/salvaPianificazione";

import type { RichiestaAssenza } from "@/types/assenze";
import type { CantiereBackoffice } from "@/types/cantieri";
import type { Dipendente } from "@/types/dipendenti";
import type { MacchinarioPubblico } from "@/types/macchinari";
import type {
  PianificazioneInput,
  PianificazioneLavoro,
} from "@/types/pianificazioni";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDataInput(offsetGiorni = 0) {
  const data = new Date();
  data.setDate(data.getDate() + offsetGiorni);
  const year = data.getFullYear();
  const month = String(data.getMonth() + 1).padStart(2, "0");
  const day = String(data.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formattaGiorno(data: string) {
  const testo = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${data}T00:00:00`));
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

function formattaDipendenteOption(dipendente: Dipendente) {
  return `${dipendente.cognome} ${dipendente.nome}`;
}

const FORM_INIZIALE: PianificazioneInput = {
  cantiereId: "",
  data: getDataInput(),
  note: "",
  dipendentiIds: [],
  macchinariIds: [],
};

function raggruppaPerGiorno(pianificazioni: PianificazioneLavoro[]) {
  const gruppi = new Map<string, PianificazioneLavoro[]>();
  pianificazioni.forEach((p) => {
    const lista = gruppi.get(p.data) || [];
    lista.push(p);
    gruppi.set(p.data, lista);
  });
  return Array.from(gruppi.entries());
}

function getDataSuccessivaStr(data: string) {
  const [year, month, day] = data.split("-").map(Number);
  const dataUtc = new Date(Date.UTC(year, month - 1, day));
  dataUtc.setUTCDate(dataUtc.getUTCDate() + 1);
  return dataUtc.toISOString().slice(0, 10);
}

function raggruppaAssenzePerGiorno(
  assenze: RichiestaAssenza[],
  dataInizioVista: string,
  dataFineVista: string
) {
  const gruppi = new Map<string, RichiestaAssenza[]>();
  assenze.forEach((a) => {
    let cursore = a.dataInizio < dataInizioVista ? dataInizioVista : a.dataInizio;
    const fine = a.dataFine > dataFineVista ? dataFineVista : a.dataFine;
    while (cursore <= fine) {
      const lista = gruppi.get(cursore) || [];
      lista.push(a);
      gruppi.set(cursore, lista);
      cursore = getDataSuccessivaStr(cursore);
    }
  });
  return gruppi;
}

function formattaEtichettaAssenza(a: RichiestaAssenza) {
  const tipo = LABEL_TIPO_ASSENZA[a.tipo];
  const dettaglio = a.giornataIntera ? "" : ` (${a.ore}h)`;
  return `${tipo} — ${a.dipendenteNome}${dettaglio}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeCalendarioPage() {
  const toast = useToast();

  const [dataInizio, setDataInizio] = useState(getDataInput());
  const [dataFine, setDataFine] = useState(getDataInput(6));

  const [pianificazioni, setPianificazioni] = useState<PianificazioneLavoro[]>([]);
  const [puoModificare, setPuoModificare] = useState(false);
  const [loadingLista, setLoadingLista] = useState(true);

  const [cantieri, setCantieri] = useState<CantiereBackoffice[]>([]);
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
  const [macchinari, setMacchinari] = useState<MacchinarioPubblico[]>([]);
  const [loadingOpzioni, setLoadingOpzioni] = useState(false);

  const [formAperto, setFormAperto] = useState(false);
  const [pianificazioneInModificaId, setPianificazioneInModificaId] = useState<
    string | null
  >(null);
  const [form, setForm] = useState<PianificazioneInput>(FORM_INIZIALE);
  const [salvataggio, setSalvataggio] = useState(false);

  const [confirmElimina, setConfirmElimina] = useState<PianificazioneLavoro | null>(
    null
  );
  const [eliminazioneInCorso, setEliminazioneInCorso] = useState(false);

  const [assenzeApprovate, setAssenzeApprovate] = useState<RichiestaAssenza[]>([]);
  const [richiesteInAttesa, setRichiesteInAttesa] = useState<RichiestaAssenza[]>([]);
  const [mieRichieste, setMieRichieste] = useState<RichiestaAssenza[]>([]);
  const [puoApprovareAssenze, setPuoApprovareAssenze] = useState(false);
  const [azioneRichiestaId, setAzioneRichiestaId] = useState<string | null>(null);

  const caricaLista = async () => {
    try {
      setLoadingLista(true);
      const [risposta, rispostaAssenze, rispostaMieRichieste] = await Promise.all([
        fetchPianificazioni({ dataInizio, dataFine }),
        fetchRichiesteAssenza({ dataInizio, dataFine, stato: "APPROVATA" }),
        fetchRichiesteAssenza({ soloMie: true }),
      ]);
      setPianificazioni(risposta.pianificazioni);
      setPuoModificare(risposta.puoModificare);
      setAssenzeApprovate(rispostaAssenze.richieste);
      setPuoApprovareAssenze(rispostaAssenze.puoApprovare);
      setMieRichieste(
        rispostaMieRichieste.richieste.filter((r) => r.stato !== "ANNULLATA")
      );

      if (rispostaAssenze.puoApprovare) {
        const rispostaInAttesa = await fetchRichiesteAssenza({ stato: "IN_ATTESA" });
        setRichiesteInAttesa(rispostaInAttesa.richieste);
      }

      if (risposta.puoModificare && cantieri.length === 0) {
        setLoadingOpzioni(true);
        const [cantieriData, dipendentiData, macchinariData] = await Promise.all([
          loadCantieriBackoffice(),
          loadDipendenti(),
          loadMacchinariPubblici(),
        ]);
        setCantieri(cantieriData.filter((c) => c.attivo));
        setDipendenti(dipendentiData.filter((d) => d.attivo));
        setMacchinari(macchinariData.filter((m) => m.attivo));
        setLoadingOpzioni(false);
      }
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, PIANIFICAZIONI_TESTI.ERRORI.GENERICO));
    } finally {
      setLoadingLista(false);
    }
  };

  const gestisciRichiesta = async (
    id: string,
    stato: "APPROVATA" | "RIFIUTATA" | "ANNULLATA"
  ) => {
    const messaggi = {
      APPROVATA: ASSENZE_TESTI.MESSAGGI.APPROVATA,
      RIFIUTATA: ASSENZE_TESTI.MESSAGGI.RIFIUTATA,
      ANNULLATA: ASSENZE_TESTI.MESSAGGI.ANNULLATA,
    };
    try {
      setAzioneRichiestaId(id);
      await aggiornaStatoRichiestaClient(id, stato);
      toast.success(messaggi[stato]);
      await caricaLista();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ASSENZE_TESTI.ERRORI.AGGIORNAMENTO));
    } finally {
      setAzioneRichiestaId(null);
    }
  };

  useEffect(() => {
    void caricaLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCerca = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await caricaLista();
  };

  const gruppiPerGiorno = useMemo(
    () => raggruppaPerGiorno(pianificazioni),
    [pianificazioni]
  );

  const assenzePerGiorno = useMemo(
    () => raggruppaAssenzePerGiorno(assenzeApprovate, dataInizio, dataFine),
    [assenzeApprovate, dataInizio, dataFine]
  );

  const tuttiGiorni = useMemo(() => {
    const giorni = new Set<string>([
      ...gruppiPerGiorno.map(([giorno]) => giorno),
      ...assenzePerGiorno.keys(),
    ]);
    return Array.from(giorni).sort();
  }, [gruppiPerGiorno, assenzePerGiorno]);

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setPianificazioneInModificaId(null);
    setFormAperto(false);
  };

  const avviaNuova = () => {
    setForm({ ...FORM_INIZIALE, data: dataInizio });
    setPianificazioneInModificaId(null);
    setFormAperto(true);
  };

  const avviaModifica = (p: PianificazioneLavoro) => {
    setForm({
      cantiereId: p.cantiereId,
      data: p.data,
      note: p.note,
      dipendentiIds: p.squadra.map((m) => m.dipendenteId),
      macchinariIds: p.macchinari.map((m) => m.macchinarioId),
    });
    setPianificazioneInModificaId(p.id);
    setFormAperto(true);
  };

  const toggleDipendente = (id: string) => {
    setForm((f) => ({
      ...f,
      dipendentiIds: f.dipendentiIds.includes(id)
        ? f.dipendentiIds.filter((d) => d !== id)
        : [...f.dipendentiIds, id],
    }));
  };

  const toggleMacchinario = (id: string) => {
    setForm((f) => ({
      ...f,
      macchinariIds: f.macchinariIds.includes(id)
        ? f.macchinariIds.filter((m) => m !== id)
        : [...f.macchinariIds, id],
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.cantiereId) {
      toast.error(PIANIFICAZIONI_TESTI.ERRORI.CANTIERE_OBBLIGATORIO);
      return;
    }
    if (!form.data) {
      toast.error(PIANIFICAZIONI_TESTI.ERRORI.DATA_OBBLIGATORIA);
      return;
    }

    try {
      setSalvataggio(true);
      if (pianificazioneInModificaId) {
        await aggiornaPianificazioneClient(pianificazioneInModificaId, form);
      } else {
        await creaPianificazioneClient(form);
      }
      toast.success(PIANIFICAZIONI_TESTI.MESSAGGI.SALVATA);
      resetForm();
      await caricaLista();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, PIANIFICAZIONI_TESTI.ERRORI.SALVATAGGIO));
    } finally {
      setSalvataggio(false);
    }
  };

  const eseguiElimina = async () => {
    if (!confirmElimina) return;
    try {
      setEliminazioneInCorso(true);
      await eliminaPianificazioneClient(confirmElimina.id);
      toast.success(PIANIFICAZIONI_TESTI.MESSAGGI.ELIMINATA);
      setConfirmElimina(null);
      await caricaLista();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, PIANIFICAZIONI_TESTI.ERRORI.ELIMINAZIONE));
    } finally {
      setEliminazioneInCorso(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            <Link href={APP_ROUTES.BACKOFFICE}>
              <Button variant="secondary" size="sm">{PIANIFICAZIONI_TESTI.BACKOFFICE}</Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">{PIANIFICAZIONI_TESTI.TIMBRATURE}</Button>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-[1000px] px-6 py-6">
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link href={APP_ROUTES.BACKOFFICE} className="hover:text-text-primary transition-colors duration-150">
            {PIANIFICAZIONI_TESTI.BACKOFFICE}
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{PIANIFICAZIONI_TESTI.TITOLO}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-medium text-text-primary">{PIANIFICAZIONI_TESTI.TITOLO}</h1>
            <p className="mt-1 text-sm text-text-muted">
              {puoModificare
                ? PIANIFICAZIONI_TESTI.SOTTOTITOLO_MODIFICA
                : PIANIFICAZIONI_TESTI.SOTTOTITOLO_SOLA_LETTURA}
            </p>
          </div>
          {puoModificare && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={avviaNuova}>
              {PIANIFICAZIONI_TESTI.NUOVA_PIANIFICAZIONE}
            </Button>
          )}
        </div>

        {/* Filtri */}
        <Card className="mt-6 p-5">
          <form onSubmit={(e) => void handleCerca(e)} className="flex flex-wrap items-end gap-4">
            <div className="min-w-0">
              <Input
                label={PIANIFICAZIONI_TESTI.DATA_INIZIO}
                type="date"
                value={dataInizio}
                onChange={(e) => setDataInizio(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <Input
                label={PIANIFICAZIONI_TESTI.DATA_FINE}
                type="date"
                value={dataFine}
                onChange={(e) => setDataFine(e.target.value)}
              />
            </div>
            <Button type="submit" loading={loadingLista}>
              {PIANIFICAZIONI_TESTI.CERCA}
            </Button>
          </form>
        </Card>

        {/* Form creazione/modifica */}
        {formAperto && (
          <Card className="mt-4 p-5">
            <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
              {pianificazioneInModificaId
                ? PIANIFICAZIONI_TESTI.MODIFICA_PIANIFICAZIONE
                : PIANIFICAZIONI_TESTI.NUOVA_PIANIFICAZIONE}
            </h2>
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="min-w-0">
                  <Select
                    label={PIANIFICAZIONI_TESTI.CANTIERE}
                    value={form.cantiereId}
                    onChange={(e) => setForm((f) => ({ ...f, cantiereId: e.target.value }))}
                    disabled={loadingOpzioni || salvataggio}
                  >
                    <option value="">—</option>
                    {cantieri.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </Select>
                </div>
                <div className="min-w-0">
                  <Input
                    label={PIANIFICAZIONI_TESTI.DATA}
                    type="date"
                    value={form.data}
                    onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                    disabled={salvataggio}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-text-primary">
                  {PIANIFICAZIONI_TESTI.NOTE}
                </label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder={PIANIFICAZIONI_TESTI.NOTE_PLACEHOLDER}
                  disabled={salvataggio}
                  rows={2}
                  className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-text-primary">
                    {PIANIFICAZIONI_TESTI.SQUADRA}
                  </span>
                  <div className="max-h-44 overflow-y-auto rounded-md border border-border p-2 flex flex-col gap-1">
                    {dipendenti.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.dipendentiIds.includes(d.id)}
                          onChange={() => toggleDipendente(d.id)}
                          disabled={salvataggio}
                          className="h-4 w-4 accent-brand-500"
                        />
                        {formattaDipendenteOption(d)}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-text-primary">
                    {PIANIFICAZIONI_TESTI.MACCHINARI}
                  </span>
                  <div className="max-h-44 overflow-y-auto rounded-md border border-border p-2 flex flex-col gap-1">
                    {macchinari.length === 0 && (
                      <p className="text-xs text-text-muted">
                        {PIANIFICAZIONI_TESTI.NESSUN_MACCHINARIO_DISPONIBILE}
                      </p>
                    )}
                    {macchinari.map((m) => (
                      <label key={m.id} className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.macchinariIds.includes(m.id)}
                          onChange={() => toggleMacchinario(m.id)}
                          disabled={salvataggio}
                          className="h-4 w-4 accent-brand-500"
                        />
                        {m.nome}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" loading={salvataggio} className="flex-1">
                  {PIANIFICAZIONI_TESTI.SALVA}
                </Button>
                <Button type="button" variant="secondary" onClick={resetForm} disabled={salvataggio}>
                  {PIANIFICAZIONI_TESTI.ANNULLA}
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Le mie richieste ferie/permesso */}
        <Card className="mt-4 p-5">
          <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
            {ASSENZE_TESTI.LE_MIE_RICHIESTE}
          </h2>
          {mieRichieste.length === 0 ? (
            <p className="text-sm text-text-muted">{ASSENZE_TESTI.NESSUNA_MIA_RICHIESTA}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {mieRichieste.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {LABEL_TIPO_ASSENZA[r.tipo]}{" "}
                      <Badge
                        size="sm"
                        variant={
                          r.stato === "APPROVATA"
                            ? "success"
                            : r.stato === "RIFIUTATA"
                              ? "error"
                              : "warning"
                        }
                      >
                        {LABEL_STATO_RICHIESTA_ASSENZA[r.stato]}
                      </Badge>
                    </p>
                    <p className="text-xs text-text-muted">
                      {r.dataInizio === r.dataFine ? formattaGiorno(r.dataInizio) : `${formattaGiorno(r.dataInizio)} → ${formattaGiorno(r.dataFine)}`}
                      {!r.giornataIntera && ` · ${r.ore}h`}
                    </p>
                  </div>
                  {(r.stato === "IN_ATTESA" || r.stato === "APPROVATA") && (
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={azioneRichiestaId === r.id}
                      onClick={() => void gestisciRichiesta(r.id, "ANNULLATA")}
                    >
                      {ASSENZE_TESTI.ANNULLA_RICHIESTA}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Richieste ferie/permesso in attesa (solo admin/superadmin) */}
        {puoApprovareAssenze && (
          <Card className="mt-4 p-5">
            <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
              {ASSENZE_TESTI.RICHIESTE_IN_ATTESA}
            </h2>
            {richiesteInAttesa.length === 0 ? (
              <p className="text-sm text-text-muted">{ASSENZE_TESTI.NESSUNA_RICHIESTA_IN_ATTESA}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {richiesteInAttesa.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">
                        {LABEL_TIPO_ASSENZA[r.tipo]} — {r.dipendenteNome}
                      </p>
                      <p className="text-xs text-text-muted">
                        {r.dataInizio === r.dataFine ? formattaGiorno(r.dataInizio) : `${formattaGiorno(r.dataInizio)} → ${formattaGiorno(r.dataFine)}`}
                        {!r.giornataIntera && ` · ${r.ore}h`}
                        {r.nota && ` · ${r.nota}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        loading={azioneRichiestaId === r.id}
                        onClick={() => void gestisciRichiesta(r.id, "APPROVATA")}
                      >
                        {ASSENZE_TESTI.APPROVA}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={azioneRichiestaId === r.id}
                        onClick={() => void gestisciRichiesta(r.id, "RIFIUTATA")}
                      >
                        {ASSENZE_TESTI.RIFIUTA}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Elenco per giorno */}
        <div className="mt-6 flex flex-col gap-5">
          {loadingLista && (
            <p className="text-sm text-text-muted">{PIANIFICAZIONI_TESTI.CARICAMENTO}</p>
          )}

          {!loadingLista && tuttiGiorni.length === 0 && (
            <Card className="p-5">
              <p className="text-sm text-text-muted">{PIANIFICAZIONI_TESTI.NESSUN_RISULTATO}</p>
            </Card>
          )}

          {!loadingLista && tuttiGiorni.map((giorno) => {
            const lista = pianificazioni.filter((p) => p.data === giorno);
            const assenzeGiorno = assenzePerGiorno.get(giorno) || [];
            return (
            <div key={giorno}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-text-primary">
                <CalendarDays className="h-4 w-4 text-text-muted" />
                {formattaGiorno(giorno)}
              </h2>

              {assenzeGiorno.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {assenzeGiorno.map((a) => (
                    <span
                      key={`${a.id}-${giorno}`}
                      className="inline-flex items-center gap-1"
                    >
                      <Badge variant="warning" size="sm">
                        {formattaEtichettaAssenza(a)}
                      </Badge>
                      {puoApprovareAssenze && (
                        <button
                          type="button"
                          aria-label={ASSENZE_TESTI.ANNULLA_RICHIESTA}
                          disabled={azioneRichiestaId === a.id}
                          onClick={() => void gestisciRichiesta(a.id, "ANNULLATA")}
                          className="text-text-muted transition-colors hover:text-error-500 disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3">
                {lista.map((p) => (
                  <Card key={p.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-text-primary">{p.cantiereNome}</p>
                        {p.note && (
                          <p className="mt-0.5 text-xs text-text-muted">{p.note}</p>
                        )}
                      </div>
                      {puoModificare && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0"
                            aria-label="Modifica"
                            onClick={() => avviaModifica(p)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-error-500 hover:text-error-500"
                            aria-label="Elimina"
                            onClick={() => setConfirmElimina(p)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {p.squadra.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {p.squadra.map((m) => (
                          <Badge key={m.dipendenteId} variant="brand" size="sm">{m.nome}</Badge>
                        ))}
                      </div>
                    )}

                    {p.macchinari.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.macchinari.map((m) => (
                          <Badge key={m.macchinarioId} variant="muted" size="sm">{m.nome}</Badge>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      </main>

      {confirmElimina && (
        <ConfirmDialog
          title={PIANIFICAZIONI_TESTI.CONFERMA_ELIMINA_TITOLO}
          message={PIANIFICAZIONI_TESTI.CONFERMA_ELIMINA_MESSAGGIO}
          confirmLabel={eliminazioneInCorso ? PIANIFICAZIONI_TESTI.CARICAMENTO : PIANIFICAZIONI_TESTI.ELIMINA}
          onConfirm={() => void eseguiElimina()}
          onCancel={() => setConfirmElimina(null)}
        />
      )}
    </div>
  );
}
