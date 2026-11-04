"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Home, Plus, Send, Trash2 } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import {
  CHECKLIST_FOTOVOLTAICO_DEFAULT_DIMENSIONAMENTO,
  CHECKLIST_FOTOVOLTAICO_STATI,
  CHECKLIST_FOTOVOLTAICO_TESTI,
  LABEL_STATI_CHECKLIST_FOTOVOLTAICO,
} from "@/constants/checklistFotovoltaico";
import { getMessaggioErrore } from "@/lib/errors";
import { creaChecklistFotovoltaico } from "@/services/checklistFotovoltaico/creaChecklistFotovoltaico";
import { aggiornaChecklistFotovoltaico } from "@/services/checklistFotovoltaico/aggiornaChecklistFotovoltaico";
import { loadChecklistiFotovoltaico } from "@/services/checklistFotovoltaico/loadChecklistiFotovoltaico";
import { inviaChecklistFotovoltaico } from "@/services/checklistFotovoltaico/inviaChecklistFotovoltaico";
import { fetchChecklistFotovoltaicoPdf } from "@/services/checklistFotovoltaico/fetchChecklistFotovoltaicoPdf";
import { loadModuliFotovoltaiciAdmin } from "@/services/moduliFotovoltaici/loadModuliFotovoltaiciAdmin";
import { calcolaDimensionamentoFotovoltaico } from "@/services/checklistFotovoltaico/calcolaDimensionamentoFotovoltaico";
import { suggerisciModuloFotovoltaico } from "@/services/checklistFotovoltaico/suggerisciModuloFotovoltaico";
import type {
  ChecklistFotovoltaico,
  ChecklistFotovoltaicoInput,
  MaterialeChecklistFotovoltaico,
} from "@/types/checklistFotovoltaico";
import type { ModuloFotovoltaico } from "@/types/moduliFotovoltaici";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";

const BADGE_PER_STATO: Record<string, BadgeProps["variant"]> = {
  [CHECKLIST_FOTOVOLTAICO_STATI.BOZZA]: "muted",
  [CHECKLIST_FOTOVOLTAICO_STATI.FIRMATO]: "warning",
  [CHECKLIST_FOTOVOLTAICO_STATI.INVIATO]: "success",
};

function statoIniziale(): ChecklistFotovoltaicoInput {
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
    tipo_copertura: "",
    orientamento_falda: "",
    inclinazione_falda_gradi: null,
    superficie_falda_mq: null,
    ombreggiamenti_presenti: null,
    note_ombreggiamenti: "",
    potenza_contatore_kw: "",
    quadro_conforme: null,
    impianto_a_norma: null,
    dichiarazione_conformita: null,
    autorizzazioni_necessarie: null,
    messa_a_terra: null,
    struttura_idonea: null,
    opere_adeguamento_necessarie: null,
    consumo_f1_kwh: null,
    consumo_f2_kwh: null,
    consumo_f3_kwh: null,
    pompa_calore_attiva: false,
    pompa_calore_kwh_anno: CHECKLIST_FOTOVOLTAICO_DEFAULT_DIMENSIONAMENTO.POMPA_CALORE_KWH_ANNO,
    auto_elettrica_attiva: false,
    auto_elettrica_kwh_anno: CHECKLIST_FOTOVOLTAICO_DEFAULT_DIMENSIONAMENTO.AUTO_ELETTRICA_KWH_ANNO,
    induzione_attiva: false,
    induzione_kwh_anno: CHECKLIST_FOTOVOLTAICO_DEFAULT_DIMENSIONAMENTO.INDUZIONE_KWH_ANNO,
    altro_attivo: false,
    altro_descrizione: "",
    altro_kwh_anno: 0,
    resa_kwh_per_kwp: CHECKLIST_FOTOVOLTAICO_DEFAULT_DIMENSIONAMENTO.RESA_KWH_PER_KWP,
    fattore_occupazione_falda: CHECKLIST_FOTOVOLTAICO_DEFAULT_DIMENSIONAMENTO.FATTORE_OCCUPAZIONE_FALDA,
    margine_batteria: CHECKLIST_FOTOVOLTAICO_DEFAULT_DIMENSIONAMENTO.MARGINE_BATTERIA,
    modulo_fotovoltaico_id: null,
    materiali: [],
    note: "",
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
        {CHECKLIST_FOTOVOLTAICO_TESTI.SI}
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
        {CHECKLIST_FOTOVOLTAICO_TESTI.NO}
      </button>
    </div>
  );
}

function RigaDomanda({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-text-primary">{label}</span>
      <SiNoToggle value={value} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function parseNumero(value: string): number | null {
  if (!value.trim()) return null;
  const numero = Number(value.trim().replace(",", "."));
  return Number.isFinite(numero) ? numero : null;
}

function formattaDataOra(value: string) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formattaRisultato(value: number | null, suffisso: string): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(value)} ${suffisso}`;
}

export default function ChecklistFotovoltaicoPage() {
  const toast = useToast();
  const router = useRouter();
  const invioDaQueryGestitoRef = useRef(false);

  const [checklists, setChecklists] = useState<ChecklistFotovoltaico[]>([]);
  const [moduli, setModuli] = useState<ModuloFotovoltaico[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostraForm, setMostraForm] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [form, setForm] = useState<ChecklistFotovoltaicoInput>(statoIniziale());
  const [azioneInCorsoId, setAzioneInCorsoId] = useState<string | null>(null);
  const [checklistInModificaId, setChecklistInModificaId] = useState<string | null>(null);

  const moduloSelezionato = useMemo(
    () => moduli.find((m) => m.id === form.modulo_fotovoltaico_id) || null,
    [moduli, form.modulo_fotovoltaico_id]
  );

  const risultatoDimensionamento = useMemo(
    () => calcolaDimensionamentoFotovoltaico(form, moduloSelezionato),
    [form, moduloSelezionato]
  );

  const moduloSuggerito = useMemo(
    () =>
      suggerisciModuloFotovoltaico(moduli, {
        potenzaConsigliataKwp: risultatoDimensionamento.potenza_consigliata_kwp,
        areaUtileMq: risultatoDimensionamento.area_utile_mq,
      }),
    [moduli, risultatoDimensionamento]
  );

  const ricarica = async () => {
    try {
      setLoading(true);
      const dati = await loadChecklistiFotovoltaico();
      setChecklists(dati);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.GENERICO));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let attivo = true;

    (async () => {
      try {
        const [dati, moduliCatalogo] = await Promise.all([
          loadChecklistiFotovoltaico(),
          loadModuliFotovoltaiciAdmin().catch(() => []),
        ]);
        if (!attivo) return;
        setChecklists(dati);
        setModuli(moduliCatalogo.filter((m) => m.attivo));
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoading(false);
      }
    })();

    return () => {
      attivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validaForm = () => {
    if (!form.nome.trim() && !form.cognome.trim() && !form.ragione_sociale.trim()) {
      toast.error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.NOME_O_RAGIONE_SOCIALE_OBBLIGATORIO);
      return false;
    }
    if (!form.comune.trim()) {
      toast.error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.COMUNE_OBBLIGATORIO);
      return false;
    }
    if (!form.email_cliente.trim()) {
      toast.error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.EMAIL_CLIENTE_OBBLIGATORIA);
      return false;
    }
    return true;
  };

  const salvaDaForm = async () => {
    const materiali = form.materiali.filter((m) => m.descrizione.trim());
    const payload = { ...form, materiali };

    return checklistInModificaId
      ? aggiornaChecklistFotovoltaico(checklistInModificaId, payload)
      : creaChecklistFotovoltaico(payload);
  };

  const caricaChecklistInForm = (checklist: ChecklistFotovoltaico) => {
    setChecklistInModificaId(checklist.id);
    setForm({
      ragione_sociale: checklist.ragione_sociale,
      piva: checklist.piva,
      nome: checklist.nome,
      cognome: checklist.cognome,
      via: checklist.via,
      comune: checklist.comune,
      cap: checklist.cap,
      provincia: checklist.provincia,
      telefono: checklist.telefono,
      email_cliente: checklist.email_cliente,
      tipo_copertura: checklist.tipo_copertura,
      orientamento_falda: checklist.orientamento_falda,
      inclinazione_falda_gradi: checklist.inclinazione_falda_gradi,
      superficie_falda_mq: checklist.superficie_falda_mq,
      ombreggiamenti_presenti: checklist.ombreggiamenti_presenti,
      note_ombreggiamenti: checklist.note_ombreggiamenti,
      potenza_contatore_kw: checklist.potenza_contatore_kw,
      quadro_conforme: checklist.quadro_conforme,
      impianto_a_norma: checklist.impianto_a_norma,
      dichiarazione_conformita: checklist.dichiarazione_conformita,
      autorizzazioni_necessarie: checklist.autorizzazioni_necessarie,
      messa_a_terra: checklist.messa_a_terra,
      struttura_idonea: checklist.struttura_idonea,
      opere_adeguamento_necessarie: checklist.opere_adeguamento_necessarie,
      consumo_f1_kwh: checklist.consumo_f1_kwh,
      consumo_f2_kwh: checklist.consumo_f2_kwh,
      consumo_f3_kwh: checklist.consumo_f3_kwh,
      pompa_calore_attiva: checklist.pompa_calore_attiva,
      pompa_calore_kwh_anno: checklist.pompa_calore_kwh_anno,
      auto_elettrica_attiva: checklist.auto_elettrica_attiva,
      auto_elettrica_kwh_anno: checklist.auto_elettrica_kwh_anno,
      induzione_attiva: checklist.induzione_attiva,
      induzione_kwh_anno: checklist.induzione_kwh_anno,
      altro_attivo: checklist.altro_attivo,
      altro_descrizione: checklist.altro_descrizione,
      altro_kwh_anno: checklist.altro_kwh_anno,
      resa_kwh_per_kwp: checklist.resa_kwh_per_kwp,
      fattore_occupazione_falda: checklist.fattore_occupazione_falda,
      margine_batteria: checklist.margine_batteria,
      modulo_fotovoltaico_id: checklist.modulo_fotovoltaico_id,
      materiali: checklist.materiali,
      note: checklist.note,
      luogo: checklist.luogo,
      data_sopralluogo: checklist.data_sopralluogo,
    });
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
        modificando ? CHECKLIST_FOTOVOLTAICO_TESTI.MESSAGGI.MODIFICATA : CHECKLIST_FOTOVOLTAICO_TESTI.MESSAGGI.CREATA
      );
      setForm(statoIniziale());
      setChecklistInModificaId(null);
      setMostraForm(false);
      await ricarica();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleSalvaEFirma = async () => {
    if (!validaForm()) return;

    try {
      setSalvataggio(true);
      const checklist = await salvaDaForm();
      router.push(`${APP_ROUTES.BACKOFFICE_CHECKLIST_FOTOVOLTAICO}/${checklist.id}/firma`);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.GENERICO));
      setSalvataggio(false);
    }
  };

  const handleInvia = async (checklist: ChecklistFotovoltaico) => {
    try {
      setAzioneInCorsoId(checklist.id);
      const esito = await inviaChecklistFotovoltaico({ checklistFotovoltaicoId: checklist.id });
      toast.success(`${CHECKLIST_FOTOVOLTAICO_TESTI.MESSAGGI.INVIATA} ${esito.destinatario}`);
      await ricarica();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.INVIO_FALLITO));
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
    if (checklist && checklist.stato === CHECKLIST_FOTOVOLTAICO_STATI.FIRMATO) {
      void handleInvia(checklist);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, checklists]);

  const handleDownload = async (checklist: ChecklistFotovoltaico) => {
    try {
      setAzioneInCorsoId(checklist.id);
      const { blob, nomeFile } = await fetchChecklistFotovoltaicoPdf(checklist.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeFile;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.PDF_GENERICO));
    } finally {
      setAzioneInCorsoId(null);
    }
  };

  const aggiungiMateriale = () => {
    setForm((f) => ({ ...f, materiali: [...f.materiali, { descrizione: "", quantita: "" }] }));
  };

  const aggiornaMateriale = (indice: number, campo: keyof MaterialeChecklistFotovoltaico, valore: string) => {
    setForm((f) => ({
      ...f,
      materiali: f.materiali.map((m, i) => (i === indice ? { ...m, [campo]: valore } : m)),
    }));
  };

  const rimuoviMateriale = (indice: number) => {
    setForm((f) => ({ ...f, materiali: f.materiali.filter((_, i) => i !== indice) }));
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <Link href={APP_ROUTES.BACKOFFICE}>
            <Button variant="secondary" size="sm">
              {CHECKLIST_FOTOVOLTAICO_TESTI.BACKOFFICE}
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-[720px] px-5 py-6">
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{CHECKLIST_FOTOVOLTAICO_TESTI.TITOLO}</span>
        </nav>

        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-medium text-text-primary">
            {CHECKLIST_FOTOVOLTAICO_TESTI.TITOLO}
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
                }
                return next;
              })
            }
          >
            {CHECKLIST_FOTOVOLTAICO_TESTI.NUOVO}
          </Button>
        </div>

        {mostraForm && (
          <Card className="mt-5 p-5">
            <form onSubmit={(e) => void handleSalvaBozza(e)} className="flex flex-col gap-5">
              {/* ── Dati cliente ── */}
              <div>
                <h2 className="font-heading text-base font-medium text-text-primary mb-3">
                  {CHECKLIST_FOTOVOLTAICO_TESTI.SEZIONE_DATI_CLIENTE}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.NOME} value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} disabled={salvataggio} />
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.COGNOME} value={form.cognome} onChange={(e) => setForm((f) => ({ ...f, cognome: e.target.value }))} disabled={salvataggio} />
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.RAGIONE_SOCIALE} value={form.ragione_sociale} onChange={(e) => setForm((f) => ({ ...f, ragione_sociale: e.target.value }))} disabled={salvataggio} />
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.PIVA} value={form.piva} onChange={(e) => setForm((f) => ({ ...f, piva: e.target.value }))} disabled={salvataggio} />
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.TELEFONO} value={form.telefono} onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} disabled={salvataggio} />
                  <Input
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.EMAIL_CLIENTE}
                    type="email"
                    value={form.email_cliente}
                    onChange={(e) => setForm((f) => ({ ...f, email_cliente: e.target.value }))}
                    helperText={CHECKLIST_FOTOVOLTAICO_TESTI.EMAIL_CLIENTE_HELPER}
                    disabled={salvataggio}
                  />
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.VIA} value={form.via} onChange={(e) => setForm((f) => ({ ...f, via: e.target.value }))} disabled={salvataggio} />
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.COMUNE} value={form.comune} onChange={(e) => setForm((f) => ({ ...f, comune: e.target.value }))} disabled={salvataggio} />
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.CAP} value={form.cap} onChange={(e) => setForm((f) => ({ ...f, cap: e.target.value }))} disabled={salvataggio} />
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.PROVINCIA} value={form.provincia} onChange={(e) => setForm((f) => ({ ...f, provincia: e.target.value }))} disabled={salvataggio} />
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.LUOGO} value={form.luogo} onChange={(e) => setForm((f) => ({ ...f, luogo: e.target.value }))} disabled={salvataggio} />
                  <Input
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.DATA_SOPRALLUOGO}
                    type="date"
                    value={form.data_sopralluogo || ""}
                    onChange={(e) => setForm((f) => ({ ...f, data_sopralluogo: e.target.value || null }))}
                    disabled={salvataggio}
                  />
                </div>
              </div>

              {/* ── Falda ── */}
              <div>
                <h2 className="font-heading text-base font-medium text-text-primary mb-3">
                  {CHECKLIST_FOTOVOLTAICO_TESTI.SEZIONE_FALDA}
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.TIPO_COPERTURA} value={form.tipo_copertura} onChange={(e) => setForm((f) => ({ ...f, tipo_copertura: e.target.value }))} disabled={salvataggio} />
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.ORIENTAMENTO_FALDA} value={form.orientamento_falda} onChange={(e) => setForm((f) => ({ ...f, orientamento_falda: e.target.value }))} disabled={salvataggio} />
                  <Input
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.INCLINAZIONE_FALDA}
                    type="number"
                    value={form.inclinazione_falda_gradi ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, inclinazione_falda_gradi: parseNumero(e.target.value) }))}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.SUPERFICIE_FALDA}
                    type="number"
                    value={form.superficie_falda_mq ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, superficie_falda_mq: parseNumero(e.target.value) }))}
                    disabled={salvataggio}
                  />
                </div>
                <RigaDomanda
                  label={CHECKLIST_FOTOVOLTAICO_TESTI.OMBREGGIAMENTI_PRESENTI}
                  value={form.ombreggiamenti_presenti}
                  onChange={(v) => setForm((f) => ({ ...f, ombreggiamenti_presenti: v }))}
                  disabled={salvataggio}
                />
                {form.ombreggiamenti_presenti && (
                  <Input
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.NOTE_OMBREGGIAMENTI}
                    value={form.note_ombreggiamenti}
                    onChange={(e) => setForm((f) => ({ ...f, note_ombreggiamenti: e.target.value }))}
                    disabled={salvataggio}
                  />
                )}
              </div>

              {/* ── Verifiche tecniche ── */}
              <div>
                <h2 className="font-heading text-base font-medium text-text-primary mb-3">
                  {CHECKLIST_FOTOVOLTAICO_TESTI.SEZIONE_VERIFICHE}
                </h2>
                <Input
                  label={CHECKLIST_FOTOVOLTAICO_TESTI.POTENZA_CONTATORE}
                  value={form.potenza_contatore_kw}
                  onChange={(e) => setForm((f) => ({ ...f, potenza_contatore_kw: e.target.value }))}
                  disabled={salvataggio}
                />
                <div className="mt-2 divide-y divide-border">
                  <RigaDomanda label={CHECKLIST_FOTOVOLTAICO_TESTI.QUADRO_CONFORME} value={form.quadro_conforme} onChange={(v) => setForm((f) => ({ ...f, quadro_conforme: v }))} disabled={salvataggio} />
                  <RigaDomanda label={CHECKLIST_FOTOVOLTAICO_TESTI.IMPIANTO_A_NORMA} value={form.impianto_a_norma} onChange={(v) => setForm((f) => ({ ...f, impianto_a_norma: v }))} disabled={salvataggio} />
                  <RigaDomanda label={CHECKLIST_FOTOVOLTAICO_TESTI.DICHIARAZIONE_CONFORMITA} value={form.dichiarazione_conformita} onChange={(v) => setForm((f) => ({ ...f, dichiarazione_conformita: v }))} disabled={salvataggio} />
                  <RigaDomanda label={CHECKLIST_FOTOVOLTAICO_TESTI.AUTORIZZAZIONI_NECESSARIE} value={form.autorizzazioni_necessarie} onChange={(v) => setForm((f) => ({ ...f, autorizzazioni_necessarie: v }))} disabled={salvataggio} />
                  <RigaDomanda label={CHECKLIST_FOTOVOLTAICO_TESTI.MESSA_A_TERRA} value={form.messa_a_terra} onChange={(v) => setForm((f) => ({ ...f, messa_a_terra: v }))} disabled={salvataggio} />
                  <RigaDomanda label={CHECKLIST_FOTOVOLTAICO_TESTI.STRUTTURA_IDONEA} value={form.struttura_idonea} onChange={(v) => setForm((f) => ({ ...f, struttura_idonea: v }))} disabled={salvataggio} />
                  <RigaDomanda label={CHECKLIST_FOTOVOLTAICO_TESTI.OPERE_ADEGUAMENTO_NECESSARIE} value={form.opere_adeguamento_necessarie} onChange={(v) => setForm((f) => ({ ...f, opere_adeguamento_necessarie: v }))} disabled={salvataggio} />
                </div>
              </div>

              {/* ── Dimensionamento ── */}
              <div>
                <h2 className="font-heading text-base font-medium text-text-primary mb-3">
                  {CHECKLIST_FOTOVOLTAICO_TESTI.SEZIONE_DIMENSIONAMENTO}
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.CONSUMO_F1} type="number" value={form.consumo_f1_kwh ?? ""} onChange={(e) => setForm((f) => ({ ...f, consumo_f1_kwh: parseNumero(e.target.value) }))} disabled={salvataggio} />
                  <Input label={CHECKLIST_FOTOVOLTAICO_TESTI.CONSUMO_F2} type="number" value={form.consumo_f2_kwh ?? ""} onChange={(e) => setForm((f) => ({ ...f, consumo_f2_kwh: parseNumero(e.target.value) }))} disabled={salvataggio} />
                  <Input
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.CONSUMO_F3}
                    type="number"
                    value={form.consumo_f3_kwh ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, consumo_f3_kwh: parseNumero(e.target.value) }))}
                    helperText={CHECKLIST_FOTOVOLTAICO_TESTI.CONSUMO_F3_HELPER}
                    disabled={salvataggio}
                  />
                </div>

                <h3 className="mt-4 text-sm font-medium text-text-primary">
                  {CHECKLIST_FOTOVOLTAICO_TESTI.SVILUPPI_FUTURI_TITOLO}
                </h3>
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <label className="flex w-48 shrink-0 items-center gap-2 text-sm text-text-primary">
                      <input type="checkbox" checked={form.pompa_calore_attiva} onChange={(e) => setForm((f) => ({ ...f, pompa_calore_attiva: e.target.checked }))} disabled={salvataggio} className="h-4 w-4 accent-brand-500" />
                      {CHECKLIST_FOTOVOLTAICO_TESTI.POMPA_CALORE}
                    </label>
                    {form.pompa_calore_attiva && (
                      <Input
                        label={CHECKLIST_FOTOVOLTAICO_TESTI.POMPA_CALORE_KWH}
                        type="number"
                        value={form.pompa_calore_kwh_anno}
                        onChange={(e) => setForm((f) => ({ ...f, pompa_calore_kwh_anno: parseNumero(e.target.value) ?? 0 }))}
                        disabled={salvataggio}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex w-48 shrink-0 items-center gap-2 text-sm text-text-primary">
                      <input type="checkbox" checked={form.auto_elettrica_attiva} onChange={(e) => setForm((f) => ({ ...f, auto_elettrica_attiva: e.target.checked }))} disabled={salvataggio} className="h-4 w-4 accent-brand-500" />
                      {CHECKLIST_FOTOVOLTAICO_TESTI.AUTO_ELETTRICA}
                    </label>
                    {form.auto_elettrica_attiva && (
                      <Input
                        label={CHECKLIST_FOTOVOLTAICO_TESTI.AUTO_ELETTRICA_KWH}
                        type="number"
                        value={form.auto_elettrica_kwh_anno}
                        onChange={(e) => setForm((f) => ({ ...f, auto_elettrica_kwh_anno: parseNumero(e.target.value) ?? 0 }))}
                        disabled={salvataggio}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex w-48 shrink-0 items-center gap-2 text-sm text-text-primary">
                      <input type="checkbox" checked={form.induzione_attiva} onChange={(e) => setForm((f) => ({ ...f, induzione_attiva: e.target.checked }))} disabled={salvataggio} className="h-4 w-4 accent-brand-500" />
                      {CHECKLIST_FOTOVOLTAICO_TESTI.INDUZIONE}
                    </label>
                    {form.induzione_attiva && (
                      <Input
                        label={CHECKLIST_FOTOVOLTAICO_TESTI.INDUZIONE_KWH}
                        type="number"
                        value={form.induzione_kwh_anno}
                        onChange={(e) => setForm((f) => ({ ...f, induzione_kwh_anno: parseNumero(e.target.value) ?? 0 }))}
                        disabled={salvataggio}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex w-48 shrink-0 items-center gap-2 text-sm text-text-primary">
                      <input type="checkbox" checked={form.altro_attivo} onChange={(e) => setForm((f) => ({ ...f, altro_attivo: e.target.checked }))} disabled={salvataggio} className="h-4 w-4 accent-brand-500" />
                      {CHECKLIST_FOTOVOLTAICO_TESTI.ALTRO}
                    </label>
                    {form.altro_attivo && (
                      <>
                        <Input
                          label={CHECKLIST_FOTOVOLTAICO_TESTI.ALTRO_DESCRIZIONE}
                          value={form.altro_descrizione}
                          onChange={(e) => setForm((f) => ({ ...f, altro_descrizione: e.target.value }))}
                          disabled={salvataggio}
                        />
                        <Input
                          label={CHECKLIST_FOTOVOLTAICO_TESTI.ALTRO_KWH}
                          type="number"
                          value={form.altro_kwh_anno}
                          onChange={(e) => setForm((f) => ({ ...f, altro_kwh_anno: parseNumero(e.target.value) ?? 0 }))}
                          disabled={salvataggio}
                        />
                      </>
                    )}
                  </div>
                </div>

                <h3 className="mt-4 text-sm font-medium text-text-primary">
                  {CHECKLIST_FOTOVOLTAICO_TESTI.PARAMETRI_CALCOLO_TITOLO}
                </h3>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <Input
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.RESA_KWH_PER_KWP}
                    type="number"
                    value={form.resa_kwh_per_kwp}
                    onChange={(e) => setForm((f) => ({ ...f, resa_kwh_per_kwp: parseNumero(e.target.value) ?? f.resa_kwh_per_kwp }))}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.FATTORE_OCCUPAZIONE_FALDA}
                    type="number"
                    step="0.01"
                    value={form.fattore_occupazione_falda}
                    onChange={(e) => setForm((f) => ({ ...f, fattore_occupazione_falda: parseNumero(e.target.value) ?? f.fattore_occupazione_falda }))}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.MARGINE_BATTERIA}
                    type="number"
                    step="0.01"
                    value={form.margine_batteria}
                    onChange={(e) => setForm((f) => ({ ...f, margine_batteria: parseNumero(e.target.value) ?? f.margine_batteria }))}
                    disabled={salvataggio}
                  />
                </div>

                <div className="mt-3">
                  <Select
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.MODULO_FOTOVOLTAICO}
                    value={form.modulo_fotovoltaico_id || ""}
                    onChange={(e) => setForm((f) => ({ ...f, modulo_fotovoltaico_id: e.target.value || null }))}
                    disabled={salvataggio}
                  >
                    <option value="">{CHECKLIST_FOTOVOLTAICO_TESTI.MODULO_FOTOVOLTAICO_NESSUNO}</option>
                    {moduli.map((modulo) => (
                      <option key={modulo.id} value={modulo.id}>
                        {modulo.marca} {modulo.modello} ({modulo.potenza_wp} Wp)
                      </option>
                    ))}
                  </Select>

                  {moduloSuggerito && moduloSuggerito.id !== form.modulo_fotovoltaico_id && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-bg-subtle px-3 py-2">
                      <p className="text-xs text-text-muted">
                        Modulo suggerito per lo spazio disponibile: {moduloSuggerito.marca} {moduloSuggerito.modello} ({moduloSuggerito.potenza_wp} Wp)
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={salvataggio}
                        onClick={() => setForm((f) => ({ ...f, modulo_fotovoltaico_id: moduloSuggerito.id }))}
                      >
                        Usa questo
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-md border border-border bg-bg-subtle p-3">
                  <h3 className="text-sm font-medium text-text-primary mb-2">
                    {CHECKLIST_FOTOVOLTAICO_TESTI.RISULTATI_TITOLO}
                  </h3>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-text-muted">{CHECKLIST_FOTOVOLTAICO_TESTI.FABBISOGNO_TOTALE}</dt>
                      <dd className="font-medium text-text-primary">
                        {formattaRisultato(risultatoDimensionamento.fabbisogno_totale_kwh, "kWh")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">{CHECKLIST_FOTOVOLTAICO_TESTI.POTENZA_CONSIGLIATA}</dt>
                      <dd className="font-medium text-text-primary">
                        {formattaRisultato(risultatoDimensionamento.potenza_consigliata_kwp, "kWp")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">{CHECKLIST_FOTOVOLTAICO_TESTI.POTENZA_MASSIMA}</dt>
                      <dd className="font-medium text-text-primary">
                        {formattaRisultato(risultatoDimensionamento.potenza_massima_kwp, "kWp")}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">{CHECKLIST_FOTOVOLTAICO_TESTI.NUMERO_MODULI_MAX}</dt>
                      <dd className="font-medium text-text-primary">
                        {risultatoDimensionamento.numero_moduli_max === null ? "—" : risultatoDimensionamento.numero_moduli_max}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-text-muted">{CHECKLIST_FOTOVOLTAICO_TESTI.BATTERIA_CONSIGLIATA}</dt>
                      <dd className="font-medium text-text-primary">
                        {formattaRisultato(risultatoDimensionamento.batteria_consigliata_kwh, "kWh")}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {/* ── Materiali ── */}
              <div>
                <h2 className="font-heading text-base font-medium text-text-primary mb-3">
                  {CHECKLIST_FOTOVOLTAICO_TESTI.MATERIALI_TITOLO}
                </h2>
                <div className="flex flex-col gap-2">
                  {form.materiali.map((materiale, indice) => (
                    <div key={indice} className="flex gap-2">
                      <input
                        value={materiale.descrizione}
                        onChange={(e) => aggiornaMateriale(indice, "descrizione", e.target.value)}
                        placeholder={CHECKLIST_FOTOVOLTAICO_TESTI.DESCRIZIONE_PLACEHOLDER}
                        disabled={salvataggio}
                        className="h-9 flex-1 min-w-0 px-3 text-sm border border-border rounded-md bg-bg-card text-text-primary placeholder:text-text-subtle outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors duration-150"
                      />
                      <input
                        value={materiale.quantita}
                        onChange={(e) => aggiornaMateriale(indice, "quantita", e.target.value)}
                        placeholder={CHECKLIST_FOTOVOLTAICO_TESTI.QUANTITA}
                        disabled={salvataggio}
                        className="h-9 w-28 px-3 text-sm border border-border rounded-md bg-bg-card text-text-primary placeholder:text-text-subtle outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors duration-150"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0 text-error-500 hover:text-error-500"
                        aria-label={CHECKLIST_FOTOVOLTAICO_TESTI.RIMUOVI_MATERIALE}
                        onClick={() => rimuoviMateriale(indice)}
                        disabled={salvataggio}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={aggiungiMateriale} disabled={salvataggio} className="self-start">
                    {CHECKLIST_FOTOVOLTAICO_TESTI.AGGIUNGI_MATERIALE}
                  </Button>
                </div>
              </div>

              {/* ── Note ── */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-text-primary">{CHECKLIST_FOTOVOLTAICO_TESTI.NOTE}</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  disabled={salvataggio}
                  rows={3}
                  className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-muted resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="secondary" loading={salvataggio} className="flex-1">
                  {salvataggio
                    ? CHECKLIST_FOTOVOLTAICO_TESTI.SALVATAGGIO
                    : checklistInModificaId
                      ? CHECKLIST_FOTOVOLTAICO_TESTI.SALVA_MODIFICHE
                      : CHECKLIST_FOTOVOLTAICO_TESTI.SALVA}
                </Button>
                <Button type="button" loading={salvataggio} className="flex-1" onClick={() => void handleSalvaEFirma()}>
                  {CHECKLIST_FOTOVOLTAICO_TESTI.VAI_ALLA_FIRMA}
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
                {CHECKLIST_FOTOVOLTAICO_TESTI.ANNULLA}
              </Button>
            </form>
          </Card>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {loading && <p className="text-sm text-text-muted">{CHECKLIST_FOTOVOLTAICO_TESTI.CARICAMENTO}</p>}

          {!loading && checklists.length === 0 && (
            <p className="text-sm text-text-muted">{CHECKLIST_FOTOVOLTAICO_TESTI.NESSUNA_CHECKLIST}</p>
          )}

          {checklists.map((checklist) => {
            const nomeCliente = `${checklist.nome} ${checklist.cognome}`.trim() || checklist.ragione_sociale || "-";
            const inCorso = azioneInCorsoId === checklist.id;

            return (
              <Card key={checklist.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-text-primary">{nomeCliente}</p>
                    <p className="text-sm text-text-muted">
                      {checklist.comune || "-"} · {formattaDataOra(checklist.created_at)}
                    </p>
                  </div>
                  <Badge variant={BADGE_PER_STATO[checklist.stato]}>
                    {LABEL_STATI_CHECKLIST_FOTOVOLTAICO[checklist.stato]}
                  </Badge>
                </div>

                {checklist.stato === CHECKLIST_FOTOVOLTAICO_STATI.BOZZA && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => caricaChecklistInForm(checklist)}>
                      {CHECKLIST_FOTOVOLTAICO_TESTI.MODIFICA}
                    </Button>
                    <Link href={`${APP_ROUTES.BACKOFFICE_CHECKLIST_FOTOVOLTAICO}/${checklist.id}/firma`}>
                      <Button size="sm">{CHECKLIST_FOTOVOLTAICO_TESTI.VAI_ALLA_FIRMA}</Button>
                    </Link>
                  </div>
                )}

                {checklist.stato !== CHECKLIST_FOTOVOLTAICO_STATI.BOZZA && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {checklist.stato === CHECKLIST_FOTOVOLTAICO_STATI.FIRMATO && (
                      <Button size="sm" icon={<Send className="h-4 w-4" />} loading={inCorso} onClick={() => void handleInvia(checklist)}>
                        {CHECKLIST_FOTOVOLTAICO_TESTI.INVIA_ORA}
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} disabled={inCorso} onClick={() => void handleDownload(checklist)}>
                      {CHECKLIST_FOTOVOLTAICO_TESTI.DOWNLOAD_PDF}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
