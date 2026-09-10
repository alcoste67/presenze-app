"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Home, Pencil, Plus, Trash2 } from "lucide-react";

import { getMessaggioErrore } from "@/lib/errors";
import { PIANIFICAZIONI_TESTI } from "@/constants/pianificazioni";
import { APP_ROUTES } from "@/constants/routes";

import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadDipendenti } from "@/services/dipendenti/loadDipendenti";
import { loadMacchinariPubblici } from "@/services/macchinari/loadMacchinariPubblici";
import { fetchPianificazioni } from "@/services/pianificazioni/fetchPianificazioni";
import {
  aggiornaPianificazioneClient,
  creaPianificazioneClient,
  eliminaPianificazioneClient,
} from "@/services/pianificazioni/salvaPianificazione";

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

  const caricaLista = async () => {
    try {
      setLoadingLista(true);
      const risposta = await fetchPianificazioni({ dataInizio, dataFine });
      setPianificazioni(risposta.pianificazioni);
      setPuoModificare(risposta.puoModificare);

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

        {/* Elenco per giorno */}
        <div className="mt-6 flex flex-col gap-5">
          {loadingLista && (
            <p className="text-sm text-text-muted">{PIANIFICAZIONI_TESTI.CARICAMENTO}</p>
          )}

          {!loadingLista && gruppiPerGiorno.length === 0 && (
            <Card className="p-5">
              <p className="text-sm text-text-muted">{PIANIFICAZIONI_TESTI.NESSUN_RISULTATO}</p>
            </Card>
          )}

          {!loadingLista && gruppiPerGiorno.map(([giorno, lista]) => (
            <div key={giorno}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-text-primary">
                <CalendarDays className="h-4 w-4 text-text-muted" />
                {formattaGiorno(giorno)}
              </h2>
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
          ))}
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
