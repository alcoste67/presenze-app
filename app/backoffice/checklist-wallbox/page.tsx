"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Home, Plus, Share2, Download, Send } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import {
  CHECKLIST_WALLBOX_CATALOGO_MATERIALI,
  CHECKLIST_WALLBOX_STATI,
  CHECKLIST_WALLBOX_TESTI,
  LABEL_STATI_CHECKLIST_WALLBOX,
} from "@/constants/checklistWallbox";
import { getMessaggioErrore } from "@/lib/errors";
import { creaChecklistWallbox } from "@/services/checklistWallbox/creaChecklistWallbox";
import { loadChecklistiWallbox } from "@/services/checklistWallbox/loadChecklistiWallbox";
import { inviaChecklistWallbox } from "@/services/checklistWallbox/inviaChecklistWallbox";
import {
  fetchChecklistWallboxPdf,
  type FormatoChecklistWallbox,
} from "@/services/checklistWallbox/fetchChecklistWallboxPdf";
import type {
  ChecklistWallbox,
  ChecklistWallboxInput,
  MaterialeChecklistWallbox,
  ModalitaPosaWallbox,
} from "@/types/checklistWallbox";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const BADGE_PER_STATO: Record<string, BadgeProps["variant"]> = {
  [CHECKLIST_WALLBOX_STATI.BOZZA]: "muted",
  [CHECKLIST_WALLBOX_STATI.FIRMATO]: "warning",
  [CHECKLIST_WALLBOX_STATI.INVIATO]: "success",
};

const DOMANDE_FORM: {
  chiave: keyof Pick<
    ChecklistWallboxInput,
    | "quadro_conforme"
    | "impianto_a_norma"
    | "dichiarazione_conformita"
    | "autorizzazioni_necessarie"
    | "messa_a_terra"
    | "installazione_possibile"
    | "opere_adeguamento_necessarie"
  >;
  label: string;
}[] = [
  { chiave: "quadro_conforme", label: CHECKLIST_WALLBOX_TESTI.QUADRO_CONFORME },
  { chiave: "impianto_a_norma", label: CHECKLIST_WALLBOX_TESTI.IMPIANTO_A_NORMA },
  {
    chiave: "dichiarazione_conformita",
    label: CHECKLIST_WALLBOX_TESTI.DICHIARAZIONE_CONFORMITA,
  },
  {
    chiave: "autorizzazioni_necessarie",
    label: CHECKLIST_WALLBOX_TESTI.AUTORIZZAZIONI_NECESSARIE,
  },
  { chiave: "messa_a_terra", label: CHECKLIST_WALLBOX_TESTI.MESSA_A_TERRA },
  {
    chiave: "installazione_possibile",
    label: CHECKLIST_WALLBOX_TESTI.INSTALLAZIONE_POSSIBILE,
  },
  {
    chiave: "opere_adeguamento_necessarie",
    label: CHECKLIST_WALLBOX_TESTI.OPERE_ADEGUAMENTO_NECESSARIE,
  },
];

function statoIniziale(): ChecklistWallboxInput {
  return {
    ragione_sociale: "",
    piva: "",
    nome: "",
    cognome: "",
    via: "",
    comune: "",
    cap: "",
    provincia: "",
    telefono: "",
    email_cliente: "",
    posizionamento: "",
    modalita_posa: null,
    potenza_contatore_kw: "",
    quadro_conforme: null,
    impianto_a_norma: null,
    dichiarazione_conformita: null,
    autorizzazioni_necessarie: null,
    messa_a_terra: null,
    installazione_possibile: null,
    opere_adeguamento_necessarie: null,
    note: "",
    materiali: [],
    luogo: "",
    data_sopralluogo: null,
  };
}

function SiNoToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 gap-1.5">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value === true ? null : true)}
        className={`h-8 rounded-md border px-3 text-xs font-semibold transition-colors ${
          value === true
            ? "border-brand-500 bg-brand-500 text-white"
            : "border-border bg-bg-card text-text-primary hover:bg-bg-subtle"
        }`}
      >
        {CHECKLIST_WALLBOX_TESTI.SI}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value === false ? null : false)}
        className={`h-8 rounded-md border px-3 text-xs font-semibold transition-colors ${
          value === false
            ? "border-error-500 bg-error-500 text-white"
            : "border-border bg-bg-card text-text-primary hover:bg-bg-subtle"
        }`}
      >
        {CHECKLIST_WALLBOX_TESTI.NO}
      </button>
    </div>
  );
}

function formattaDataOra(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ChecklistWallboxPage() {
  const toast = useToast();
  const invioDaQueryGestitoRef = useRef(false);

  const [checklists, setChecklists] = useState<ChecklistWallbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostraForm, setMostraForm] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [form, setForm] = useState<ChecklistWallboxInput>(statoIniziale());
  const [materialiQuantita, setMaterialiQuantita] = useState<
    Record<string, string>
  >({});
  const [azioneInCorsoId, setAzioneInCorsoId] = useState<string | null>(null);
  const [formatoPerChecklist, setFormatoPerChecklist] = useState<
    Record<string, FormatoChecklistWallbox>
  >({});

  const getFormato = (checklistId: string): FormatoChecklistWallbox =>
    formatoPerChecklist[checklistId] || "EDISON";

  const ricarica = async () => {
    try {
      setLoading(true);
      const dati = await loadChecklistiWallbox();
      setChecklists(dati);
    } catch (error: unknown) {
      toast.error(
        getMessaggioErrore(error, CHECKLIST_WALLBOX_TESTI.ERRORI.GENERICO)
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void ricarica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!form.ragione_sociale.trim() && !form.nome.trim() && !form.cognome.trim()) {
      toast.error(
        CHECKLIST_WALLBOX_TESTI.ERRORI.RAGIONE_SOCIALE_O_NOME_OBBLIGATORIO
      );
      return;
    }

    if (!form.comune.trim()) {
      toast.error(CHECKLIST_WALLBOX_TESTI.ERRORI.COMUNE_OBBLIGATORIO);
      return;
    }

    if (!form.email_cliente.trim()) {
      toast.error(CHECKLIST_WALLBOX_TESTI.ERRORI.EMAIL_CLIENTE_OBBLIGATORIA);
      return;
    }

    const materiali: MaterialeChecklistWallbox[] =
      CHECKLIST_WALLBOX_CATALOGO_MATERIALI.filter(
        (materiale) => materialiQuantita[materiale.descrizione]?.trim()
      ).map((materiale) => ({
        descrizione: materiale.descrizione,
        quantita: materialiQuantita[materiale.descrizione].trim(),
      }));

    try {
      setSalvataggio(true);
      await creaChecklistWallbox({ ...form, materiali });
      toast.success(CHECKLIST_WALLBOX_TESTI.MESSAGGI.CREATA);
      setForm(statoIniziale());
      setMaterialiQuantita({});
      setMostraForm(false);
      await ricarica();
    } catch (error: unknown) {
      toast.error(
        getMessaggioErrore(error, CHECKLIST_WALLBOX_TESTI.ERRORI.GENERICO)
      );
    } finally {
      setSalvataggio(false);
    }
  };

  const handleInvia = async (checklist: ChecklistWallbox) => {
    try {
      setAzioneInCorsoId(checklist.id);
      const esito = await inviaChecklistWallbox({
        checklistWallboxId: checklist.id,
        formato: getFormato(checklist.id),
      });
      toast.success(
        `${CHECKLIST_WALLBOX_TESTI.MESSAGGI.INVIATA} ${esito.destinatario}`
      );
      await ricarica();
    } catch (error: unknown) {
      toast.error(
        getMessaggioErrore(error, CHECKLIST_WALLBOX_TESTI.ERRORI.INVIO_FALLITO)
      );
    } finally {
      setAzioneInCorsoId(null);
    }
  };

  // Arrivo dalla pagina firma con ?invia=<id>: avvia subito l'invio
  useEffect(() => {
    if (invioDaQueryGestitoRef.current || loading || checklists.length === 0) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const invioId = params.get("invia");
    if (!invioId) {
      invioDaQueryGestitoRef.current = true;
      return;
    }

    invioDaQueryGestitoRef.current = true;
    window.history.replaceState(null, "", window.location.pathname);

    const checklist = checklists.find((c) => c.id === invioId);
    if (checklist && checklist.stato === CHECKLIST_WALLBOX_STATI.FIRMATO) {
      void handleInvia(checklist);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, checklists]);

  const handleDownload = async (checklist: ChecklistWallbox) => {
    try {
      setAzioneInCorsoId(checklist.id);
      const { blob, nomeFile } = await fetchChecklistWallboxPdf(
        checklist.id,
        getFormato(checklist.id)
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeFile;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast.error(
        getMessaggioErrore(error, CHECKLIST_WALLBOX_TESTI.ERRORI.PDF_GENERICO)
      );
    } finally {
      setAzioneInCorsoId(null);
    }
  };

  const handleCondividiWhatsapp = async (checklist: ChecklistWallbox) => {
    try {
      setAzioneInCorsoId(checklist.id);
      const { blob, nomeFile } = await fetchChecklistWallboxPdf(
        checklist.id,
        getFormato(checklist.id)
      );
      const file = new File([blob], nomeFile, { type: "application/pdf" });
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      if (nav.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: nomeFile,
          text: CHECKLIST_WALLBOX_TESTI.PDF.TITOLO,
        });
      } else {
        toast.error(CHECKLIST_WALLBOX_TESTI.CONDIVIDI_NON_DISPONIBILE);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast.error(
        getMessaggioErrore(error, CHECKLIST_WALLBOX_TESTI.ERRORI.PDF_GENERICO)
      );
    } finally {
      setAzioneInCorsoId(null);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <Link href={APP_ROUTES.BACKOFFICE}>
            <Button variant="secondary" size="sm">
              {CHECKLIST_WALLBOX_TESTI.BACKOFFICE}
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-[720px] px-5 py-6">
        <nav
          aria-label="breadcrumb"
          className="mb-5 flex items-center gap-1.5 text-sm text-text-muted"
        >
          <Link
            href={APP_ROUTES.HOME}
            className="hover:text-text-primary transition-colors duration-150"
          >
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">
            {CHECKLIST_WALLBOX_TESTI.TITOLO}
          </span>
        </nav>

        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-medium text-text-primary">
            {CHECKLIST_WALLBOX_TESTI.TITOLO}
          </h1>
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setMostraForm((v) => !v)}
          >
            {CHECKLIST_WALLBOX_TESTI.NUOVO}
          </Button>
        </div>

        {mostraForm && (
          <Card className="mt-5 p-5">
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5">
              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {CHECKLIST_WALLBOX_TESTI.DATI_CLIENTE}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.RAGIONE_SOCIALE}
                    value={form.ragione_sociale}
                    onChange={(e) =>
                      setForm({ ...form, ragione_sociale: e.target.value })
                    }
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.PIVA}
                    value={form.piva}
                    onChange={(e) => setForm({ ...form, piva: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.NOME}
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.COGNOME}
                    value={form.cognome}
                    onChange={(e) => setForm({ ...form, cognome: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.VIA}
                    value={form.via}
                    onChange={(e) => setForm({ ...form, via: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.COMUNE}
                    value={form.comune}
                    onChange={(e) => setForm({ ...form, comune: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.CAP}
                    value={form.cap}
                    onChange={(e) => setForm({ ...form, cap: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.PROVINCIA}
                    value={form.provincia}
                    maxLength={2}
                    onChange={(e) =>
                      setForm({ ...form, provincia: e.target.value.toUpperCase() })
                    }
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.TELEFONO}
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.EMAIL_CLIENTE}
                    type="email"
                    helperText={CHECKLIST_WALLBOX_TESTI.EMAIL_CLIENTE_HELPER}
                    value={form.email_cliente}
                    onChange={(e) =>
                      setForm({ ...form, email_cliente: e.target.value })
                    }
                    disabled={salvataggio}
                  />
                </div>
              </div>

              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {CHECKLIST_WALLBOX_TESTI.POSIZIONAMENTO}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    placeholder={CHECKLIST_WALLBOX_TESTI.POSIZIONAMENTO_PLACEHOLDER}
                    value={form.posizionamento}
                    onChange={(e) =>
                      setForm({ ...form, posizionamento: e.target.value })
                    }
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.POTENZA_CONTATORE}
                    value={form.potenza_contatore_kw}
                    onChange={(e) =>
                      setForm({ ...form, potenza_contatore_kw: e.target.value })
                    }
                    disabled={salvataggio}
                  />
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <span className="text-sm font-medium text-text-primary">
                    {CHECKLIST_WALLBOX_TESTI.MODALITA_POSA}
                  </span>
                  {(["PARETE", "TERRA"] as ModalitaPosaWallbox[]).map((modo) => (
                    <label key={modo} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name="modalita_posa"
                        checked={form.modalita_posa === modo}
                        onChange={() => setForm({ ...form, modalita_posa: modo })}
                        disabled={salvataggio}
                      />
                      {modo === "PARETE"
                        ? CHECKLIST_WALLBOX_TESTI.MODALITA_POSA_PARETE
                        : CHECKLIST_WALLBOX_TESTI.MODALITA_POSA_TERRA}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {CHECKLIST_WALLBOX_TESTI.DOMANDE_TITOLO}
                </h2>
                <div className="flex flex-col gap-3">
                  {DOMANDE_FORM.map(({ chiave, label }) => (
                    <div key={chiave} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-text-primary">{label}</span>
                      <SiNoToggle
                        value={form[chiave]}
                        onChange={(value) => setForm({ ...form, [chiave]: value })}
                        disabled={salvataggio}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">
                  {CHECKLIST_WALLBOX_TESTI.NOTE}
                </label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  disabled={salvataggio}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-bg-card p-3 text-sm text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              {form.opere_adeguamento_necessarie && (
                <div>
                  <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                    {CHECKLIST_WALLBOX_TESTI.MATERIALI_TITOLO}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {CHECKLIST_WALLBOX_CATALOGO_MATERIALI.map((materiale) => (
                      <div
                        key={materiale.descrizione}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-sm text-text-primary">
                          {materiale.descrizione}
                        </span>
                        <input
                          value={materialiQuantita[materiale.descrizione] || ""}
                          onChange={(e) =>
                            setMaterialiQuantita({
                              ...materialiQuantita,
                              [materiale.descrizione]: e.target.value,
                            })
                          }
                          disabled={salvataggio}
                          placeholder={CHECKLIST_WALLBOX_TESTI.QUANTITA}
                          className="h-9 w-24 shrink-0 rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {CHECKLIST_WALLBOX_TESTI.LUOGO} / {CHECKLIST_WALLBOX_TESTI.DATA_SOPRALLUOGO}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.LUOGO}
                    value={form.luogo}
                    onChange={(e) => setForm({ ...form, luogo: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_WALLBOX_TESTI.DATA_SOPRALLUOGO}
                    type="date"
                    value={form.data_sopralluogo || ""}
                    onChange={(e) =>
                      setForm({ ...form, data_sopralluogo: e.target.value || null })
                    }
                    disabled={salvataggio}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="submit" loading={salvataggio} className="flex-1">
                  {salvataggio
                    ? CHECKLIST_WALLBOX_TESTI.SALVATAGGIO
                    : CHECKLIST_WALLBOX_TESTI.SALVA}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={salvataggio}
                  onClick={() => setMostraForm(false)}
                >
                  {CHECKLIST_WALLBOX_TESTI.ANNULLA}
                </Button>
              </div>
            </form>
          </Card>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {loading && (
            <p className="text-sm text-text-muted">
              {CHECKLIST_WALLBOX_TESTI.CARICAMENTO}
            </p>
          )}

          {!loading && checklists.length === 0 && (
            <p className="text-sm text-text-muted">
              {CHECKLIST_WALLBOX_TESTI.NESSUNA_CHECKLIST}
            </p>
          )}

          {checklists.map((checklist) => {
            const nomeCliente =
              checklist.ragione_sociale.trim() ||
              `${checklist.nome} ${checklist.cognome}`.trim() ||
              "-";
            const inCorso = azioneInCorsoId === checklist.id;

            return (
              <Card key={checklist.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-text-primary">{nomeCliente}</p>
                    <p className="text-sm text-text-muted">
                      {checklist.comune || "-"} ·{" "}
                      {formattaDataOra(checklist.created_at)}
                    </p>
                  </div>
                  <Badge variant={BADGE_PER_STATO[checklist.stato]}>
                    {LABEL_STATI_CHECKLIST_WALLBOX[checklist.stato]}
                  </Badge>
                </div>

                {checklist.stato === CHECKLIST_WALLBOX_STATI.BOZZA && (
                  <div className="mt-3">
                    <Link
                      href={`${APP_ROUTES.BACKOFFICE_CHECKLIST_WALLBOX}/${checklist.id}/firma`}
                    >
                      <Button size="sm">
                        {CHECKLIST_WALLBOX_TESTI.VAI_ALLA_FIRMA}
                      </Button>
                    </Link>
                  </div>
                )}

                {checklist.stato !== CHECKLIST_WALLBOX_STATI.BOZZA && (
                  <>
                    <div className="mt-3 flex gap-1.5">
                      {(["EDISON", "A2C"] as FormatoChecklistWallbox[]).map(
                        (formato) => (
                          <button
                            key={formato}
                            type="button"
                            disabled={inCorso}
                            onClick={() =>
                              setFormatoPerChecklist({
                                ...formatoPerChecklist,
                                [checklist.id]: formato,
                              })
                            }
                            className={`h-7 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                              getFormato(checklist.id) === formato
                                ? "border-brand-500 bg-brand-500 text-white"
                                : "border-border bg-bg-card text-text-primary hover:bg-bg-subtle"
                            }`}
                          >
                            {formato === "EDISON" ? "Edison" : "A2C"}
                          </button>
                        )
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {checklist.stato === CHECKLIST_WALLBOX_STATI.FIRMATO && (
                        <Button
                          size="sm"
                          icon={<Send className="h-4 w-4" />}
                          loading={inCorso}
                          onClick={() => void handleInvia(checklist)}
                        >
                          {CHECKLIST_WALLBOX_TESTI.INVIA_ORA}
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Download className="h-4 w-4" />}
                        disabled={inCorso}
                        onClick={() => void handleDownload(checklist)}
                      >
                        {CHECKLIST_WALLBOX_TESTI.DOWNLOAD_PDF}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon={<Share2 className="h-4 w-4" />}
                        disabled={inCorso}
                        onClick={() => void handleCondividiWhatsapp(checklist)}
                      >
                        {CHECKLIST_WALLBOX_TESTI.CONDIVIDI_WHATSAPP}
                      </Button>
                    </div>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
