"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Home, Plus, Share2, Download, Send } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import {
  CHECKLIST_WALLBOX_CATALOGO_MATERIALI,
  CHECKLIST_WALLBOX_POSIZIONAMENTO_OPZIONI,
  CHECKLIST_WALLBOX_STATI,
  CHECKLIST_WALLBOX_TESTI,
  LABEL_STATI_CHECKLIST_WALLBOX,
} from "@/constants/checklistWallbox";
import { getMessaggioErrore } from "@/lib/errors";
import { creaChecklistWallbox } from "@/services/checklistWallbox/creaChecklistWallbox";
import { aggiornaChecklistWallbox } from "@/services/checklistWallbox/aggiornaChecklistWallbox";
import { loadChecklistiWallbox } from "@/services/checklistWallbox/loadChecklistiWallbox";
import { inviaChecklistWallbox } from "@/services/checklistWallbox/inviaChecklistWallbox";
import { fetchChecklistWallboxPdf } from "@/services/checklistWallbox/fetchChecklistWallboxPdf";
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
import { FirmaCanvas } from "@/components/rapportiIntervento/FirmaCanvas";

const MATERIALI_ALTRO_RIGHE = 3;

const BADGE_PER_STATO: Record<string, BadgeProps["variant"]> = {
  [CHECKLIST_WALLBOX_STATI.BOZZA]: "muted",
  [CHECKLIST_WALLBOX_STATI.FIRMATO]: "warning",
  [CHECKLIST_WALLBOX_STATI.INVIATO]: "success",
};

const DOMANDE_FORM: {
  chiave: keyof Pick<
    ChecklistWallboxInput,
    | "stabile_cpi"
    | "obbligo_progetto_elettrico"
    | "autorizzazioni_necessarie"
    | "messa_a_terra"
    | "installazione_possibile"
  >;
  label: string;
}[] = [
  { chiave: "stabile_cpi", label: CHECKLIST_WALLBOX_TESTI.STABILE_CPI },
  {
    chiave: "obbligo_progetto_elettrico",
    label: CHECKLIST_WALLBOX_TESTI.OBBLIGO_PROGETTO_ELETTRICO,
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
];

function statoIniziale(): ChecklistWallboxInput {
  return {
    ragione_sociale: "",
    piva: "",
    codice_ditta: "",
    nome: "",
    cognome: "",
    via: "",
    comune: "",
    cap: "",
    provincia: "",
    telefono: "",
    email_cliente: "",
    posizionamento: "",
    posizionamento_tipo: null,
    modalita_posa: null,
    potenza_contatore_kw: "",
    stabile_cpi: null,
    obbligo_progetto_elettrico: null,
    autorizzazioni_necessarie: null,
    messa_a_terra: null,
    misura_terra_ohm: "",
    installazione_possibile: null,
    descrizione_percorso_cavi: "",
    note: "",
    materiali: [],
    cavo_altro_descrizione: "",
    cavo_altro_quantita: "",
    interruttore_altro_descrizione: "",
    interruttore_altro_quantita: "",
    materiali_altro: [],
    planimetria_data_url: null,
    luogo: "",
    data_sopralluogo: null,
    formato_stampa: "EDISON",
  };
}

function materialiAltroIniziale(): MaterialeChecklistWallbox[] {
  return Array.from({ length: MATERIALI_ALTRO_RIGHE }, () => ({
    descrizione: "",
    quantita: "",
  }));
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
  const router = useRouter();
  const invioDaQueryGestitoRef = useRef(false);

  const [checklists, setChecklists] = useState<ChecklistWallbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostraForm, setMostraForm] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [form, setForm] = useState<ChecklistWallboxInput>(statoIniziale());
  const [materialiQuantita, setMaterialiQuantita] = useState<
    Record<string, string>
  >({});
  const [materialiAltro, setMaterialiAltro] = useState<
    MaterialeChecklistWallbox[]
  >(materialiAltroIniziale());
  const [azioneInCorsoId, setAzioneInCorsoId] = useState<string | null>(null);
  const [checklistInModificaId, setChecklistInModificaId] = useState<string | null>(null);

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

  const validaForm = () => {
    if (!form.nome.trim() && !form.cognome.trim()) {
      toast.error(
        CHECKLIST_WALLBOX_TESTI.ERRORI.RAGIONE_SOCIALE_O_NOME_OBBLIGATORIO
      );
      return false;
    }

    if (!form.comune.trim()) {
      toast.error(CHECKLIST_WALLBOX_TESTI.ERRORI.COMUNE_OBBLIGATORIO);
      return false;
    }

    if (!form.email_cliente.trim()) {
      toast.error(CHECKLIST_WALLBOX_TESTI.ERRORI.EMAIL_CLIENTE_OBBLIGATORIA);
      return false;
    }

    return true;
  };

  const salvaDaForm = async () => {
    const materiali: MaterialeChecklistWallbox[] =
      CHECKLIST_WALLBOX_CATALOGO_MATERIALI.filter(
        (materiale) => materialiQuantita[materiale.descrizione]?.trim()
      ).map((materiale) => ({
        descrizione: materiale.descrizione,
        quantita: materialiQuantita[materiale.descrizione].trim(),
      }));
    const materiali_altro = materialiAltro.filter(
      (materiale) => materiale.descrizione.trim() && materiale.quantita.trim()
    );
    const payload = { ...form, materiali, materiali_altro };

    return checklistInModificaId
      ? aggiornaChecklistWallbox(checklistInModificaId, payload)
      : creaChecklistWallbox(payload);
  };

  const caricaChecklistInForm = (checklist: ChecklistWallbox) => {
    setChecklistInModificaId(checklist.id);
    setForm({
      ragione_sociale: checklist.ragione_sociale,
      piva: checklist.piva,
      codice_ditta: checklist.codice_ditta,
      nome: checklist.nome,
      cognome: checklist.cognome,
      via: checklist.via,
      comune: checklist.comune,
      cap: checklist.cap,
      provincia: checklist.provincia,
      telefono: checklist.telefono,
      email_cliente: checklist.email_cliente,
      posizionamento: checklist.posizionamento,
      posizionamento_tipo: checklist.posizionamento_tipo,
      modalita_posa: checklist.modalita_posa,
      potenza_contatore_kw: checklist.potenza_contatore_kw,
      stabile_cpi: checklist.stabile_cpi,
      obbligo_progetto_elettrico: checklist.obbligo_progetto_elettrico,
      autorizzazioni_necessarie: checklist.autorizzazioni_necessarie,
      messa_a_terra: checklist.messa_a_terra,
      misura_terra_ohm: checklist.misura_terra_ohm,
      installazione_possibile: checklist.installazione_possibile,
      descrizione_percorso_cavi: checklist.descrizione_percorso_cavi,
      note: checklist.note,
      materiali: checklist.materiali,
      cavo_altro_descrizione: checklist.cavo_altro_descrizione,
      cavo_altro_quantita: checklist.cavo_altro_quantita,
      interruttore_altro_descrizione: checklist.interruttore_altro_descrizione,
      interruttore_altro_quantita: checklist.interruttore_altro_quantita,
      materiali_altro: checklist.materiali_altro,
      planimetria_data_url: checklist.planimetria_data_url,
      luogo: checklist.luogo,
      data_sopralluogo: checklist.data_sopralluogo,
      formato_stampa: checklist.formato_stampa,
    });
    setMaterialiQuantita(
      Object.fromEntries(
        checklist.materiali.map((m) => [m.descrizione, m.quantita])
      )
    );
    const altro = [...checklist.materiali_altro];
    while (altro.length < MATERIALI_ALTRO_RIGHE) {
      altro.push({ descrizione: "", quantita: "" });
    }
    setMaterialiAltro(altro.slice(0, MATERIALI_ALTRO_RIGHE));
    setMostraForm(true);
  };

  const handleSalvaBozza = async (event: FormEvent) => {
    event.preventDefault();
    if (!validaForm()) return;

    try {
      setSalvataggio(true);
      const modificando = Boolean(checklistInModificaId);
      await salvaDaForm();
      toast.success(
        modificando
          ? CHECKLIST_WALLBOX_TESTI.MESSAGGI.MODIFICATA
          : CHECKLIST_WALLBOX_TESTI.MESSAGGI.CREATA
      );
      setForm(statoIniziale());
      setMaterialiQuantita({});
      setMaterialiAltro(materialiAltroIniziale());
      setChecklistInModificaId(null);
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

  const handleSalvaEFirma = async () => {
    if (!validaForm()) return;

    try {
      setSalvataggio(true);
      const checklist = await salvaDaForm();
      router.push(
        `${APP_ROUTES.BACKOFFICE_CHECKLIST_WALLBOX}/${checklist.id}/firma`
      );
    } catch (error: unknown) {
      toast.error(
        getMessaggioErrore(error, CHECKLIST_WALLBOX_TESTI.ERRORI.GENERICO)
      );
      setSalvataggio(false);
    }
  };

  const handleInvia = async (checklist: ChecklistWallbox) => {
    try {
      setAzioneInCorsoId(checklist.id);
      const esito = await inviaChecklistWallbox({
        checklistWallboxId: checklist.id,
        formato: checklist.formato_stampa,
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
        checklist.formato_stampa
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
        checklist.formato_stampa
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
            onClick={() =>
              setMostraForm((v) => {
                const next = !v;
                if (next) {
                  setChecklistInModificaId(null);
                  setForm(statoIniziale());
                  setMaterialiQuantita({});
                  setMaterialiAltro(materialiAltroIniziale());
                }
                return next;
              })
            }
          >
            {CHECKLIST_WALLBOX_TESTI.NUOVO}
          </Button>
        </div>

        {mostraForm && (
          <Card className="mt-5 p-5">
            <form onSubmit={(e) => void handleSalvaBozza(e)} className="flex flex-col gap-5">
              {checklistInModificaId && (
                <p className="text-sm font-medium text-brand-500">
                  {CHECKLIST_WALLBOX_TESTI.MODIFICA_TITOLO}
                </p>
              )}
              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  Formato PDF
                </h2>
                <div className="flex gap-1.5">
                  {(["EDISON", "A2C"] as const).map((formato) => (
                    <button
                      key={formato}
                      type="button"
                      disabled={salvataggio}
                      onClick={() => setForm({ ...form, formato_stampa: formato })}
                      className={`h-9 rounded-md border px-4 text-sm font-medium transition-colors ${
                        form.formato_stampa === formato
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-border bg-bg-card text-text-primary hover:bg-bg-subtle"
                      }`}
                    >
                      {formato === "EDISON" ? "Edison" : "A2C"}
                    </button>
                  ))}
                </div>
              </div>

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
                    label={CHECKLIST_WALLBOX_TESTI.CODICE_DITTA}
                    value={form.codice_ditta}
                    onChange={(e) =>
                      setForm({ ...form, codice_ditta: e.target.value })
                    }
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
                <div className="flex flex-col gap-2">
                  {CHECKLIST_WALLBOX_POSIZIONAMENTO_OPZIONI.map((opzione) => (
                    <label
                      key={opzione.valore}
                      className="flex items-center gap-1.5 text-sm text-text-primary"
                    >
                      <input
                        type="radio"
                        name="posizionamento_tipo"
                        checked={form.posizionamento_tipo === opzione.valore}
                        onChange={() =>
                          setForm({ ...form, posizionamento_tipo: opzione.valore })
                        }
                        disabled={salvataggio}
                      />
                      {opzione.label}
                    </label>
                  ))}
                  {form.posizionamento_tipo === "ALTRO" && (
                    <Input
                      placeholder={
                        CHECKLIST_WALLBOX_TESTI.POSIZIONAMENTO_ALTRO_PLACEHOLDER
                      }
                      value={form.posizionamento}
                      onChange={(e) =>
                        setForm({ ...form, posizionamento: e.target.value })
                      }
                      disabled={salvataggio}
                    />
                  )}
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
                    <div key={chiave}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-text-primary">{label}</span>
                        <SiNoToggle
                          value={form[chiave]}
                          onChange={(value) => setForm({ ...form, [chiave]: value })}
                          disabled={salvataggio}
                        />
                      </div>
                      {chiave === "messa_a_terra" && form.messa_a_terra === true && (
                        <div className="mt-2">
                          <Input
                            label={CHECKLIST_WALLBOX_TESTI.MISURA_TERRA_OHM}
                            value={form.misura_terra_ohm}
                            onChange={(e) =>
                              setForm({ ...form, misura_terra_ohm: e.target.value })
                            }
                            disabled={salvataggio}
                          />
                        </div>
                      )}
                      {chiave === "installazione_possibile" &&
                        form.installazione_possibile === false && (
                          <p className="mt-1 text-xs text-text-muted">
                            {CHECKLIST_WALLBOX_TESTI.INSTALLAZIONE_NON_POSSIBILE_AVVISO}
                          </p>
                        )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">
                  {CHECKLIST_WALLBOX_TESTI.DESCRIZIONE_PERCORSO_CAVI}
                </label>
                <textarea
                  value={form.descrizione_percorso_cavi}
                  onChange={(e) =>
                    setForm({ ...form, descrizione_percorso_cavi: e.target.value })
                  }
                  disabled={salvataggio}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-bg-card p-3 text-sm text-text-primary outline-none focus:border-brand-500"
                />
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

                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-text-primary">
                      {CHECKLIST_WALLBOX_TESTI.CAVO_ALTRO}
                    </span>
                    <input
                      value={form.cavo_altro_descrizione}
                      onChange={(e) =>
                        setForm({ ...form, cavo_altro_descrizione: e.target.value })
                      }
                      disabled={salvataggio}
                      placeholder={CHECKLIST_WALLBOX_TESTI.DESCRIZIONE_PLACEHOLDER}
                      className="h-9 w-32 shrink-0 rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
                    />
                    <input
                      value={form.cavo_altro_quantita}
                      onChange={(e) =>
                        setForm({ ...form, cavo_altro_quantita: e.target.value })
                      }
                      disabled={salvataggio}
                      placeholder={CHECKLIST_WALLBOX_TESTI.QUANTITA}
                      className="h-9 w-24 shrink-0 rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-text-primary">
                      {CHECKLIST_WALLBOX_TESTI.INTERRUTTORE_ALTRO}
                    </span>
                    <input
                      value={form.interruttore_altro_descrizione}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          interruttore_altro_descrizione: e.target.value,
                        })
                      }
                      disabled={salvataggio}
                      placeholder={CHECKLIST_WALLBOX_TESTI.DESCRIZIONE_PLACEHOLDER}
                      className="h-9 w-32 shrink-0 rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
                    />
                    <input
                      value={form.interruttore_altro_quantita}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          interruttore_altro_quantita: e.target.value,
                        })
                      }
                      disabled={salvataggio}
                      placeholder={CHECKLIST_WALLBOX_TESTI.QUANTITA}
                      className="h-9 w-24 shrink-0 rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-medium text-text-primary mb-2">
                    {CHECKLIST_WALLBOX_TESTI.MATERIALI_ALTRO_TITOLO}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {materialiAltro.map((materiale, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          value={materiale.descrizione}
                          onChange={(e) => {
                            const copia = [...materialiAltro];
                            copia[index] = { ...copia[index], descrizione: e.target.value };
                            setMaterialiAltro(copia);
                          }}
                          disabled={salvataggio}
                          placeholder={
                            CHECKLIST_WALLBOX_TESTI.MATERIALI_ALTRO_DESCRIZIONE_PLACEHOLDER
                          }
                          className="h-9 flex-1 rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
                        />
                        <input
                          value={materiale.quantita}
                          onChange={(e) => {
                            const copia = [...materialiAltro];
                            copia[index] = { ...copia[index], quantita: e.target.value };
                            setMaterialiAltro(copia);
                          }}
                          disabled={salvataggio}
                          placeholder={CHECKLIST_WALLBOX_TESTI.QUANTITA}
                          className="h-9 w-24 shrink-0 rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {CHECKLIST_WALLBOX_TESTI.PLANIMETRIA_TITOLO}
                </h2>
                <FirmaCanvas
                  label={CHECKLIST_WALLBOX_TESTI.PLANIMETRIA_AVVISO}
                  clearLabel={CHECKLIST_WALLBOX_TESTI.CANCELLA_FIRMA}
                  value={form.planimetria_data_url}
                  onChange={(value) =>
                    setForm({ ...form, planimetria_data_url: value })
                  }
                  disabled={salvataggio}
                  width={720}
                  height={390}
                />
              </div>

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
                <Button
                  type="submit"
                  variant="secondary"
                  loading={salvataggio}
                  className="flex-1"
                >
                  {salvataggio
                    ? CHECKLIST_WALLBOX_TESTI.SALVATAGGIO
                    : checklistInModificaId
                      ? CHECKLIST_WALLBOX_TESTI.SALVA_MODIFICHE
                      : CHECKLIST_WALLBOX_TESTI.SALVA}
                </Button>
                <Button
                  type="button"
                  loading={salvataggio}
                  className="flex-1"
                  onClick={() => void handleSalvaEFirma()}
                >
                  {CHECKLIST_WALLBOX_TESTI.VAI_ALLA_FIRMA}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={salvataggio}
                onClick={() => {
                  setMostraForm(false);
                  setChecklistInModificaId(null);
                }}
              >
                {CHECKLIST_WALLBOX_TESTI.ANNULLA}
              </Button>
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
              `${checklist.nome} ${checklist.cognome}`.trim() || "-";
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={BADGE_PER_STATO[checklist.stato]}>
                      {LABEL_STATI_CHECKLIST_WALLBOX[checklist.stato]}
                    </Badge>
                    <Badge variant="muted" size="sm">
                      {checklist.formato_stampa === "A2C" ? "A2C" : "Edison"}
                    </Badge>
                  </div>
                </div>

                {checklist.stato === CHECKLIST_WALLBOX_STATI.BOZZA && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => caricaChecklistInForm(checklist)}
                    >
                      {CHECKLIST_WALLBOX_TESTI.MODIFICA}
                    </Button>
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
                    <div className="mt-3 flex flex-wrap gap-2">
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
