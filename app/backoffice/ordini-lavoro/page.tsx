"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Home, Plus, Share2, Download, Send } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import {
  LABEL_STATI_ORDINI_LAVORO,
  ORDINI_LAVORO_LIMITI,
  ORDINI_LAVORO_STATI,
  ORDINI_LAVORO_TESTI,
} from "@/constants/ordiniLavoro";
import { getMessaggioErrore } from "@/lib/errors";
import { creaOrdineLavoroEdison } from "@/services/ordiniLavoro/creaOrdineLavoroEdison";
import { aggiornaOrdineLavoroEdison } from "@/services/ordiniLavoro/aggiornaOrdineLavoroEdison";
import { loadOrdiniLavoro } from "@/services/ordiniLavoro/loadOrdiniLavoro";
import { inviaOrdineLavoroEdison } from "@/services/ordiniLavoro/inviaOrdineLavoroEdison";
import { fetchOrdineLavoroPdf } from "@/services/ordiniLavoro/fetchOrdineLavoroPdf";
import { loadChecklistiWallbox } from "@/services/checklistWallbox/loadChecklistiWallbox";
import type {
  OrdineLavoroEdison,
  OrdineLavoroEdisonInput,
  VoceElencoOrdineLavoro,
} from "@/types/ordiniLavoro";
import type { ChecklistWallbox } from "@/types/checklistWallbox";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

const BADGE_PER_STATO: Record<string, BadgeProps["variant"]> = {
  [ORDINI_LAVORO_STATI.BOZZA]: "muted",
  [ORDINI_LAVORO_STATI.FIRMATO]: "warning",
  [ORDINI_LAVORO_STATI.INVIATO]: "success",
};

const TIPOLOGIA_CAMPI: {
  chiave: keyof Pick<
    OrdineLavoroEdisonInput,
    | "tipologia_24_7"
    | "tipologia_caldaia"
    | "tipologia_scaldabagno"
    | "tipologia_climatizzatore"
    | "tipologia_elettrodomestico"
    | "tipologia_varie"
  >;
  label: string;
}[] = [
  { chiave: "tipologia_24_7", label: ORDINI_LAVORO_TESTI.TIPOLOGIA_24_7 },
  { chiave: "tipologia_caldaia", label: ORDINI_LAVORO_TESTI.TIPOLOGIA_CALDAIA },
  { chiave: "tipologia_scaldabagno", label: ORDINI_LAVORO_TESTI.TIPOLOGIA_SCALDABAGNO },
  { chiave: "tipologia_climatizzatore", label: ORDINI_LAVORO_TESTI.TIPOLOGIA_CLIMATIZZATORE },
  { chiave: "tipologia_elettrodomestico", label: ORDINI_LAVORO_TESTI.TIPOLOGIA_ELETTRODOMESTICO },
  { chiave: "tipologia_varie", label: ORDINI_LAVORO_TESTI.TIPOLOGIA_VARIE },
];

const DETTAGLIO_CAMPI: {
  chiave: keyof Pick<
    OrdineLavoroEdisonInput,
    | "dettaglio_manodopera_compresa"
    | "dettaglio_manodopera_a_pagamento"
    | "dettaglio_pezzi_ricambio"
    | "dettaglio_preventivo"
    | "dettaglio_riparazione"
    | "dettaglio_manutenzione"
  >;
  label: string;
}[] = [
  { chiave: "dettaglio_manodopera_compresa", label: ORDINI_LAVORO_TESTI.DETTAGLIO_MANODOPERA_COMPRESA },
  { chiave: "dettaglio_manodopera_a_pagamento", label: ORDINI_LAVORO_TESTI.DETTAGLIO_MANODOPERA_A_PAGAMENTO },
  { chiave: "dettaglio_pezzi_ricambio", label: ORDINI_LAVORO_TESTI.DETTAGLIO_PEZZI_RICAMBIO },
  { chiave: "dettaglio_preventivo", label: ORDINI_LAVORO_TESTI.DETTAGLIO_PREVENTIVO },
  { chiave: "dettaglio_riparazione", label: ORDINI_LAVORO_TESTI.DETTAGLIO_RIPARAZIONE },
  { chiave: "dettaglio_manutenzione", label: ORDINI_LAVORO_TESTI.DETTAGLIO_MANUTENZIONE },
];

function statoIniziale(): OrdineLavoroEdisonInput {
  return {
    checklist_wallbox_id: null,
    intervento_numero: "",
    data: null,
    ora_dalle: "",
    ora_alle: "",
    tecnico_societa: "",
    tecnico_nome: "",
    cliente_nome_cognome: "",
    cliente_indirizzo: "",
    cliente_civico: "",
    cliente_comune: "",
    cliente_cap: "",
    cliente_provincia: "",
    cliente_telefono: "",
    cliente_email: "",
    tipologia_24_7: false,
    tipologia_caldaia: false,
    tipologia_scaldabagno: false,
    tipologia_climatizzatore: false,
    tipologia_elettrodomestico: false,
    tipologia_varie: false,
    dettaglio_manodopera_compresa: false,
    dettaglio_manodopera_a_pagamento: false,
    dettaglio_ore_manodopera_extra: "",
    dettaglio_pezzi_ricambio: false,
    dettaglio_preventivo: false,
    dettaglio_riparazione: false,
    dettaglio_manutenzione: false,
    dettaglio_impianti: "",
    dettaglio_intervento_eseguito: "",
    elenco_interventi: [],
    prescrizione_sicurezza: null,
    prescrizione_motivo: "",
    osservazioni: "",
    modalita_pagamento: null,
    luogo: "",
  };
}

function elencoIniziale(): VoceElencoOrdineLavoro[] {
  return Array.from({ length: ORDINI_LAVORO_LIMITI.ELENCO_INTERVENTI_MAX_RIGHE }, () => ({
    descrizione: "",
    importo: "",
  }));
}

function formattaDataOra(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function OrdiniLavoroPage() {
  const toast = useToast();
  const router = useRouter();
  const invioDaQueryGestitoRef = useRef(false);

  const [ordini, setOrdini] = useState<OrdineLavoroEdison[]>([]);
  const [checklists, setChecklists] = useState<ChecklistWallbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostraForm, setMostraForm] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [form, setForm] = useState<OrdineLavoroEdisonInput>(statoIniziale());
  const [elenco, setElenco] = useState<VoceElencoOrdineLavoro[]>(elencoIniziale());
  const [azioneInCorsoId, setAzioneInCorsoId] = useState<string | null>(null);
  const [ordineInModificaId, setOrdineInModificaId] = useState<string | null>(null);

  const ricarica = async () => {
    try {
      setLoading(true);
      const [datiOrdini, datiChecklist] = await Promise.all([
        loadOrdiniLavoro(),
        loadChecklistiWallbox(),
      ]);
      setOrdini(datiOrdini);
      setChecklists(datiChecklist);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ORDINI_LAVORO_TESTI.ERRORI.GENERICO));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void ricarica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelezionaChecklist = (checklistId: string) => {
    if (!checklistId) {
      setForm({ ...form, checklist_wallbox_id: null });
      return;
    }

    const checklist = checklists.find((c) => c.id === checklistId);
    if (!checklist) return;

    setForm({
      ...form,
      checklist_wallbox_id: checklist.id,
      tecnico_societa: checklist.ragione_sociale,
      tecnico_nome: checklist.firma_tecnico_nome || form.tecnico_nome,
      cliente_nome_cognome: `${checklist.nome} ${checklist.cognome}`.trim(),
      cliente_indirizzo: checklist.via,
      cliente_comune: checklist.comune,
      cliente_cap: checklist.cap,
      cliente_provincia: checklist.provincia,
      cliente_telefono: checklist.telefono,
      cliente_email: checklist.email_cliente,
      luogo: checklist.comune,
      data: checklist.data_sopralluogo || form.data,
    });
  };

  const validaForm = () => {
    if (!form.cliente_nome_cognome.trim()) {
      toast.error(ORDINI_LAVORO_TESTI.ERRORI.NOME_CLIENTE_OBBLIGATORIO);
      return false;
    }
    return true;
  };

  const salvaDaForm = async () => {
    const elenco_interventi = elenco.filter(
      (voce) => voce.descrizione.trim() && voce.importo.trim()
    );
    const payload = { ...form, elenco_interventi };

    return ordineInModificaId
      ? aggiornaOrdineLavoroEdison(ordineInModificaId, payload)
      : creaOrdineLavoroEdison(payload);
  };

  const caricaOrdineInForm = (ordine: OrdineLavoroEdison) => {
    setOrdineInModificaId(ordine.id);
    setForm({
      checklist_wallbox_id: ordine.checklist_wallbox_id,
      intervento_numero: ordine.intervento_numero,
      data: ordine.data,
      ora_dalle: ordine.ora_dalle,
      ora_alle: ordine.ora_alle,
      tecnico_societa: ordine.tecnico_societa,
      tecnico_nome: ordine.tecnico_nome,
      cliente_nome_cognome: ordine.cliente_nome_cognome,
      cliente_indirizzo: ordine.cliente_indirizzo,
      cliente_civico: ordine.cliente_civico,
      cliente_comune: ordine.cliente_comune,
      cliente_cap: ordine.cliente_cap,
      cliente_provincia: ordine.cliente_provincia,
      cliente_telefono: ordine.cliente_telefono,
      cliente_email: ordine.cliente_email,
      tipologia_24_7: ordine.tipologia_24_7,
      tipologia_caldaia: ordine.tipologia_caldaia,
      tipologia_scaldabagno: ordine.tipologia_scaldabagno,
      tipologia_climatizzatore: ordine.tipologia_climatizzatore,
      tipologia_elettrodomestico: ordine.tipologia_elettrodomestico,
      tipologia_varie: ordine.tipologia_varie,
      dettaglio_manodopera_compresa: ordine.dettaglio_manodopera_compresa,
      dettaglio_manodopera_a_pagamento: ordine.dettaglio_manodopera_a_pagamento,
      dettaglio_ore_manodopera_extra: ordine.dettaglio_ore_manodopera_extra,
      dettaglio_pezzi_ricambio: ordine.dettaglio_pezzi_ricambio,
      dettaglio_preventivo: ordine.dettaglio_preventivo,
      dettaglio_riparazione: ordine.dettaglio_riparazione,
      dettaglio_manutenzione: ordine.dettaglio_manutenzione,
      dettaglio_impianti: ordine.dettaglio_impianti,
      dettaglio_intervento_eseguito: ordine.dettaglio_intervento_eseguito,
      elenco_interventi: ordine.elenco_interventi,
      prescrizione_sicurezza: ordine.prescrizione_sicurezza,
      prescrizione_motivo: ordine.prescrizione_motivo,
      osservazioni: ordine.osservazioni,
      modalita_pagamento: ordine.modalita_pagamento,
      luogo: ordine.luogo,
    });
    const righe = [...ordine.elenco_interventi];
    while (righe.length < ORDINI_LAVORO_LIMITI.ELENCO_INTERVENTI_MAX_RIGHE) {
      righe.push({ descrizione: "", importo: "" });
    }
    setElenco(righe.slice(0, ORDINI_LAVORO_LIMITI.ELENCO_INTERVENTI_MAX_RIGHE));
    setMostraForm(true);
  };

  const handleSalvaBozza = async (event: FormEvent) => {
    event.preventDefault();
    if (!validaForm()) return;

    try {
      setSalvataggio(true);
      const modificando = Boolean(ordineInModificaId);
      await salvaDaForm();
      toast.success(
        modificando
          ? ORDINI_LAVORO_TESTI.MESSAGGI.MODIFICATO
          : ORDINI_LAVORO_TESTI.MESSAGGI.CREATO
      );
      setForm(statoIniziale());
      setElenco(elencoIniziale());
      setOrdineInModificaId(null);
      setMostraForm(false);
      await ricarica();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ORDINI_LAVORO_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleSalvaEFirma = async () => {
    if (!validaForm()) return;

    try {
      setSalvataggio(true);
      const ordine = await salvaDaForm();
      router.push(`${APP_ROUTES.BACKOFFICE_ORDINI_LAVORO}/${ordine.id}/firma`);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ORDINI_LAVORO_TESTI.ERRORI.GENERICO));
      setSalvataggio(false);
    }
  };

  const handleInvia = async (ordine: OrdineLavoroEdison) => {
    try {
      setAzioneInCorsoId(ordine.id);
      const esito = await inviaOrdineLavoroEdison({ ordineLavoroId: ordine.id });
      toast.success(`${ORDINI_LAVORO_TESTI.MESSAGGI.INVIATO} ${esito.destinatario}`);
      await ricarica();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ORDINI_LAVORO_TESTI.ERRORI.INVIO_FALLITO));
    } finally {
      setAzioneInCorsoId(null);
    }
  };

  // Arrivo dalla pagina firma con ?invia=<id>: avvia subito l'invio
  useEffect(() => {
    if (invioDaQueryGestitoRef.current || loading || ordini.length === 0) {
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

    const ordine = ordini.find((o) => o.id === invioId);
    if (ordine && ordine.stato === ORDINI_LAVORO_STATI.FIRMATO) {
      void handleInvia(ordine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ordini]);

  const handleDownload = async (ordine: OrdineLavoroEdison) => {
    try {
      setAzioneInCorsoId(ordine.id);
      const { blob, nomeFile } = await fetchOrdineLavoroPdf(ordine.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nomeFile;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ORDINI_LAVORO_TESTI.ERRORI.PDF_GENERICO));
    } finally {
      setAzioneInCorsoId(null);
    }
  };

  const handleCondividiWhatsapp = async (ordine: OrdineLavoroEdison) => {
    try {
      setAzioneInCorsoId(ordine.id);
      const { blob, nomeFile } = await fetchOrdineLavoroPdf(ordine.id);
      const file = new File([blob], nomeFile, { type: "application/pdf" });
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };

      if (nav.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({
          files: [file],
          title: nomeFile,
          text: ORDINI_LAVORO_TESTI.TITOLO,
        });
      } else {
        toast.error(ORDINI_LAVORO_TESTI.CONDIVIDI_NON_DISPONIBILE);
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast.error(getMessaggioErrore(error, ORDINI_LAVORO_TESTI.ERRORI.PDF_GENERICO));
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
              {ORDINI_LAVORO_TESTI.BACKOFFICE}
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-[720px] px-5 py-6">
        <nav
          aria-label="breadcrumb"
          className="mb-5 flex items-center gap-1.5 text-sm text-text-muted"
        >
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">{ORDINI_LAVORO_TESTI.TITOLO}</span>
        </nav>

        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-medium text-text-primary">
            {ORDINI_LAVORO_TESTI.TITOLO}
          </h1>
          <Button
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() =>
              setMostraForm((v) => {
                const next = !v;
                if (next) {
                  setOrdineInModificaId(null);
                  setForm(statoIniziale());
                  setElenco(elencoIniziale());
                }
                return next;
              })
            }
          >
            {ORDINI_LAVORO_TESTI.NUOVO}
          </Button>
        </div>

        {mostraForm && (
          <Card className="mt-5 p-5">
            <form onSubmit={(e) => void handleSalvaBozza(e)} className="flex flex-col gap-5">
              {ordineInModificaId && (
                <p className="text-sm font-medium text-brand-500">
                  {ORDINI_LAVORO_TESTI.MODIFICA_TITOLO}
                </p>
              )}
              <div>
                <label className="text-sm font-medium text-text-primary">
                  {ORDINI_LAVORO_TESTI.RECUPERA_DA_CHECKLIST}
                </label>
                <select
                  value={form.checklist_wallbox_id || ""}
                  onChange={(e) => handleSelezionaChecklist(e.target.value)}
                  disabled={salvataggio}
                  className="mt-1 h-10 w-full rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
                >
                  <option value="">{ORDINI_LAVORO_TESTI.RECUPERA_DA_CHECKLIST_PLACEHOLDER}</option>
                  {checklists.map((checklist) => (
                    <option key={checklist.id} value={checklist.id}>
                      {`${checklist.nome} ${checklist.cognome}`.trim() || checklist.comune} —{" "}
                      {checklist.comune}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-text-muted">
                  {ORDINI_LAVORO_TESTI.RECUPERA_DA_CHECKLIST_HELPER}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Input
                  label={ORDINI_LAVORO_TESTI.INTERVENTO_NUMERO}
                  value={form.intervento_numero}
                  onChange={(e) => setForm({ ...form, intervento_numero: e.target.value })}
                  disabled={salvataggio}
                />
                <Input
                  label={ORDINI_LAVORO_TESTI.DATA}
                  type="date"
                  value={form.data || ""}
                  onChange={(e) => setForm({ ...form, data: e.target.value || null })}
                  disabled={salvataggio}
                />
                <Input
                  label={ORDINI_LAVORO_TESTI.ORA_DALLE}
                  value={form.ora_dalle}
                  onChange={(e) => setForm({ ...form, ora_dalle: e.target.value })}
                  disabled={salvataggio}
                  placeholder="09:00"
                />
                <Input
                  label={ORDINI_LAVORO_TESTI.ORA_ALLE}
                  value={form.ora_alle}
                  onChange={(e) => setForm({ ...form, ora_alle: e.target.value })}
                  disabled={salvataggio}
                  placeholder="11:30"
                />
              </div>

              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {ORDINI_LAVORO_TESTI.TECNICO_SPECIALIZZATO}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={ORDINI_LAVORO_TESTI.TECNICO_SOCIETA}
                    value={form.tecnico_societa}
                    onChange={(e) => setForm({ ...form, tecnico_societa: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={ORDINI_LAVORO_TESTI.TECNICO_NOME}
                    value={form.tecnico_nome}
                    onChange={(e) => setForm({ ...form, tecnico_nome: e.target.value })}
                    disabled={salvataggio}
                  />
                </div>
              </div>

              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {ORDINI_LAVORO_TESTI.DATI_CLIENTE}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={ORDINI_LAVORO_TESTI.CLIENTE_NOME_COGNOME}
                    value={form.cliente_nome_cognome}
                    onChange={(e) => setForm({ ...form, cliente_nome_cognome: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={ORDINI_LAVORO_TESTI.CLIENTE_TELEFONO}
                    value={form.cliente_telefono}
                    onChange={(e) => setForm({ ...form, cliente_telefono: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={ORDINI_LAVORO_TESTI.CLIENTE_INDIRIZZO}
                    value={form.cliente_indirizzo}
                    onChange={(e) => setForm({ ...form, cliente_indirizzo: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={ORDINI_LAVORO_TESTI.CLIENTE_CIVICO}
                    value={form.cliente_civico}
                    onChange={(e) => setForm({ ...form, cliente_civico: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={ORDINI_LAVORO_TESTI.CLIENTE_COMUNE}
                    value={form.cliente_comune}
                    onChange={(e) => setForm({ ...form, cliente_comune: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={ORDINI_LAVORO_TESTI.CLIENTE_CAP}
                    value={form.cliente_cap}
                    onChange={(e) => setForm({ ...form, cliente_cap: e.target.value })}
                    disabled={salvataggio}
                  />
                  <Input
                    label={ORDINI_LAVORO_TESTI.CLIENTE_PROVINCIA}
                    value={form.cliente_provincia}
                    maxLength={2}
                    onChange={(e) =>
                      setForm({ ...form, cliente_provincia: e.target.value.toUpperCase() })
                    }
                    disabled={salvataggio}
                  />
                  <Input
                    label={ORDINI_LAVORO_TESTI.CLIENTE_EMAIL}
                    type="email"
                    value={form.cliente_email}
                    onChange={(e) => setForm({ ...form, cliente_email: e.target.value })}
                    disabled={salvataggio}
                  />
                </div>
              </div>

              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {ORDINI_LAVORO_TESTI.TIPOLOGIA_INTERVENTO}
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOLOGIA_CAMPI.map(({ chiave, label }) => (
                    <label key={chiave} className="flex items-center gap-1.5 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        checked={form[chiave]}
                        onChange={(e) => setForm({ ...form, [chiave]: e.target.checked })}
                        disabled={salvataggio}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {ORDINI_LAVORO_TESTI.DETTAGLIO_PRESTAZIONE}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {DETTAGLIO_CAMPI.map(({ chiave, label }) => (
                    <label key={chiave} className="flex items-center gap-1.5 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        checked={form[chiave]}
                        onChange={(e) => setForm({ ...form, [chiave]: e.target.checked })}
                        disabled={salvataggio}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="mt-2">
                  <Input
                    label={ORDINI_LAVORO_TESTI.DETTAGLIO_ORE_MANODOPERA_EXTRA}
                    value={form.dettaglio_ore_manodopera_extra}
                    onChange={(e) =>
                      setForm({ ...form, dettaglio_ore_manodopera_extra: e.target.value })
                    }
                    disabled={salvataggio}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">
                  {ORDINI_LAVORO_TESTI.DETTAGLIO_IMPIANTI}
                </label>
                <textarea
                  value={form.dettaglio_impianti}
                  onChange={(e) => setForm({ ...form, dettaglio_impianti: e.target.value })}
                  disabled={salvataggio}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-bg-card p-3 text-sm text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">
                  {ORDINI_LAVORO_TESTI.DETTAGLIO_INTERVENTO_ESEGUITO}
                </label>
                <textarea
                  value={form.dettaglio_intervento_eseguito}
                  onChange={(e) =>
                    setForm({ ...form, dettaglio_intervento_eseguito: e.target.value })
                  }
                  disabled={salvataggio}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-border bg-bg-card p-3 text-sm text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {ORDINI_LAVORO_TESTI.ELENCO_INTERVENTI_TITOLO}
                </h2>
                <div className="flex flex-col gap-2">
                  {elenco.map((voce, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={voce.descrizione}
                        onChange={(e) => {
                          const copia = [...elenco];
                          copia[index] = { ...copia[index], descrizione: e.target.value };
                          setElenco(copia);
                        }}
                        disabled={salvataggio}
                        placeholder={ORDINI_LAVORO_TESTI.ELENCO_DESCRIZIONE_PLACEHOLDER}
                        className="h-9 flex-1 rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
                      />
                      <input
                        value={voce.importo}
                        onChange={(e) => {
                          const copia = [...elenco];
                          copia[index] = { ...copia[index], importo: e.target.value };
                          setElenco(copia);
                        }}
                        disabled={salvataggio}
                        placeholder={ORDINI_LAVORO_TESTI.ELENCO_IMPORTO_PLACEHOLDER}
                        className="h-9 w-32 shrink-0 rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {ORDINI_LAVORO_TESTI.PRESCRIZIONI_TITOLO}
                </h2>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    disabled={salvataggio}
                    onClick={() =>
                      setForm({
                        ...form,
                        prescrizione_sicurezza: form.prescrizione_sicurezza === true ? null : true,
                      })
                    }
                    className={`h-8 rounded-md border px-3 text-xs font-semibold transition-colors ${
                      form.prescrizione_sicurezza === true
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-border bg-bg-card text-text-primary hover:bg-bg-subtle"
                    }`}
                  >
                    {ORDINI_LAVORO_TESTI.SI}
                  </button>
                  <button
                    type="button"
                    disabled={salvataggio}
                    onClick={() =>
                      setForm({
                        ...form,
                        prescrizione_sicurezza: form.prescrizione_sicurezza === false ? null : false,
                      })
                    }
                    className={`h-8 rounded-md border px-3 text-xs font-semibold transition-colors ${
                      form.prescrizione_sicurezza === false
                        ? "border-error-500 bg-error-500 text-white"
                        : "border-border bg-bg-card text-text-primary hover:bg-bg-subtle"
                    }`}
                  >
                    {ORDINI_LAVORO_TESTI.NO}
                  </button>
                </div>
                {form.prescrizione_sicurezza === false && (
                  <div className="mt-2">
                    <input
                      value={form.prescrizione_motivo}
                      onChange={(e) => setForm({ ...form, prescrizione_motivo: e.target.value })}
                      disabled={salvataggio}
                      placeholder={ORDINI_LAVORO_TESTI.PRESCRIZIONE_MOTIVO_PLACEHOLDER}
                      className="h-9 w-full rounded-md border border-border bg-bg-card px-2 text-sm text-text-primary outline-none focus:border-brand-500"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-text-primary">
                  {ORDINI_LAVORO_TESTI.OSSERVAZIONI}
                </label>
                <textarea
                  value={form.osservazioni}
                  onChange={(e) => setForm({ ...form, osservazioni: e.target.value })}
                  disabled={salvataggio}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-border bg-bg-card p-3 text-sm text-text-primary outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  {ORDINI_LAVORO_TESTI.MODALITA_PAGAMENTO}
                </h2>
                <div className="flex items-center gap-4">
                  {(["BOLLETTA", "CARTA"] as const).map((modo) => (
                    <label key={modo} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="radio"
                        name="modalita_pagamento"
                        checked={form.modalita_pagamento === modo}
                        onChange={() => setForm({ ...form, modalita_pagamento: modo })}
                        disabled={salvataggio}
                      />
                      {modo === "BOLLETTA"
                        ? ORDINI_LAVORO_TESTI.MODALITA_PAGAMENTO_BOLLETTA
                        : ORDINI_LAVORO_TESTI.MODALITA_PAGAMENTO_CARTA}
                    </label>
                  ))}
                </div>
              </div>

              <Input
                label={ORDINI_LAVORO_TESTI.LUOGO}
                value={form.luogo}
                onChange={(e) => setForm({ ...form, luogo: e.target.value })}
                disabled={salvataggio}
              />

              <div className="flex flex-col sm:flex-row gap-2">
                <Button type="submit" variant="secondary" loading={salvataggio} className="flex-1">
                  {salvataggio
                    ? ORDINI_LAVORO_TESTI.SALVATAGGIO
                    : ordineInModificaId
                      ? ORDINI_LAVORO_TESTI.SALVA_MODIFICHE
                      : ORDINI_LAVORO_TESTI.SALVA}
                </Button>
                <Button
                  type="button"
                  loading={salvataggio}
                  className="flex-1"
                  onClick={() => void handleSalvaEFirma()}
                >
                  {ORDINI_LAVORO_TESTI.VAI_ALLA_FIRMA}
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                disabled={salvataggio}
                onClick={() => {
                  setMostraForm(false);
                  setOrdineInModificaId(null);
                }}
              >
                {ORDINI_LAVORO_TESTI.ANNULLA}
              </Button>
            </form>
          </Card>
        )}

        <div className="mt-6 flex flex-col gap-3">
          {loading && <p className="text-sm text-text-muted">{ORDINI_LAVORO_TESTI.CARICAMENTO}</p>}

          {!loading && ordini.length === 0 && (
            <p className="text-sm text-text-muted">{ORDINI_LAVORO_TESTI.NESSUN_ORDINE}</p>
          )}

          {ordini.map((ordine) => {
            const inCorso = azioneInCorsoId === ordine.id;

            return (
              <Card key={ordine.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-text-primary">
                      {ordine.cliente_nome_cognome || "-"}
                    </p>
                    <p className="text-sm text-text-muted">
                      {ordine.cliente_comune || "-"} · {formattaDataOra(ordine.created_at)}
                    </p>
                  </div>
                  <Badge variant={BADGE_PER_STATO[ordine.stato]}>
                    {LABEL_STATI_ORDINI_LAVORO[ordine.stato]}
                  </Badge>
                </div>

                {ordine.stato === ORDINI_LAVORO_STATI.BOZZA && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => caricaOrdineInForm(ordine)}
                    >
                      {ORDINI_LAVORO_TESTI.MODIFICA}
                    </Button>
                    <Link href={`${APP_ROUTES.BACKOFFICE_ORDINI_LAVORO}/${ordine.id}/firma`}>
                      <Button size="sm">{ORDINI_LAVORO_TESTI.VAI_ALLA_FIRMA}</Button>
                    </Link>
                  </div>
                )}

                {ordine.stato !== ORDINI_LAVORO_STATI.BOZZA && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ordine.stato === ORDINI_LAVORO_STATI.FIRMATO && (
                      <Button
                        size="sm"
                        icon={<Send className="h-4 w-4" />}
                        loading={inCorso}
                        onClick={() => void handleInvia(ordine)}
                      >
                        {ORDINI_LAVORO_TESTI.INVIA_ORA}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Download className="h-4 w-4" />}
                      disabled={inCorso}
                      onClick={() => void handleDownload(ordine)}
                    >
                      {ORDINI_LAVORO_TESTI.DOWNLOAD_PDF}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Share2 className="h-4 w-4" />}
                      disabled={inCorso}
                      onClick={() => void handleCondividiWhatsapp(ordine)}
                    >
                      {ORDINI_LAVORO_TESTI.CONDIVIDI_WHATSAPP}
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
