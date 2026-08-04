"use client";

import Link from "next/link";
import Image from "next/image";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Home, PenLine, Plus, Search, Send, Trash2 } from "lucide-react";

import { FileInputPicker } from "@/components/backoffice/FileInputPicker";
import { comprimiFoto } from "@/lib/compressioneFoto";
import { supabase } from "@/lib/supabase";
import { API_HEADERS } from "@/constants/api";
import { isRecord } from "@/lib/typeGuards";
import { getMessaggioErrore } from "@/lib/errors";
import {
  LABEL_REGOLE_FATTURAZIONE_INTERVENTO,
  LABEL_STATI_RAPPORTO_INTERVENTO,
  RAPPORTI_INTERVENTO_LIMITI,
  RAPPORTI_INTERVENTO_PDF,
  RAPPORTI_INTERVENTO_STATI,
  RAPPORTI_INTERVENTO_TESTI,
} from "@/constants/rapportiIntervento";
import { APP_ROUTES } from "@/constants/routes";

import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { creaCantiere } from "@/services/cantieri/creaCantiere";
import { loadClienti } from "@/services/clienti/loadClienti";
import { aggiornaCliente } from "@/services/clienti/aggiornaCliente";
import { SelectCliente } from "@/components/clienti/SelectCliente";
import type { Cliente } from "@/types/clienti";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { loadDipendenteByUserId } from "@/services/dipendenti/loadDipendenteByUserId";
import { loadDipendentiAttivi } from "@/services/dipendenti/loadDipendentiAttivi";
import { aggiornaRapportoIntervento } from "@/services/rapportiIntervento/aggiornaRapportoIntervento";
import { calcolaOreFatturabili } from "@/services/rapportiIntervento/calcolaOreFatturabili";
import { creaRapportoIntervento } from "@/services/rapportiIntervento/creaRapportoIntervento";
import { fetchRapportoInterventoPdf } from "@/services/rapportiIntervento/fetchRapportoInterventoPdf";
import { loadLavorazioniRapportoIntervento } from "@/services/rapportiIntervento/loadLavorazioniRapportoIntervento";
import { loadRapportiIntervento } from "@/services/rapportiIntervento/loadRapportiIntervento";
import { inviaRapportoIntervento } from "@/services/rapportiIntervento/inviaRapportoIntervento";
import { loadRapportoIntervento } from "@/services/rapportiIntervento/loadRapportoIntervento";
import { firmaRapportoIntervento } from "@/services/rapportiIntervento/firmaRapportoIntervento";
import { FirmaCanvas } from "@/components/rapportiIntervento/FirmaCanvas";
import {
  formatMinutiOre,
  formatMinutiOreInput,
  parseOreMinutiInput,
} from "@/services/rapportiIntervento/oreMinuti";

import type { CantiereBackoffice } from "@/types/cantieri";
import type { Dipendente } from "@/types/dipendenti";
import type {
  RapportoIntervento,
  RapportoInterventoFotoInput,
  RapportoInterventoInput,
  RapportoInterventoLavorazioneInput,
  RapportoInterventoExtraInput,
  RapportoInterventoMaterialeInput,
  RapportoInterventoOperatoreInput,
} from "@/types/rapportiIntervento";

import { AppHeader } from "@/components/ui/AppHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

import { SelectOperatore } from "./SelectOperatore";

// ─── Types ────────────────────────────────────────────────────────────────────

type LavorazioneForm = RapportoInterventoLavorazioneInput & {
  localId: string;
  ore_uomo_input: string;
};

type FotoForm = RapportoInterventoFotoInput & {
  localId: string;
  fileName: string;
};

type OperatoreForm = Omit<RapportoInterventoOperatoreInput, "ore_minuti"> & {
  localId: string;
  ricerca_operatore: string;
  ore_input: string;
  ore_minuti: number;
};

type ExtraForm = {
  localId: string;
  descrizione: string;
  ore_input: string;
  note: string;
  ordine: number;
};

type MaterialeForm = Omit<RapportoInterventoMaterialeInput, "quantita"> & {
  localId: string;
  quantita: string;
};

type RapportoForm = {
  cantiere_id: string;
  data_intervento: string;
  ora_arrivo: string;
  ora_partenza: string;
  cliente_committente: string;
  cliente_id: string | null;
  responsabile_nome: string;
  viaggio_minuti: string;
  diritto_uscita: boolean;
  note: string;
  firma_responsabile_data_url: string | null;
  firma_responsabile_nome: string;
  firma_cliente_data_url: string | null;
  firma_cliente_nome: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

function getOraAttuale() {
  const adesso = new Date();
  const ore = String(adesso.getHours()).padStart(2, "0");
  const minuti = String(adesso.getMinutes()).padStart(2, "0");
  return `${ore}:${minuti}`;
}

function parseOraHHMM(valore: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(valore.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

// Differenza partenza-arrivo arrotondata alla mezz'ora SUCCESSIVA
// (1:20 → 1:30, 1:37 → 2:00)
function calcolaOreLavorateMinuti(
  oraArrivo: string,
  oraPartenza: string
): number | null {
  const arrivo = parseOraHHMM(oraArrivo);
  const partenza = parseOraHHMM(oraPartenza);
  if (arrivo === null || partenza === null) return null;

  const diff = partenza - arrivo;
  if (diff <= 0) return null;

  return Math.ceil(diff / 30) * 30;
}

function getDataOdierna() {
  const oggi = new Date();
  const mese = String(oggi.getMonth() + 1).padStart(2, "0");
  const giorno = String(oggi.getDate()).padStart(2, "0");
  return `${oggi.getFullYear()}-${mese}-${giorno}`;
}

const FORM_INIZIALE: RapportoForm = {
  cantiere_id: "",
  data_intervento: "",
  ora_arrivo: "",
  ora_partenza: "",
  cliente_committente: "",
  cliente_id: null,
  responsabile_nome: "",
  viaggio_minuti: "0",
  diritto_uscita: false,
  note: "",
  firma_responsabile_data_url: null,
  firma_responsabile_nome: "",
  firma_cliente_data_url: null,
  firma_cliente_nome: "",
};

// ─── Helpers (preservati identici) ────────────────────────────────────────────

function getLocalId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random()}`;
}

function getNomeDipendente(dipendente: Dipendente) {
  return `${dipendente.nome} ${dipendente.cognome}`.trim();
}

function getLabelDipendente(dipendente: Dipendente) {
  return `${getNomeDipendente(dipendente)} - ${dipendente.email}`;
}

function formattaData(data: string) {
  if (!data) return "";
  return new Intl.DateTimeFormat(RAPPORTI_INTERVENTO_PDF.LOCALE).format(
    new Date(`${data}T00:00:00`)
  );
}

function getNumeroIntero(value: string): number | null {
  const numero = Number(value.trim());
  if (!Number.isInteger(numero) || numero < 0) return null;
  return numero;
}

function getNumeroDecimale(value: string): number | null {
  const numero = Number(value.trim().replace(",", "."));
  if (!Number.isFinite(numero) || numero < 0) return null;
  return numero;
}

function isFirmaValida(firmaDataUrl: string | null) {
  return (
    !firmaDataUrl ||
    firmaDataUrl.length <= RAPPORTI_INTERVENTO_LIMITI.FIRMA_MAX_DATA_URL_CARATTERI
  );
}

function isFotoValida(fotoDataUrl: string) {
  return (
    fotoDataUrl.startsWith("data:image/") &&
    fotoDataUrl.length <= RAPPORTI_INTERVENTO_LIMITI.FOTO_MAX_DATA_URL_CARATTERI
  );
}

function getStatoBadgeVariant(stato: RapportoIntervento["stato"]): BadgeProps["variant"] {
  if (stato === RAPPORTI_INTERVENTO_STATI.FIRMATO) return "success";
  if (stato === RAPPORTI_INTERVENTO_STATI.INVIATO) return "info";
  if (stato === RAPPORTI_INTERVENTO_STATI.ANNULLATO) return "error";
  return "warning";
}

function scaricaBlobPdf({
  blob,
  nomeFile,
}: {
  blob: Blob;
  nomeFile: string;
}) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizzaLavorazioni(
  lavorazioni: LavorazioneForm[]
): { lavorazioni: RapportoInterventoLavorazioneInput[] } | { errore: string } {
  if (lavorazioni.length === 0) {
    return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.LAVORAZIONE_OBBLIGATORIA };
  }

  const lavorazioniNormalizzate: RapportoInterventoLavorazioneInput[] = [];

  for (const [index, lavorazione] of lavorazioni.entries()) {
    const descrizione = lavorazione.descrizione_snapshot.trim().replace(/\s+/g, " ");

    if (!descrizione) {
      return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.DESCRIZIONE_OBBLIGATORIA };
    }

    // Le ore per lavorazione non si compilano più: resta solo
    // l'elenco dei lavori svolti (eventuale valore legacy preservato)
    const oreUomoMinuti =
      parseOreMinutiInput(lavorazione.ore_uomo_input) ?? 0;

    lavorazioniNormalizzate.push({
      lavorazione_id: lavorazione.lavorazione_id,
      descrizione_snapshot: descrizione,
      ore_uomo_minuti: oreUomoMinuti,
      ordine: index + 1,
    });
  }

  return { lavorazioni: lavorazioniNormalizzate };
}

function normalizzaFoto(
  foto: FotoForm[]
): { foto: RapportoInterventoFotoInput[] } | { errore: string } {
  const fotoNormalizzate: RapportoInterventoFotoInput[] = [];

  for (const [index, immagine] of foto.entries()) {
    if (!isFotoValida(immagine.immagine_data_url)) {
      return {
        errore:
          immagine.immagine_data_url.length >
          RAPPORTI_INTERVENTO_LIMITI.FOTO_MAX_DATA_URL_CARATTERI
            ? RAPPORTI_INTERVENTO_TESTI.ERRORI.FOTO_TROPPO_GRANDE
            : RAPPORTI_INTERVENTO_TESTI.ERRORI.FOTO_NON_VALIDA,
      };
    }

    fotoNormalizzate.push({
      immagine_data_url: immagine.immagine_data_url,
      descrizione: immagine.descrizione.trim(),
      ordine: index + 1,
    });
  }

  return { foto: fotoNormalizzate };
}

function normalizzaOperatori(
  operatori: OperatoreForm[]
): { operatori: RapportoInterventoOperatoreInput[] } | { errore: string } {
  if (operatori.length === 0) {
    return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.OPERATORE_OBBLIGATORIO };
  }

  const dipendentiIds = new Set<string>();
  const operatoriNormalizzati: RapportoInterventoOperatoreInput[] = [];

  for (const [index, operatore] of operatori.entries()) {
    if (!operatore.dipendente_id || !operatore.nome_snapshot.trim()) {
      return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.OPERATORE_NON_VALIDO };
    }

    if (dipendentiIds.has(operatore.dipendente_id)) {
      return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.OPERATORE_DUPLICATO };
    }

    dipendentiIds.add(operatore.dipendente_id);

    if (!operatore.ore_input.trim()) {
      return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.ORE_OPERATORE_NON_VALIDE };
    }

    const oreMinuti = parseOreMinutiInput(operatore.ore_input);

    if (oreMinuti === null) {
      return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.FORMATO_ORE_NON_VALIDO };
    }

    operatoriNormalizzati.push({
      dipendente_id: operatore.dipendente_id,
      nome_snapshot: operatore.nome_snapshot.trim().replace(/\s+/g, " "),
      email_snapshot: operatore.email_snapshot,
      ore_minuti: oreMinuti,
      ordine: index + 1,
    });
  }

  return { operatori: operatoriNormalizzati };
}

function normalizzaMateriali(
  materiali: MaterialeForm[]
): { materiali: RapportoInterventoMaterialeInput[] } | { errore: string } {
  const materialiNormalizzati: RapportoInterventoMaterialeInput[] = [];

  for (const [index, materiale] of materiali.entries()) {
    const descrizione = materiale.descrizione.trim().replace(/\s+/g, " ");

    if (!descrizione) {
      return {
        errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.MATERIALE_DESCRIZIONE_OBBLIGATORIA,
      };
    }

    const quantita = getNumeroDecimale(materiale.quantita);

    if (quantita === null) {
      return {
        errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.MATERIALE_QUANTITA_NON_VALIDA,
      };
    }

    const unitaMisura = materiale.unita_misura.trim().replace(/\s+/g, " ");

    if (!unitaMisura) {
      return {
        errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.MATERIALE_UNITA_OBBLIGATORIA,
      };
    }

    materialiNormalizzati.push({
      descrizione,
      quantita,
      unita_misura: unitaMisura,
      ordine: index + 1,
    });
  }

  return { materiali: materialiNormalizzati };
}

function normalizzaExtra(
  extra: ExtraForm[]
): { extra: RapportoInterventoExtraInput[] } | { errore: string } {
  const extraNormalizzati: RapportoInterventoExtraInput[] = [];

  for (const [index, lavoroExtra] of extra.entries()) {
    const descrizione = lavoroExtra.descrizione.trim().replace(/\s+/g, " ");

    if (!descrizione) {
      return {
        errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.EXTRA_DESCRIZIONE_OBBLIGATORIA,
      };
    }

    const oreMinuti = parseOreMinutiInput(lavoroExtra.ore_input) ?? 0;

    extraNormalizzati.push({
      descrizione,
      ore_minuti: oreMinuti,
      note: lavoroExtra.note.trim(),
      ordine: index + 1,
    });
  }

  return { extra: extraNormalizzati };
}

function preparaPayload({
  form,
  lavorazioni,
  operatori,
  foto,
  materiali,
  extra,
}: {
  form: RapportoForm;
  lavorazioni: LavorazioneForm[];
  operatori: OperatoreForm[];
  foto: FotoForm[];
  materiali: MaterialeForm[];
  extra: ExtraForm[];
}): { payload: RapportoInterventoInput } | { errore: string } {
  if (!form.cantiere_id) {
    return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.CANTIERE_OBBLIGATORIO };
  }

  if (!form.data_intervento) {
    return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.DATA_OBBLIGATORIA };
  }

  const cliente = form.cliente_committente.trim();
  if (!cliente) {
    return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.CLIENTE_OBBLIGATORIO };
  }

  const responsabile = form.responsabile_nome.trim();
  if (!responsabile) {
    return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.RESPONSABILE_OBBLIGATORIO };
  }

  const viaggioMinuti = getNumeroIntero(form.viaggio_minuti);
  if (viaggioMinuti === null) {
    return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.VIAGGIO_NON_VALIDO };
  }

  if (!isFirmaValida(form.firma_responsabile_data_url) || !isFirmaValida(form.firma_cliente_data_url)) {
    return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.FIRMA_TROPPO_GRANDE };
  }

  const lavorazioniNormalizzate = normalizzaLavorazioni(lavorazioni);
  if ("errore" in lavorazioniNormalizzate) return lavorazioniNormalizzate;

  const operatoriNormalizzati = normalizzaOperatori(operatori);
  if ("errore" in operatoriNormalizzati) return operatoriNormalizzati;

  const fotoNormalizzate = normalizzaFoto(foto);
  if ("errore" in fotoNormalizzate) return fotoNormalizzate;

  const materialiNormalizzati = normalizzaMateriali(materiali);
  if ("errore" in materialiNormalizzati) return materialiNormalizzati;

  const extraNormalizzati = normalizzaExtra(extra);
  if ("errore" in extraNormalizzati) return extraNormalizzati;

  return {
    payload: {
      cantiere_id: form.cantiere_id,
      data_intervento: form.data_intervento,
      ora_arrivo: form.ora_arrivo || null,
      ora_partenza: form.ora_partenza || null,
      cliente_committente: cliente,
      cliente_id: form.cliente_id,
      responsabile_nome: responsabile,
      viaggio_minuti: viaggioMinuti,
      diritto_uscita: form.diritto_uscita,
      note: form.note.trim(),
      firma_responsabile_data_url: form.firma_responsabile_data_url,
      firma_responsabile_nome: form.firma_responsabile_data_url
        ? form.firma_responsabile_nome.trim() || responsabile
        : null,
      firma_cliente_data_url: form.firma_cliente_data_url,
      firma_cliente_nome: form.firma_cliente_data_url
        ? form.firma_cliente_nome.trim() || cliente
        : null,
      lavorazioni: lavorazioniNormalizzate.lavorazioni,
      operatori: operatoriNormalizzati.operatori,
      foto: fotoNormalizzate.foto,
      materiali: materialiNormalizzati.materiali,
      extra: extraNormalizzati.extra,
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BackofficeRapportiInterventoPage() {
  const toast = useToast();

  const [cantieri, setCantieri] = useState<CantiereBackoffice[]>([]);
  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
  const [rapporti, setRapporti] = useState<RapportoIntervento[]>([]);
  const [form, setForm] = useState<RapportoForm>(() => ({
    ...FORM_INIZIALE,
    data_intervento: getDataOdierna(),
    ora_partenza: getOraAttuale(),
  }));
  // Nome di chi compila: proposto come responsabile lavori
  const [nomeCompilatore, setNomeCompilatore] = useState("");
  const [emailCompilatore, setEmailCompilatore] = useState("");
  const [lavorazioni, setLavorazioni] = useState<LavorazioneForm[]>([]);
  const [operatori, setOperatori] = useState<OperatoreForm[]>([]);
  const [foto, setFoto] = useState<FotoForm[]>([]);
  const [materiali, setMateriali] = useState<MaterialeForm[]>([]);
  const [lavoriExtra, setLavoriExtra] = useState<ExtraForm[]>([]);
  const [rapportoInModificaId, setRapportoInModificaId] = useState<string | null>(null);
  const [readonly, setReadonly] = useState(false);
  // Wizard a step (1..6). In sola lettura (readonly) si mostra tutto su una pagina.
  const [stepCorrente, setStepCorrente] = useState(1);
  // Firma a schermo intero su mobile (una alla volta): quale firma è aperta
  const [firmaFullscreen, setFirmaFullscreen] = useState<
    "responsabile" | "cliente" | null
  >(null);
  // Firma remota: link generato da mostrare (WhatsApp/copia)
  const [firmaRemotaLink, setFirmaRemotaLink] = useState<string | null>(null);
  const [invioRemotaLoading, setInvioRemotaLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [utenteAdmin, setUtenteAdmin] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [rapportoDaInviare, setRapportoDaInviare] = useState<RapportoIntervento | null>(null);
  // Invio automatico dopo la firma: id del rapporto appena firmato
  const [invioAutoId, setInvioAutoId] = useState<string | null>(null);
  // Cliente senza email: la si chiede al momento dell'invio
  const [rapportoSenzaEmail, setRapportoSenzaEmail] = useState<RapportoIntervento | null>(null);
  const [emailNuovoInvio, setEmailNuovoInvio] = useState("");
  const [salvataggioEmailInvio, setSalvataggioEmailInvio] = useState(false);
  const [mostraNuovoCantiere, setMostraNuovoCantiere] = useState(false);
  const [nomeNuovoCantiere, setNomeNuovoCantiere] = useState("");
  const [indirizzoNuovoCantiere, setIndirizzoNuovoCantiere] = useState("");
  const [creazioneCantiere, setCreazioneCantiere] = useState(false);
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [ricercaRapporti, setRicercaRapporti] = useState("");
  const [mostraListaRapporti, setMostraListaRapporti] = useState(false);

  const oreUomoRealiMinuti = useMemo(
    () =>
      operatori.reduce(
        (totale, operatore) => totale + (parseOreMinutiInput(operatore.ore_input) || 0),
        0
      ),
    [operatori]
  );

  const viaggioMinuti = getNumeroIntero(form.viaggio_minuti) || 0;
  const calcolo = calcolaOreFatturabili({ oreUomoRealiMinuti, viaggioMinuti });

  const rapportiFiltrati = useMemo(() => {
    const q = ricercaRapporti.trim().toLowerCase();
    const lista = !q
      ? rapporti
      : rapporti.filter(
        (r) =>
          r.cantiere_nome_snapshot.toLowerCase().includes(q) ||
          r.cliente_committente.toLowerCase().includes(q) ||
          formattaData(r.data_intervento).toLowerCase().includes(q)
      );

    return mostraListaRapporti ? lista : lista.slice(0, 3);
  }, [rapporti, ricercaRapporti, mostraListaRapporti]);

  const caricaDati = useCallback(
    async ({ attivo = true }: { attivo?: boolean } = {}) => {
      try {
        if (attivo) {
          setLoading(true);
        }

        const [cantieriData, dipendentiData, rapportiData, clientiData] =
          await Promise.all([
            loadCantieriBackoffice(),
            loadDipendentiAttivi(),
            loadRapportiIntervento(),
            loadClienti(),
          ]);

        if (!attivo) return;

        setCantieri(cantieriData);
        setDipendenti(dipendentiData);
        setRapporti(rapportiData);
        setClienti(clientiData);
      } catch (error: unknown) {
        if (attivo) {
          toast.error(getMessaggioErrore(error, RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO));
        }
      } finally {
        if (attivo) {
          setLoading(false);
        }
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    let attivo = true;

    const verificaRuolo = async () => {
      try {
        const user = await loadUtenteAuth();
        const adminCorrente = user?.email ? await isAdmin(user.email) : false;

        if (attivo) {
          setUtenteAdmin(adminCorrente);
        }

        if (user?.id) {
          if (attivo && user.email) setEmailCompilatore(user.email);
          const dipendenteCorrente = await loadDipendenteByUserId(user.id);
          if (attivo && dipendenteCorrente) {
            const nome =
              `${dipendenteCorrente.nome} ${dipendenteCorrente.cognome}`.trim();
            setNomeCompilatore(nome);
            // Precompila solo il form nuovo non ancora toccato
            setForm((f) =>
              f.responsabile_nome ? f : { ...f, responsabile_nome: nome }
            );
          }
        }
      } catch (error: unknown) {
        console.error("Errore verifica ruolo rapporti intervento", error);

        if (attivo) {
          setUtenteAdmin(false);
        }
      }
    };

    void verificaRuolo();

    return () => {
      attivo = false;
    };
  }, []);

  useEffect(() => {
    let attivo = true;

    const init = async () => {
      await caricaDati({ attivo });
    };

    void init();

    return () => {
      attivo = false;
    };
  }, [caricaDati]);

  const resetForm = ({ mantieniMessaggio = false }: { mantieniMessaggio?: boolean } = {}) => {
    setForm({
      ...FORM_INIZIALE,
      data_intervento: getDataOdierna(),
      ora_partenza: getOraAttuale(),
      responsabile_nome: nomeCompilatore,
    });
    aggiungiOperatoreCompilatore([]);
    setLavorazioni([]);
    setOperatori([]);
    setFoto([]);
    setMateriali([]);
    setLavoriExtra([]);
    setRapportoInModificaId(null);
    setReadonly(false);
    setStepCorrente(1);
    if (!mantieniMessaggio) {
      setMostraListaRapporti(false);
    }
  };

  const handleFormChange = <Field extends keyof RapportoForm>(
    field: Field,
    value: RapportoForm[Field]
  ) => {
    setForm((formCorrente) => ({
      ...formCorrente,
      [field]: value,
    }));
  };

  const handleLavorazioneChange = ({
    localId,
    field,
    value,
  }: {
    localId: string;
    field: "descrizione_snapshot" | "ore_uomo_input";
    value: string;
  }) => {
    setLavorazioni((lavorazioniCorrenti) =>
      lavorazioniCorrenti.map((lavorazione) => {
        if (lavorazione.localId !== localId) return lavorazione;

        const minuti = field === "ore_uomo_input" ? parseOreMinutiInput(value) : null;

        return {
          ...lavorazione,
          [field]: value,
          ore_uomo_minuti: field === "ore_uomo_input" ? minuti || 0 : lavorazione.ore_uomo_minuti,
        };
      })
    );
  };

  const aggiungiLavorazione = () => {
    setLavorazioni((lavorazioniCorrenti) => [
      ...lavorazioniCorrenti,
      {
        localId: getLocalId(),
        lavorazione_id: null,
        descrizione_snapshot: "",
        ore_uomo_minuti: 0,
        ore_uomo_input: "",
        ordine: lavorazioniCorrenti.length + 1,
      },
    ]);
  };

  const rimuoviLavorazione = (localId: string) => {
    setLavorazioni((lavorazioniCorrenti) =>
      lavorazioniCorrenti.filter((lavorazione) => lavorazione.localId !== localId)
    );
  };

  // Ore lavorate proposte dalla differenza arrivo/partenza
  const oreLavorateProposte = useMemo(() => {
    const minuti = calcolaOreLavorateMinuti(form.ora_arrivo, form.ora_partenza);
    return minuti === null ? "" : formatMinutiOreInput(minuti);
  }, [form.ora_arrivo, form.ora_partenza]);

  // Propaga le ore calcolate a tutti gli operatori (solo in bozza)
  useEffect(() => {
    if (readonly || !oreLavorateProposte) return;
    setOperatori((correnti) =>
      correnti.map((op) =>
        op.ore_input === oreLavorateProposte
          ? op
          : { ...op, ore_input: oreLavorateProposte }
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oreLavorateProposte, readonly]);

  // Riga operatore precompilata con chi sta compilando
  const aggiungiOperatoreCompilatore = (
    operatoriCorrenti: OperatoreForm[]
  ) => {
    const compilatore = dipendenti.find(
      (d) => d.email?.toLowerCase() === emailCompilatore.toLowerCase()
    );
    if (!compilatore) {
      setOperatori(operatoriCorrenti);
      return;
    }

    setOperatori([
      ...operatoriCorrenti,
      {
        localId: getLocalId(),
        dipendente_id: compilatore.id,
        nome_snapshot: `${compilatore.nome} ${compilatore.cognome}`.trim(),
        email_snapshot: compilatore.email,
        ricerca_operatore:
          `${compilatore.nome} ${compilatore.cognome}`.trim(),
        ore_input: oreLavorateProposte,
        ore_minuti: 0,
        ordine: operatoriCorrenti.length + 1,
      },
    ]);
  };

  // Al primo caricamento (form nuovo vuoto) proponi il compilatore
  const compilatoreProposto = useRef(false);
  useEffect(() => {
    if (
      compilatoreProposto.current ||
      !emailCompilatore ||
      dipendenti.length === 0 ||
      rapportoInModificaId ||
      operatori.length > 0
    ) {
      return;
    }
    compilatoreProposto.current = true;
    aggiungiOperatoreCompilatore([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dipendenti, emailCompilatore, rapportoInModificaId, operatori.length]);

  const aggiungiOperatore = useCallback(() => {
    setOperatori((operatoriCorrenti) => [
      ...operatoriCorrenti,
      {
        localId: getLocalId(),
        dipendente_id: null,
        nome_snapshot: "",
        email_snapshot: null,
        ricerca_operatore: "",
        ore_input: oreLavorateProposte,
        ore_minuti: 0,
        ordine: operatoriCorrenti.length + 1,
      },
    ]);
  }, [oreLavorateProposte]);

  const handleOperatoreSearchChange = useCallback(({
    localId,
    ricerca,
  }: {
    localId: string;
    ricerca: string;
  }) => {
    setOperatori((operatoriCorrenti) =>
      operatoriCorrenti.map((operatore) => {
        if (operatore.localId !== localId) return operatore;

        if (operatore.ricerca_operatore === ricerca) return operatore;

        return {
          ...operatore,
          ricerca_operatore: ricerca,
          dipendente_id: null,
          nome_snapshot: "",
          email_snapshot: null,
        };
      })
    );
  }, []);

  const handleOperatoreSelect = useCallback(({
    localId,
    dipendente,
  }: {
    localId: string;
    dipendente: Dipendente;
  }) => {
    const ricerca = getLabelDipendente(dipendente);

    setOperatori((operatoriCorrenti) =>
      operatoriCorrenti.map((operatore) => {
        if (operatore.localId !== localId) return operatore;

        if (
          operatore.dipendente_id === dipendente.id &&
          operatore.ricerca_operatore === ricerca &&
          operatore.nome_snapshot === getNomeDipendente(dipendente) &&
          operatore.email_snapshot === dipendente.email
        ) {
          return operatore;
        }

        return {
          ...operatore,
          dipendente_id: dipendente.id,
          nome_snapshot: getNomeDipendente(dipendente),
          email_snapshot: dipendente.email,
          ricerca_operatore: ricerca,
        };
      })
    );
  }, []);

  const handleOperatoreBlur = useCallback(({ localId }: { localId: string }) => {
    setOperatori((operatoriCorrenti) =>
      operatoriCorrenti.map((operatore) => {
        if (operatore.localId !== localId) return operatore;

        if (operatore.dipendente_id) {
          return {
            ...operatore,
            ricerca_operatore:
              operatore.nome_snapshot && operatore.email_snapshot
                ? `${operatore.nome_snapshot} - ${operatore.email_snapshot}`
                : operatore.nome_snapshot,
          };
        }

        if (operatore.ricerca_operatore === "") return operatore;

        return {
          ...operatore,
          ricerca_operatore: "",
        };
      })
    );
  }, []);

  const handleOreOperatoreChange = useCallback(({
    localId,
    value,
  }: {
    localId: string;
    value: string;
  }) => {
    setOperatori((operatoriCorrenti) =>
      operatoriCorrenti.map((operatore) => {
        if (operatore.localId !== localId) return operatore;

        const minuti = parseOreMinutiInput(value);

        return {
          ...operatore,
          ore_input: value,
          ore_minuti: minuti || 0,
        };
      })
    );
  }, []);

  const rimuoviOperatore = useCallback((localId: string) => {
    setOperatori((operatoriCorrenti) =>
      operatoriCorrenti.filter((operatore) => operatore.localId !== localId)
    );
  }, []);

  const leggiFileComeDataUrl = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(
          new Error(RAPPORTI_INTERVENTO_TESTI.ERRORI.FOTO_NON_VALIDA)
        );
      };

      reader.onerror = () => {
        reject(
          new Error(RAPPORTI_INTERVENTO_TESTI.ERRORI.FOTO_NON_VALIDA)
        );
      };

      reader.readAsDataURL(file);
    });

  const handleFotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    try {
      const fotoDataUrl = await Promise.all(
        files.map(async (file) => {
          if (!file.type.startsWith("image/")) {
            throw new Error(RAPPORTI_INTERVENTO_TESTI.ERRORI.FOTO_NON_VALIDA);
          }

          // Comprime (resize + JPEG) prima di allegare: PDF molto più leggero
          const compressa = await comprimiFoto(file);
          return leggiFileComeDataUrl(compressa);
        })
      );

      const nuoveFoto = fotoDataUrl.map((immagineDataUrl, index) => ({
        localId: getLocalId(),
        immagine_data_url: immagineDataUrl,
        descrizione: "",
        ordine: foto.length + index + 1,
        fileName: files[index]?.name || "",
      }));

      setFoto((fotoCorrenti) => [...fotoCorrenti, ...nuoveFoto]);
      event.target.value = "";
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO));
    }
  };

  const handleDescrizioneFotoChange = ({
    localId,
    descrizione,
  }: {
    localId: string;
    descrizione: string;
  }) => {
    setFoto((fotoCorrenti) =>
      fotoCorrenti.map((immagine) =>
        immagine.localId === localId ? { ...immagine, descrizione } : immagine
      )
    );
  };

  const rimuoviFoto = (localId: string) => {
    setFoto((fotoCorrenti) =>
      fotoCorrenti.filter((immagine) => immagine.localId !== localId)
    );
  };

  const aggiungiMateriale = () => {
    setMateriali((materialiCorrenti) => [
      ...materialiCorrenti,
      {
        localId: getLocalId(),
        descrizione: "",
        quantita: "1",
        unita_misura: "",
        ordine: materialiCorrenti.length + 1,
      },
    ]);
  };

  const handleMaterialeChange = ({
    localId,
    field,
    value,
  }: {
    localId: string;
    field: "descrizione" | "quantita" | "unita_misura";
    value: string;
  }) => {
    setMateriali((materialiCorrenti) =>
      materialiCorrenti.map((materiale) =>
        materiale.localId === localId ? { ...materiale, [field]: value } : materiale
      )
    );
  };

  const rimuoviMateriale = (localId: string) => {
    setMateriali((materialiCorrenti) =>
      materialiCorrenti.filter((materiale) => materiale.localId !== localId)
    );
  };

  const aggiungiLavoroExtra = () => {
    setLavoriExtra((correnti) => [
      ...correnti,
      {
        localId: getLocalId(),
        descrizione: "",
        ore_input: "",
        note: "",
        ordine: correnti.length + 1,
      },
    ]);
  };

  const handleLavoroExtraChange = ({
    localId,
    field,
    value,
  }: {
    localId: string;
    field: "descrizione" | "ore_input" | "note";
    value: string;
  }) => {
    setLavoriExtra((correnti) =>
      correnti.map((lavoroExtra) =>
        lavoroExtra.localId === localId
          ? { ...lavoroExtra, [field]: value }
          : lavoroExtra
      )
    );
  };

  const rimuoviLavoroExtra = (localId: string) => {
    setLavoriExtra((correnti) =>
      correnti.filter((lavoroExtra) => lavoroExtra.localId !== localId)
    );
  };

  const caricaSnapshot = async () => {
    if (!form.cantiere_id) {
      toast.error(RAPPORTI_INTERVENTO_TESTI.ERRORI.CANTIERE_OBBLIGATORIO);
      return;
    }

    if (!form.data_intervento) {
      toast.error(RAPPORTI_INTERVENTO_TESTI.ERRORI.DATA_OBBLIGATORIA);
      return;
    }

    try {
      setLoadingSnapshot(true);

      const snapshot = await loadLavorazioniRapportoIntervento({
        cantiereId: form.cantiere_id,
        dataIntervento: form.data_intervento,
      });

      setLavorazioni(
        snapshot.map((lavorazione) => ({
          ...lavorazione,
          localId: getLocalId(),
          ore_uomo_input: formatMinutiOreInput(lavorazione.ore_uomo_minuti),
        }))
      );
      toast.success(RAPPORTI_INTERVENTO_TESTI.MESSAGGI.SNAPSHOT_CARICATO);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO));
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const caricaRapportoInForm = async (rapporto: RapportoIntervento) => {
    try {
      const rapportoCompleto = await loadRapportoIntervento(rapporto.id);

      if (!rapportoCompleto) {
        throw new Error(RAPPORTI_INTERVENTO_TESTI.ERRORI.RAPPORTO_NON_TROVATO);
      }

      setRapportoInModificaId(rapportoCompleto.id);
      setReadonly(
        rapportoCompleto.stato === RAPPORTI_INTERVENTO_STATI.FIRMATO ||
          rapportoCompleto.stato === RAPPORTI_INTERVENTO_STATI.INVIATO
      );
      setForm({
        cantiere_id: rapportoCompleto.cantiere_id,
        data_intervento: rapportoCompleto.data_intervento,
        ora_arrivo: (rapportoCompleto.ora_arrivo || "").slice(0, 5),
        ora_partenza: (rapportoCompleto.ora_partenza || "").slice(0, 5),
        cliente_committente: rapportoCompleto.cliente_committente,
        cliente_id: rapportoCompleto.cliente_id ?? null,
        responsabile_nome: rapportoCompleto.responsabile_nome,
        viaggio_minuti: String(rapportoCompleto.viaggio_minuti),
        diritto_uscita: rapportoCompleto.diritto_uscita,
        note: rapportoCompleto.note,
        firma_responsabile_data_url: rapportoCompleto.firma_responsabile_data_url,
        firma_responsabile_nome: rapportoCompleto.firma_responsabile_nome || "",
        firma_cliente_data_url: rapportoCompleto.firma_cliente_data_url,
        firma_cliente_nome: rapportoCompleto.firma_cliente_nome || "",
      });
      setLavorazioni(
        rapportoCompleto.lavorazioni.map((lavorazione) => ({
          localId: getLocalId(),
          lavorazione_id: lavorazione.lavorazione_id,
          descrizione_snapshot: lavorazione.descrizione_snapshot,
          ore_uomo_minuti: lavorazione.ore_uomo_minuti,
          ore_uomo_input: formatMinutiOreInput(lavorazione.ore_uomo_minuti),
          ordine: lavorazione.ordine,
        }))
      );
      setOperatori(
        rapportoCompleto.operatori.map((operatore) => ({
          localId: getLocalId(),
          dipendente_id: operatore.dipendente_id,
          nome_snapshot: operatore.nome_snapshot,
          email_snapshot: operatore.email_snapshot,
          ricerca_operatore: operatore.email_snapshot
            ? `${operatore.nome_snapshot} - ${operatore.email_snapshot}`
            : operatore.nome_snapshot,
          ore_minuti: operatore.ore_minuti,
          ore_input: formatMinutiOreInput(operatore.ore_minuti),
          ordine: operatore.ordine,
        }))
      );
      setFoto(
        rapportoCompleto.foto.map((immagine) => ({
          localId: getLocalId(),
          immagine_data_url: immagine.immagine_data_url,
          descrizione: immagine.descrizione,
          ordine: immagine.ordine,
          fileName: "",
        }))
      );
      setMateriali(
        rapportoCompleto.materiali.map((materiale) => ({
          localId: getLocalId(),
          descrizione: materiale.descrizione,
          quantita: String(materiale.quantita),
          unita_misura: materiale.unita_misura,
          ordine: materiale.ordine,
        }))
      );
      setLavoriExtra(
        rapportoCompleto.extra.map((lavoroExtra) => ({
          localId: getLocalId(),
          descrizione: lavoroExtra.descrizione,
          ore_input: lavoroExtra.ore_minuti
            ? formatMinutiOreInput(lavoroExtra.ore_minuti)
            : "",
          note: lavoroExtra.note,
          ordine: lavoroExtra.ordine,
        }))
      );
      setMostraListaRapporti(false);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (readonly) return;

    const preparazione = preparaPayload({
      form,
      lavorazioni,
      operatori,
      foto,
      materiali,
      extra: lavoriExtra,
    });

    if ("errore" in preparazione) {
      toast.error(preparazione.errore);
      return;
    }

    try {
      setSalvataggio(true);

      if (rapportoInModificaId) {
        await aggiornaRapportoIntervento({
          rapportoInterventoId: rapportoInModificaId,
          rapporto: preparazione.payload,
        });
        toast.success(RAPPORTI_INTERVENTO_TESTI.MESSAGGI.AGGIORNATO);
      } else {
        const nuovo = await creaRapportoIntervento(preparazione.payload);
        toast.success(RAPPORTI_INTERVENTO_TESTI.MESSAGGI.CREATO);
        // Resta sul rapporto appena creato: così il tasto "Firma
        // rapporto" è subito visibile
        await caricaDati();
        await caricaRapportoInForm(nuovo);
        return;
      }

      await caricaDati();
      resetForm({ mantieniMessaggio: true });
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleFirmaWizard = async () => {
    if (!form.firma_responsabile_data_url || !form.firma_cliente_data_url) {
      toast.error(RAPPORTI_INTERVENTO_TESTI.ERRORI.FIRME_OBBLIGATORIE);
      return;
    }

    // Stessa validazione del salvataggio (cliente, responsabile, ecc.)
    const preparazione = preparaPayload({
      form,
      lavorazioni,
      operatori,
      foto,
      materiali,
      extra: lavoriExtra,
    });
    if ("errore" in preparazione) {
      toast.error(preparazione.errore);
      return;
    }

    try {
      setSalvataggio(true);

      // Salva la bozza SENZA firme: con le firme nel payload il rapporto
      // diventerebbe FIRMATO e il lock DB bloccherebbe l'inserimento delle
      // lavorazioni. Le firme le applica firmaRapportoIntervento subito dopo.
      const payloadBozza = {
        ...preparazione.payload,
        firma_responsabile_data_url: null,
        firma_responsabile_nome: null,
        firma_cliente_data_url: null,
        firma_cliente_nome: null,
      };

      let id = rapportoInModificaId;
      if (id) {
        await aggiornaRapportoIntervento({
          rapportoInterventoId: id,
          rapporto: payloadBozza,
        });
      } else {
        const nuovo = await creaRapportoIntervento(payloadBozza);
        id = nuovo.id;
        setRapportoInModificaId(id);
      }

      await firmaRapportoIntervento({
        rapportoId: id,
        firmaResponsabileDataUrl: form.firma_responsabile_data_url,
        firmaResponsabileNome:
          form.firma_responsabile_nome.trim() || form.responsabile_nome.trim(),
        firmaClienteDataUrl: form.firma_cliente_data_url,
        firmaClienteNome:
          form.firma_cliente_nome.trim() || form.cliente_committente.trim(),
      });
      toast.success(RAPPORTI_INTERVENTO_TESTI.MESSAGGI.FIRMATO);
      await caricaDati();
      await caricaRapportoInForm({ id } as RapportoIntervento);
      // Invio automatico al cliente subito dopo la firma (solo se il
      // committente è un cliente in anagrafica). Parte quando i dati sono
      // ricaricati (vedi effetto su invioAutoId).
      if (form.cliente_id) {
        setInvioAutoId(id);
      }
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleInviaFirmaRemota = async () => {
    if (!form.firma_responsabile_data_url) {
      toast.error("Firma prima come responsabile, poi invia per la firma del cliente");
      return;
    }

    const preparazione = preparaPayload({
      form,
      lavorazioni,
      operatori,
      foto,
      materiali,
      extra: lavoriExtra,
    });
    if ("errore" in preparazione) {
      toast.error(preparazione.errore);
      return;
    }

    try {
      setInvioRemotaLoading(true);

      // Salva la bozza con la sola firma responsabile (resta BOZZA)
      const payloadRemota = {
        ...preparazione.payload,
        firma_cliente_data_url: null,
        firma_cliente_nome: null,
      };

      let id = rapportoInModificaId;
      if (id) {
        await aggiornaRapportoIntervento({
          rapportoInterventoId: id,
          rapporto: payloadRemota,
        });
      } else {
        const nuovo = await creaRapportoIntervento(payloadRemota);
        id = nuovo.id;
        setRapportoInModificaId(id);
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error(RAPPORTI_INTERVENTO_TESTI.ERRORI.SESSIONE_MANCANTE);

      const response = await fetch("/api/firma-remota/crea", {
        method: "POST",
        headers: {
          [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${accessToken}`,
        },
        body: JSON.stringify({ rapportoInterventoId: id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          isRecord(payload) && typeof payload.errore === "string"
            ? payload.errore
            : RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO
        );
      }

      await caricaDati();
      setFirmaRemotaLink(isRecord(payload) && typeof payload.link === "string" ? payload.link : null);
      toast.success(
        isRecord(payload) && payload.emailInviata
          ? "Link creato e inviato via email al cliente"
          : "Link di firma creato"
      );
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO));
    } finally {
      setInvioRemotaLoading(false);
    }
  };

  const handleCreaCantiereProposto = async () => {
    const nome = nomeNuovoCantiere.trim();
    if (!nome) {
      toast.error(RAPPORTI_INTERVENTO_TESTI.ERRORI.NOME_CANTIERE_OBBLIGATORIO);
      return;
    }

    try {
      setCreazioneCantiere(true);
      const nuovo = await creaCantiere({
        nome,
        indirizzo: indirizzoNuovoCantiere.trim(),
        lavorazioni: "",
        attivo: true,
        cliente_id: null,
        da_verificare: true,
      });

      setCantieri((correnti) =>
        [...correnti, nuovo].sort((a, b) => a.nome.localeCompare(b.nome))
      );
      handleFormChange("cantiere_id", nuovo.id);
      setMostraNuovoCantiere(false);
      setNomeNuovoCantiere("");
      setIndirizzoNuovoCantiere("");
      toast.success(RAPPORTI_INTERVENTO_TESTI.MESSAGGI.CANTIERE_PROPOSTO);
    } catch (error: unknown) {
      toast.error(
        getMessaggioErrore(error, RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO)
      );
    } finally {
      setCreazioneCantiere(false);
    }
  };

  // Arrivo dalla pagina firma con ?invia=<id>: proponi subito l'invio
  const inviaDaQueryGestitoRef = useRef(false);
  useEffect(() => {
    if (inviaDaQueryGestitoRef.current || loading || rapporti.length === 0) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const inviaId = params.get("invia");
    if (!inviaId) {
      inviaDaQueryGestitoRef.current = true;
      return;
    }

    inviaDaQueryGestitoRef.current = true;
    window.history.replaceState(
      null,
      "",
      window.location.pathname
    );

    const rapporto = rapporti.find((r) => r.id === inviaId);
    if (rapporto && rapporto.stato === RAPPORTI_INTERVENTO_STATI.FIRMATO) {
      avviaInvio(rapporto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, rapporti]);

  const avviaInvio = (rapporto: RapportoIntervento) => {
    if (!rapporto.cliente_id) {
      toast.error(RAPPORTI_INTERVENTO_TESTI.ERRORI.INVIO_SENZA_CLIENTE);
      return;
    }

    const cliente = clienti.find((c) => c.id === rapporto.cliente_id);
    if (cliente && !cliente.email) {
      setEmailNuovoInvio("");
      setRapportoSenzaEmail(rapporto);
      return;
    }

    setRapportoDaInviare(rapporto);
  };

  // Invio automatico dopo la firma: appena la lista è ricaricata col
  // rapporto FIRMATO, avvia l'invio al cliente (conferma + eventuale email).
  useEffect(() => {
    if (!invioAutoId) return;
    const rapporto = rapporti.find((r) => r.id === invioAutoId);
    if (rapporto && rapporto.stato === RAPPORTI_INTERVENTO_STATI.FIRMATO) {
      setInvioAutoId(null);
      avviaInvio(rapporto);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invioAutoId, rapporti]);

  const salvaEmailEProsegui = async () => {
    if (!rapportoSenzaEmail?.cliente_id) return;
    const email = emailNuovoInvio.trim();
    if (!email || !email.includes("@")) {
      toast.error(RAPPORTI_INTERVENTO_TESTI.ERRORI.EMAIL_NON_VALIDA);
      return;
    }

    try {
      setSalvataggioEmailInvio(true);
      // Popola l'anagrafica (provvisoria: il flag da_verificare resta
      // com'è, l'admin conferma dopo)
      const aggiornato = await aggiornaCliente({
        clienteId: rapportoSenzaEmail.cliente_id,
        cliente: { email },
      });
      setClienti((correnti) =>
        correnti.map((c) => (c.id === aggiornato.id ? aggiornato : c))
      );

      const rapporto = rapportoSenzaEmail;
      setRapportoSenzaEmail(null);
      setEmailNuovoInvio("");
      setRapportoDaInviare(rapporto);
    } catch (error: unknown) {
      const messaggio = getMessaggioErrore(
        error,
        RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO
      );
      toast.error(
        messaggio.includes("clienti_email_unica")
          ? RAPPORTI_INTERVENTO_TESTI.ERRORI.EMAIL_GIA_USATA
          : messaggio
      );
    } finally {
      setSalvataggioEmailInvio(false);
    }
  };

  const eseguiInvioRapporto = async () => {
    if (!rapportoDaInviare) return;
    const rapporto = rapportoDaInviare;
    setRapportoDaInviare(null);

    try {
      setInvioInCorso(true);
      const esito = await inviaRapportoIntervento({
        rapportoInterventoId: rapporto.id,
      });
      setRapporti((correnti) =>
        correnti.map((r) =>
          r.id === rapporto.id
            ? { ...r, stato: RAPPORTI_INTERVENTO_STATI.INVIATO }
            : r
        )
      );
      if (rapportoInModificaId === rapporto.id) {
        setReadonly(true);
      }
      toast.success(
        `${RAPPORTI_INTERVENTO_TESTI.MESSAGGI.INVIATO} ${esito.destinatario}`
      );
    } catch (error: unknown) {
      toast.error(
        getMessaggioErrore(error, RAPPORTI_INTERVENTO_TESTI.ERRORI.INVIO_FALLITO)
      );
    } finally {
      setInvioInCorso(false);
    }
  };

  const handlePdf = async (rapportoInterventoId: string) => {
    try {
      setPdfId(rapportoInterventoId);

      const pdf = await fetchRapportoInterventoPdf(rapportoInterventoId);

      scaricaBlobPdf(pdf);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO));
    } finally {
      setPdfId(null);
    }
  };

  // ── Wizard ─────────────────────────────────────────────────────────────────
  const STEP_WIZARD = [
    "Dati generali",
    "Operatori",
    "Lavorazioni",
    "Materiali ed extra",
    "Foto",
    "Riepilogo e firma",
  ];
  const TOTALE_STEP = STEP_WIZARD.length;

  // In modifica/sola lettura mostra tutto; in compilazione mostra solo lo step.
  const stepCls = (n: number) =>
    readonly || stepCorrente === n ? "" : "hidden";

  // Validazione dei dati richiesti per lo step indicato (riusa i normalizzatori
  // del salvataggio). Ritorna il messaggio d'errore o null se lo step è valido.
  const validaStep = (n: number): string | null => {
    if (n === 1) {
      if (!form.cliente_id && !form.cliente_committente.trim()) {
        return RAPPORTI_INTERVENTO_TESTI.ERRORI.CLIENTE_OBBLIGATORIO;
      }
      return null;
    }
    if (n === 2) {
      const r = normalizzaOperatori(operatori);
      return "errore" in r ? r.errore : null;
    }
    if (n === 3) {
      const r = normalizzaLavorazioni(lavorazioni);
      return "errore" in r ? r.errore : null;
    }
    if (n === 4) {
      const m = normalizzaMateriali(materiali);
      if ("errore" in m) return m.errore;
      const e = normalizzaExtra(lavoriExtra);
      return "errore" in e ? e.errore : null;
    }
    if (n === 5) {
      const r = normalizzaFoto(foto);
      return "errore" in r ? r.errore : null;
    }
    return null;
  };

  const vaiAvanti = () => {
    const errore = validaStep(stepCorrente);
    if (errore) {
      toast.error(errore);
      return;
    }
    setStepCorrente((s) => Math.min(TOTALE_STEP, s + 1));
  };

  const vaiIndietro = () => setStepCorrente((s) => Math.max(1, s - 1));

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            {utenteAdmin && (
              <Link href={APP_ROUTES.BACKOFFICE}>
                <Button variant="secondary" size="sm">
                  {RAPPORTI_INTERVENTO_TESTI.BACKOFFICE}
                </Button>
              </Link>
            )}
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">
                {RAPPORTI_INTERVENTO_TESTI.TIMBRATURE}
              </Button>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          {utenteAdmin && (
            <>
              <Link href={APP_ROUTES.BACKOFFICE} className="hover:text-text-primary transition-colors duration-150">
                {RAPPORTI_INTERVENTO_TESTI.BACKOFFICE}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="font-medium text-text-primary">{RAPPORTI_INTERVENTO_TESTI.TITOLO}</span>
        </nav>

        {/* Titolo + bottone Nuovo */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="font-heading text-2xl font-medium text-text-primary">
              {RAPPORTI_INTERVENTO_TESTI.TITOLO}
            </h1>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => resetForm()}
          >
            {RAPPORTI_INTERVENTO_TESTI.NUOVO}
          </Button>
        </div>

        {/* Grid responsive: form + lista (mobile: lista in alto, desktop: sidebar destra) */}
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          {/* ── Form principale ── */}
          <Card className="p-5">
            <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
              {rapportoInModificaId
                ? readonly
                  ? RAPPORTI_INTERVENTO_TESTI.VISUALIZZA
                  : RAPPORTI_INTERVENTO_TESTI.MODIFICA
                : RAPPORTI_INTERVENTO_TESTI.NUOVO}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Barra avanzamento wizard (solo in compilazione) */}
              {!readonly && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-text-primary">
                      {STEP_WIZARD[stepCorrente - 1]}
                    </span>
                    <span className="text-text-muted">
                      Passo {stepCorrente} di {TOTALE_STEP}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-subtle">
                    <div
                      className="h-full rounded-full bg-brand-500 transition-all duration-300"
                      style={{ width: `${(stepCorrente / TOTALE_STEP) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Anagrafica */}
              <section className={cn("space-y-4", stepCls(1))}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label={RAPPORTI_INTERVENTO_TESTI.CANTIERE}
                    value={form.cantiere_id}
                    onChange={(e) => {
                      const nextCantiereId = e.target.value;
                      handleFormChange("cantiere_id", nextCantiereId);

                      // Precompila il cliente dal cantiere (se il campo è vuoto)
                      const cantiere = cantieri.find((c) => c.id === nextCantiereId);
                      if (cantiere?.cliente_id && !form.cliente_committente.trim()) {
                        const cliente = clienti.find((c) => c.id === cantiere.cliente_id);
                        if (cliente) {
                          setForm((f) => ({
                            ...f,
                            cantiere_id: nextCantiereId,
                            cliente_id: cliente.id,
                            cliente_committente: cliente.ragione_sociale,
                          }));
                        }
                      }
                    }}
                    disabled={readonly}
                  >
                    <option value="">{RAPPORTI_INTERVENTO_TESTI.SELEZIONA_CANTIERE}</option>
                    {cantieri.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                        {c.da_verificare ? ` ${RAPPORTI_INTERVENTO_TESTI.SUFFISSO_DA_VERIFICARE}` : ""}
                      </option>
                    ))}
                  </Select>

                  {!readonly && (
                    <div className="sm:col-span-2 -mt-2">
                      {!mostraNuovoCantiere ? (
                        <button
                          type="button"
                          onClick={() => setMostraNuovoCantiere(true)}
                          className="text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors"
                        >
                          + {RAPPORTI_INTERVENTO_TESTI.NUOVO_CANTIERE}
                        </button>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2 rounded-md border border-dashed border-border p-3">
                          <input
                            type="text"
                            value={nomeNuovoCantiere}
                            onChange={(e) => setNomeNuovoCantiere(e.target.value)}
                            placeholder={RAPPORTI_INTERVENTO_TESTI.NOME_CANTIERE_PLACEHOLDER}
                            disabled={creazioneCantiere}
                            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-brand-500"
                          />
                          <input
                            type="text"
                            value={indirizzoNuovoCantiere}
                            onChange={(e) => setIndirizzoNuovoCantiere(e.target.value)}
                            placeholder={RAPPORTI_INTERVENTO_TESTI.INDIRIZZO_CANTIERE_PLACEHOLDER}
                            disabled={creazioneCantiere}
                            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-brand-500"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              loading={creazioneCantiere}
                              disabled={!nomeNuovoCantiere.trim()}
                              onClick={() => void handleCreaCantiereProposto()}
                            >
                              {RAPPORTI_INTERVENTO_TESTI.CREA_CANTIERE}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={creazioneCantiere}
                              onClick={() => {
                                setMostraNuovoCantiere(false);
                                setNomeNuovoCantiere("");
                                setIndirizzoNuovoCantiere("");
                              }}
                            >
                              {RAPPORTI_INTERVENTO_TESTI.ANNULLA}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <Input
                    label={RAPPORTI_INTERVENTO_TESTI.DATA_INTERVENTO}
                    type="date"
                    className="appearance-none min-w-0"
                    value={form.data_intervento}
                    onChange={(e) => handleFormChange("data_intervento", e.target.value)}
                    disabled={readonly}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 [&>*]:min-w-0">
                    <Input
                      label={RAPPORTI_INTERVENTO_TESTI.ORA_ARRIVO}
                      type="time"
                      className="appearance-none min-w-0"
                      value={form.ora_arrivo}
                      onChange={(e) => handleFormChange("ora_arrivo", e.target.value)}
                      disabled={readonly}
                    />
                    <Input
                      label={RAPPORTI_INTERVENTO_TESTI.ORA_PARTENZA}
                      type="time"
                      className="appearance-none min-w-0"
                      value={form.ora_partenza}
                      onChange={(e) => handleFormChange("ora_partenza", e.target.value)}
                      disabled={readonly}
                    />
                  </div>

                  <SelectCliente
                    label={RAPPORTI_INTERVENTO_TESTI.CLIENTE_COMMITTENTE}
                    placeholder={RAPPORTI_INTERVENTO_TESTI.CLIENTE_PLACEHOLDER}
                    value={form.cliente_committente}
                    selectedId={form.cliente_id}
                    options={clienti}
                    disabled={readonly}
                    onSearchChange={(value) =>
                      setForm((f) => ({
                        ...f,
                        cliente_committente: value,
                        cliente_id: null,
                      }))
                    }
                    onSelect={(cliente) =>
                      setForm((f) => ({
                        ...f,
                        cliente_id: cliente.id,
                        cliente_committente: cliente.ragione_sociale,
                      }))
                    }
                    onCreate={(cliente) => {
                      setClienti((correnti) =>
                        [...correnti, cliente].sort((a, b) =>
                          a.ragione_sociale.localeCompare(b.ragione_sociale)
                        )
                      );
                      setForm((f) => ({
                        ...f,
                        cliente_id: cliente.id,
                        cliente_committente: cliente.ragione_sociale,
                      }));
                      toast.success(RAPPORTI_INTERVENTO_TESTI.MESSAGGI.CLIENTE_CREATO);
                    }}
                    onError={(messaggio) => toast.error(messaggio)}
                  />

                  <Input
                    label={RAPPORTI_INTERVENTO_TESTI.RESPONSABILE_NOME}
                    type="text"
                    value={form.responsabile_nome}
                    onChange={(e) => handleFormChange("responsabile_nome", e.target.value)}
                    disabled={readonly}
                  />

                  <Input
                    label={RAPPORTI_INTERVENTO_TESTI.VIAGGIO_MINUTI}
                    type="number"
                    min="0"
                    value={form.viaggio_minuti}
                    onChange={(e) => handleFormChange("viaggio_minuti", e.target.value)}
                    disabled={readonly}
                  />

                  <label className="flex items-center gap-2 text-sm font-medium text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.diritto_uscita}
                      onChange={(e) => handleFormChange("diritto_uscita", e.target.checked)}
                      disabled={readonly}
                      className="h-4 w-4 accent-brand-500"
                    />
                    {RAPPORTI_INTERVENTO_TESTI.DIRITTO_USCITA}
                  </label>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-text-primary">
                    {RAPPORTI_INTERVENTO_TESTI.NOTE}
                  </label>
                  <textarea
                    value={form.note}
                    onChange={(e) => handleFormChange("note", e.target.value)}
                    disabled={readonly}
                    rows={3}
                    className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-muted resize-none"
                  />
                </div>
              </section>

              {/* Operatori (riga compatta) */}
              <section className={cn("space-y-3", stepCls(2))}>
                <h3 className="font-medium text-text-primary">{RAPPORTI_INTERVENTO_TESTI.OPERATORI}</h3>

                {operatori.length === 0 ? (
                  <p className="text-sm text-text-muted">{RAPPORTI_INTERVENTO_TESTI.NESSUN_OPERATORE}</p>
                ) : (
                  <div className="space-y-2">
                    {operatori.map((op) => (
                      <div key={op.localId} className="flex flex-col sm:flex-row sm:items-end gap-2">
                        <div className="flex-1 min-w-0">
                          <SelectOperatore
                            label={RAPPORTI_INTERVENTO_TESTI.OPERATORE}
                            placeholder={RAPPORTI_INTERVENTO_TESTI.SELEZIONA_OPERATORE}
                            noResultsLabel={RAPPORTI_INTERVENTO_TESTI.NESSUN_OPERATORE_TROVATO}
                            value={op.ricerca_operatore}
                            selectedId={op.dipendente_id}
                            options={dipendenti}
                            disabled={readonly}
                            onSearchChange={(ricerca) =>
                              handleOperatoreSearchChange({ localId: op.localId, ricerca })
                            }
                            onSelect={(dipendente) =>
                              handleOperatoreSelect({ localId: op.localId, dipendente })
                            }
                            onBlurInvalid={() => handleOperatoreBlur({ localId: op.localId })}
                          />
                        </div>

                        <div className="w-full sm:w-24">
                          <Input
                            label={RAPPORTI_INTERVENTO_TESTI.ORE_OPERATORE}
                            type="text"
                            value={op.ore_input}
                            onChange={(e) =>
                              handleOreOperatoreChange({ localId: op.localId, value: e.target.value })
                            }
                            disabled={readonly}
                            placeholder="2h 30m"
                          />
                        </div>

                        {!readonly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => rimuoviOperatore(op.localId)}
                            className="text-error-500 hover:text-error-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!readonly && (
                  <Button variant="secondary" size="sm" type="button" onClick={aggiungiOperatore}>
                    +{RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_OPERATORE}
                  </Button>
                )}

                <div className="rounded-md bg-bg-subtle p-3">
                  <p className="text-xs text-text-muted">
                    {RAPPORTI_INTERVENTO_TESTI.ORE_UOMO_REALI}: {formatMinutiOre(oreUomoRealiMinuti)}
                  </p>
                </div>
              </section>

              {/* Lavorazioni (riga compatta) */}
              <section className={cn("space-y-3", stepCls(3))}>
                <h3 className="font-medium text-text-primary">{RAPPORTI_INTERVENTO_TESTI.LAVORAZIONI}</h3>

                {lavorazioni.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-text-muted">{RAPPORTI_INTERVENTO_TESTI.NESSUNA_LAVORAZIONE}</p>
                    {!readonly && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" type="button" onClick={aggiungiLavorazione}>
                          +{RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_LAVORAZIONE}
                        </Button>
                        <Button variant="secondary" size="sm" type="button" onClick={caricaSnapshot} loading={loadingSnapshot}>
                          {RAPPORTI_INTERVENTO_TESTI.CARICA_SNAPSHOT}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lavorazioni.map((lav) => (
                      <div key={lav.localId} className="flex flex-col sm:flex-row sm:items-end gap-2">
                        <div className="flex-1">
                          <Input
                            label={RAPPORTI_INTERVENTO_TESTI.DESCRIZIONE}
                            type="text"
                            value={lav.descrizione_snapshot}
                            onChange={(e) =>
                              handleLavorazioneChange({
                                localId: lav.localId,
                                field: "descrizione_snapshot",
                                value: e.target.value,
                              })
                            }
                            disabled={readonly}
                          />
                        </div>

                        {!readonly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => rimuoviLavorazione(lav.localId)}
                            className="text-error-500 hover:text-error-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {!readonly && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" type="button" onClick={aggiungiLavorazione}>
                          +{RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_LAVORAZIONE}
                        </Button>
                        <Button variant="secondary" size="sm" type="button" onClick={caricaSnapshot} loading={loadingSnapshot}>
                          {RAPPORTI_INTERVENTO_TESTI.CARICA_SNAPSHOT}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Materiali (riga compatta) */}
              <section className={cn("space-y-3", stepCls(4))}>
                <h3 className="font-medium text-text-primary">{RAPPORTI_INTERVENTO_TESTI.MATERIALI}</h3>

                {materiali.length === 0 ? (
                  <p className="text-sm text-text-muted">{RAPPORTI_INTERVENTO_TESTI.NESSUN_MATERIALE}</p>
                ) : (
                  <div className="space-y-2">
                    {materiali.map((mat) => (
                      <div key={mat.localId} className="flex flex-col sm:flex-row sm:items-end gap-2">
                        <div className="flex-1">
                          <Input
                            label={RAPPORTI_INTERVENTO_TESTI.DESCRIZIONE}
                            type="text"
                            value={mat.descrizione}
                            onChange={(e) =>
                              handleMaterialeChange({
                                localId: mat.localId,
                                field: "descrizione",
                                value: e.target.value,
                              })
                            }
                            disabled={readonly}
                          />
                        </div>

                        <div className="w-20">
                          <Input
                            label={RAPPORTI_INTERVENTO_TESTI.QUANTITA}
                            type="text"
                            value={mat.quantita}
                            onChange={(e) =>
                              handleMaterialeChange({
                                localId: mat.localId,
                                field: "quantita",
                                value: e.target.value,
                              })
                            }
                            disabled={readonly}
                            placeholder="1"
                          />
                        </div>

                        <div className="w-24">
                          <Input
                            label={RAPPORTI_INTERVENTO_TESTI.UNITA_MISURA}
                            type="text"
                            value={mat.unita_misura}
                            onChange={(e) =>
                              handleMaterialeChange({
                                localId: mat.localId,
                                field: "unita_misura",
                                value: e.target.value,
                              })
                            }
                            disabled={readonly}
                            placeholder="kg"
                          />
                        </div>

                        {!readonly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => rimuoviMateriale(mat.localId)}
                            className="text-error-500 hover:text-error-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!readonly && (
                  <Button variant="secondary" size="sm" type="button" onClick={aggiungiMateriale}>
                    +{RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_MATERIALE}
                  </Button>
                )}
              </section>

              {/* Lavori extra (righe libere fuori catalogo) */}
              <section className={cn("space-y-3", stepCls(4))}>
                <h3 className="font-medium text-text-primary">
                  {RAPPORTI_INTERVENTO_TESTI.LAVORI_EXTRA}
                </h3>

                {lavoriExtra.length === 0 ? (
                  <p className="text-sm text-text-muted">
                    {RAPPORTI_INTERVENTO_TESTI.NESSUN_LAVORO_EXTRA}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {lavoriExtra.map((lavoroExtra) => (
                      <div
                        key={lavoroExtra.localId}
                        className="flex flex-col sm:flex-row sm:items-end gap-2"
                      >
                        <div className="flex-1">
                          <Input
                            label={RAPPORTI_INTERVENTO_TESTI.DESCRIZIONE}
                            type="text"
                            value={lavoroExtra.descrizione}
                            onChange={(e) =>
                              handleLavoroExtraChange({
                                localId: lavoroExtra.localId,
                                field: "descrizione",
                                value: e.target.value,
                              })
                            }
                            disabled={readonly}
                          />
                        </div>

                        <div className="w-24">
                          <Input
                            label={RAPPORTI_INTERVENTO_TESTI.ORE_EXTRA}
                            type="text"
                            value={lavoroExtra.ore_input}
                            onChange={(e) =>
                              handleLavoroExtraChange({
                                localId: lavoroExtra.localId,
                                field: "ore_input",
                                value: e.target.value,
                              })
                            }
                            disabled={readonly}
                            placeholder="1:30"
                          />
                        </div>

                        <div className="flex-1">
                          <Input
                            label={RAPPORTI_INTERVENTO_TESTI.NOTE}
                            type="text"
                            value={lavoroExtra.note}
                            onChange={(e) =>
                              handleLavoroExtraChange({
                                localId: lavoroExtra.localId,
                                field: "note",
                                value: e.target.value,
                              })
                            }
                            disabled={readonly}
                          />
                        </div>

                        {!readonly && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => rimuoviLavoroExtra(lavoroExtra.localId)}
                            className="text-error-500 hover:text-error-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!readonly && (
                  <Button variant="secondary" size="sm" type="button" onClick={aggiungiLavoroExtra}>
                    +{RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_LAVORO_EXTRA}
                  </Button>
                )}
              </section>

              {/* Foto (thumbnail compatto + descrizione) */}
              <section className={cn("space-y-3", stepCls(5))}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-text-primary">{RAPPORTI_INTERVENTO_TESTI.FOTO}</h3>
                  {!readonly && (
                    <FileInputPicker
                      label={RAPPORTI_INTERVENTO_TESTI.FOTO}
                      buttonLabel={RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_FOTO}
                      emptyLabel={RAPPORTI_INTERVENTO_TESTI.NESSUNA_FOTO_SELEZIONATA}
                      selectedFileNames={foto.map((f) => f.fileName)}
                      multiple
                      onChange={handleFotoChange}
                      accept="image/*"
                    />
                  )}
                </div>

                {foto.length === 0 ? (
                  <p className="text-sm text-text-muted">{RAPPORTI_INTERVENTO_TESTI.NESSUNA_FOTO}</p>
                ) : (
                  <div className="space-y-2">
                    {foto.map((immagine) => (
                      <div key={immagine.localId} className="flex gap-3">
                        <div className="relative flex-shrink-0">
                          <Image
                            src={immagine.immagine_data_url}
                            alt={immagine.descrizione}
                            width={80}
                            height={80}
                            className="h-20 w-20 rounded-md border border-border object-cover"
                          />
                        </div>

                        <div className="flex-1 min-w-0 flex flex-col gap-2">
                          <Input
                            label={RAPPORTI_INTERVENTO_TESTI.DESCRIZIONE_FOTO}
                            type="text"
                            value={immagine.descrizione}
                            onChange={(e) =>
                              handleDescrizioneFotoChange({
                                localId: immagine.localId,
                                descrizione: e.target.value,
                              })
                            }
                            disabled={readonly}
                            placeholder="Descrizione della foto"
                          />

                          {!readonly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => rimuoviFoto(immagine.localId)}
                              className="text-error-500 hover:text-error-500 w-fit"
                            >
                              <Trash2 className="h-4 w-4" />
                              {RAPPORTI_INTERVENTO_TESTI.RIMUOVI}
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Riepilogo (step finale) */}
              <section className={cn("space-y-3 rounded-md border border-border p-4", stepCls(6))}>
                <h3 className="font-medium text-text-primary">Riepilogo</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-text-muted">{RAPPORTI_INTERVENTO_TESTI.DATA_INTERVENTO}</dt>
                    <dd className="text-text-primary">{form.data_intervento || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">{RAPPORTI_INTERVENTO_TESTI.CLIENTE_COMMITTENTE}</dt>
                    <dd className="text-text-primary">{form.cliente_committente || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">{RAPPORTI_INTERVENTO_TESTI.OPERATORI}</dt>
                    <dd className="text-text-primary">{operatori.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Lavorazioni</dt>
                    <dd className="text-text-primary">{lavorazioni.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">{RAPPORTI_INTERVENTO_TESTI.MATERIALI}</dt>
                    <dd className="text-text-primary">{materiali.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">{RAPPORTI_INTERVENTO_TESTI.LAVORI_EXTRA}</dt>
                    <dd className="text-text-primary">{lavoriExtra.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">{RAPPORTI_INTERVENTO_TESTI.FOTO}</dt>
                    <dd className="text-text-primary">{foto.length}</dd>
                  </div>
                </dl>
              </section>

              {/* KPI / Calculus (display) */}
              <section className={cn("space-y-3 rounded-md bg-bg-subtle p-4", stepCls(6))}>
                <h3 className="font-medium text-text-primary">Calcoli fatturazione</h3>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-text-muted">{RAPPORTI_INTERVENTO_TESTI.ORE_UOMO_REALI}</p>
                    <p className="text-lg font-semibold text-text-primary">
                      {formatMinutiOre(oreUomoRealiMinuti)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-text-muted">{RAPPORTI_INTERVENTO_TESTI.VIAGGIO_MINUTI}</p>
                    <p className="text-lg font-semibold text-text-primary">{viaggioMinuti}</p>
                  </div>

                  <div>
                    <p className="text-xs text-text-muted">{RAPPORTI_INTERVENTO_TESTI.ORE_FATTURABILI}</p>
                    <p className="text-lg font-semibold text-brand-500">
                      {formatMinutiOre(calcolo.ore_fatturabili_minuti)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-text-muted">{RAPPORTI_INTERVENTO_TESTI.REGOLA_FATTURAZIONE}</p>
                    <p className="text-sm font-medium text-text-primary">
                      {LABEL_REGOLE_FATTURAZIONE_INTERVENTO[calcolo.regola_fatturazione]}
                    </p>
                  </div>
                </div>
              </section>

              {/* Firme: pagina dedicata; qui anteprima se già firmate */}
              <section className={cn("space-y-4", stepCls(6))}>
                <h3 className="font-medium text-text-primary">{RAPPORTI_INTERVENTO_TESTI.FIRMA}</h3>

                {readonly &&
                (form.firma_responsabile_data_url || form.firma_cliente_data_url) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {form.firma_responsabile_data_url && (
                      <div>
                        <p className="mb-2 text-sm font-medium text-text-muted">
                          {RAPPORTI_INTERVENTO_TESTI.FIRMA_RESPONSABILE}
                          {form.firma_responsabile_nome
                            ? ` — ${form.firma_responsabile_nome}`
                            : ""}
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.firma_responsabile_data_url}
                          alt={RAPPORTI_INTERVENTO_TESTI.FIRMA_RESPONSABILE}
                          className="h-[120px] w-full rounded-md border border-border bg-bg-card object-contain"
                        />
                      </div>
                    )}
                    {form.firma_cliente_data_url && (
                      <div>
                        <p className="mb-2 text-sm font-medium text-text-muted">
                          {RAPPORTI_INTERVENTO_TESTI.FIRMA_CLIENTE}
                          {form.firma_cliente_nome
                            ? ` — ${form.firma_cliente_nome}`
                            : ""}
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={form.firma_cliente_data_url}
                          alt={RAPPORTI_INTERVENTO_TESTI.FIRMA_CLIENTE}
                          className="h-[120px] w-full rounded-md border border-border bg-bg-card object-contain"
                        />
                      </div>
                    )}
                  </div>
                ) : !readonly ? (
                  <div className="space-y-4">
                    <p className="text-xs text-text-muted">
                      Firma qui sotto. Con &laquo;Invia rapporto&raquo; viene
                      salvato come definitivo, non più modificabile, e inviato
                      al cliente.
                    </p>
                    {/* Desktop: entrambe le firme affiancate */}
                    <div className="hidden sm:grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Input
                          label={`${RAPPORTI_INTERVENTO_TESTI.FIRMA_RESPONSABILE} — nome`}
                          value={form.firma_responsabile_nome}
                          placeholder={form.responsabile_nome}
                          onChange={(e) =>
                            handleFormChange("firma_responsabile_nome", e.target.value)
                          }
                        />
                        <FirmaCanvas
                          label={RAPPORTI_INTERVENTO_TESTI.FIRMA_RESPONSABILE}
                          clearLabel={RAPPORTI_INTERVENTO_TESTI.CANCELLA_FIRMA}
                          value={form.firma_responsabile_data_url}
                          onChange={(v) =>
                            handleFormChange("firma_responsabile_data_url", v)
                          }
                          disabled={salvataggio}
                        />
                      </div>
                      <div className="space-y-2">
                        <Input
                          label={`${RAPPORTI_INTERVENTO_TESTI.FIRMA_CLIENTE} — nome`}
                          value={form.firma_cliente_nome}
                          placeholder={form.cliente_committente}
                          onChange={(e) =>
                            handleFormChange("firma_cliente_nome", e.target.value)
                          }
                        />
                        <FirmaCanvas
                          label={RAPPORTI_INTERVENTO_TESTI.FIRMA_CLIENTE}
                          clearLabel={RAPPORTI_INTERVENTO_TESTI.CANCELLA_FIRMA}
                          value={form.firma_cliente_data_url}
                          onChange={(v) =>
                            handleFormChange("firma_cliente_data_url", v)
                          }
                          disabled={salvataggio}
                        />
                      </div>
                    </div>

                    {/* Mobile: una firma alla volta, a schermo intero */}
                    <div className="grid grid-cols-1 gap-2 sm:hidden">
                      <Button
                        type="button"
                        variant={form.firma_responsabile_data_url ? "secondary" : "primary"}
                        onClick={() => setFirmaFullscreen("responsabile")}
                      >
                        {form.firma_responsabile_data_url ? "✓ " : ""}
                        {RAPPORTI_INTERVENTO_TESTI.FIRMA_RESPONSABILE}
                      </Button>
                      <Button
                        type="button"
                        variant={form.firma_cliente_data_url ? "secondary" : "primary"}
                        onClick={() => setFirmaFullscreen("cliente")}
                      >
                        {form.firma_cliente_data_url ? "✓ " : ""}
                        {RAPPORTI_INTERVENTO_TESTI.FIRMA_CLIENTE}
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      loading={salvataggio}
                      disabled={
                        !form.firma_responsabile_data_url ||
                        !form.firma_cliente_data_url
                      }
                      onClick={() => void handleFirmaWizard()}
                    >
                      Invia rapporto
                    </Button>

                    {/* Firma remota: il responsabile firma qui, il cliente da link */}
                    <div className="rounded-md border border-dashed border-border p-3 space-y-2">
                      <p className="text-xs text-text-muted">
                        Oppure firma solo come responsabile e invia al cliente
                        il link per firmare a distanza.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        loading={invioRemotaLoading}
                        disabled={!form.firma_responsabile_data_url}
                        onClick={() => void handleInviaFirmaRemota()}
                      >
                        Invia per firma remota (cliente)
                      </Button>

                      {firmaRemotaLink && (
                        <div className="space-y-2 rounded-md bg-bg-subtle p-2">
                          <p className="break-all text-xs text-text-primary">
                            {firmaRemotaLink}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(
                                `Firma il rapporto di lavoro: ${firmaRemotaLink}`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-8 items-center rounded-md bg-[#25D366] px-3 text-xs font-medium text-white"
                            >
                              Condividi su WhatsApp
                            </a>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => {
                                void navigator.clipboard?.writeText(firmaRemotaLink);
                                toast.success("Link copiato");
                              }}
                            >
                              Copia link
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Overlay firma a schermo intero (mobile) */}
                    {firmaFullscreen && (
                      <div className="fixed inset-0 z-50 flex flex-col gap-3 bg-bg-base p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-text-primary">
                            {firmaFullscreen === "responsabile"
                              ? RAPPORTI_INTERVENTO_TESTI.FIRMA_RESPONSABILE
                              : RAPPORTI_INTERVENTO_TESTI.FIRMA_CLIENTE}
                          </h3>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => setFirmaFullscreen(null)}
                          >
                            Fatto
                          </Button>
                        </div>
                        <Input
                          label="Nome"
                          value={
                            firmaFullscreen === "responsabile"
                              ? form.firma_responsabile_nome
                              : form.firma_cliente_nome
                          }
                          placeholder={
                            firmaFullscreen === "responsabile"
                              ? form.responsabile_nome
                              : form.cliente_committente
                          }
                          onChange={(e) =>
                            handleFormChange(
                              firmaFullscreen === "responsabile"
                                ? "firma_responsabile_nome"
                                : "firma_cliente_nome",
                              e.target.value
                            )
                          }
                        />
                        <div className="flex flex-1 items-center justify-center">
                          <FirmaCanvas
                            label={
                              firmaFullscreen === "responsabile"
                                ? RAPPORTI_INTERVENTO_TESTI.FIRMA_RESPONSABILE
                                : RAPPORTI_INTERVENTO_TESTI.FIRMA_CLIENTE
                            }
                            clearLabel={RAPPORTI_INTERVENTO_TESTI.CANCELLA_FIRMA}
                            value={
                              firmaFullscreen === "responsabile"
                                ? form.firma_responsabile_data_url
                                : form.firma_cliente_data_url
                            }
                            onChange={(v) =>
                              handleFormChange(
                                firmaFullscreen === "responsabile"
                                  ? "firma_responsabile_data_url"
                                  : "firma_cliente_data_url",
                                v
                              )
                            }
                            disabled={salvataggio}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : !rapportoInModificaId ? (
                  <p className="text-sm text-text-muted">
                    {RAPPORTI_INTERVENTO_TESTI.FIRMA_DISPONIBILE_DOPO_SALVATAGGIO}
                  </p>
                ) : null}
              </section>

              {/* Pulsanti finali */}
              <div className={cn("flex flex-col sm:flex-row gap-2", stepCls(6))}>
                {!readonly && (
                  <Button
                    type="submit"
                    variant="secondary"
                    loading={salvataggio}
                  >
                    Salva bozza
                  </Button>
                )}

                {rapportoInModificaId && (
                  <>
                    <Button variant="secondary" type="button" onClick={() => resetForm()}>
                      {RAPPORTI_INTERVENTO_TESTI.ANNULLA}
                    </Button>

                    {readonly && (
                      <>
                        <Button
                          variant="secondary"
                          type="button"
                          loading={pdfId === rapportoInModificaId}
                          onClick={() => void handlePdf(rapportoInModificaId)}
                        >
                          {RAPPORTI_INTERVENTO_TESTI.GENERA_PDF}
                        </Button>
                        {rapporti.find((r) => r.id === rapportoInModificaId)?.stato ===
                          RAPPORTI_INTERVENTO_STATI.FIRMATO && (
                          <Button
                            variant="primary"
                            type="button"
                            loading={invioInCorso}
                            icon={!invioInCorso ? <Send className="h-4 w-4" /> : undefined}
                            onClick={() => {
                              const rapporto = rapporti.find(
                                (r) => r.id === rapportoInModificaId
                              );
                              if (rapporto) avviaInvio(rapporto);
                            }}
                          >
                            {RAPPORTI_INTERVENTO_TESTI.INVIA_AL_CLIENTE}
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Navigazione wizard (solo in compilazione) */}
              {!readonly && (
                <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={stepCorrente === 1}
                    onClick={vaiIndietro}
                  >
                    Indietro
                  </Button>
                  {stepCorrente < TOTALE_STEP ? (
                    <Button type="button" variant="primary" onClick={vaiAvanti}>
                      Avanti
                    </Button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                </div>
              )}
            </form>
          </Card>

          {/* ── Lista rapporti (responsive: top mobile <1024px, sidebar destra desktop) ── */}
          <div className="order-first lg:order-last">
            {/* Mobile: Lista compatta in alto */}
            <Card className="p-5 lg:sticky lg:top-20">
              <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                {RAPPORTI_INTERVENTO_TESTI.LISTA}
              </h2>

              {loading ? (
                <p className="text-sm text-text-muted">{RAPPORTI_INTERVENTO_TESTI.CARICAMENTO}</p>
              ) : (
                <div className="space-y-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cerca rapporto"
                      value={ricercaRapporti}
                      onChange={(e) => setRicercaRapporti(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-md border border-border bg-bg-card text-sm placeholder:text-text-subtle outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>

                  {/* Lista rapporti (max 3) */}
                  {rapportiFiltrati.length === 0 ? (
                    <p className="text-xs text-text-muted py-4">
                      {ricercaRapporti
                        ? "Nessun rapporto trovato"
                        : RAPPORTI_INTERVENTO_TESTI.NESSUN_RAPPORTO}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {rapportiFiltrati.map((r) => (
                        <div
                          key={r.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => void caricaRapportoInForm(r)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              void caricaRapportoInForm(r);
                            }
                          }}
                          className={cn(
                            "w-full text-left p-3 rounded-md border transition-colors duration-150 cursor-pointer",
                            rapportoInModificaId === r.id
                              ? "bg-brand-50 border-brand-500/30 text-text-primary"
                              : "border-border hover:bg-bg-subtle text-text-primary"
                          )}
                        >
                          <p className="font-medium text-sm">{r.cantiere_nome_snapshot}</p>
                          <p className="text-xs text-text-muted">{formattaData(r.data_intervento)}</p>
                          <div className="flex items-center justify-between mt-2 gap-2">
                            <Badge variant={getStatoBadgeVariant(r.stato)} size="sm">
                              {LABEL_STATI_RAPPORTO_INTERVENTO[r.stato]}
                            </Badge>
                            {r.stato === RAPPORTI_INTERVENTO_STATI.BOZZA && (
                              <Link
                                href={`${APP_ROUTES.BACKOFFICE_RAPPORTI_INTERVENTO}/${r.id}/firma`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors"
                                aria-label={RAPPORTI_INTERVENTO_TESTI.VAI_ALLA_FIRMA}
                              >
                                <PenLine className="h-4 w-4" />
                                {RAPPORTI_INTERVENTO_TESTI.FIRMA_PAGINA_TITOLO}
                              </Link>
                            )}
                            {r.stato === RAPPORTI_INTERVENTO_STATI.FIRMATO && (
                              <span className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    avviaInvio(r);
                                  }}
                                  disabled={invioInCorso}
                                  aria-label={RAPPORTI_INTERVENTO_TESTI.INVIA}
                                  className="flex items-center gap-1 text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors disabled:opacity-50"
                                >
                                  <Send className="h-4 w-4" />
                                  {RAPPORTI_INTERVENTO_TESTI.INVIA}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handlePdf(r.id);
                                  }}
                                  className="text-text-muted hover:text-text-primary transition-colors"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              </span>
                            )}
                            {r.stato === RAPPORTI_INTERVENTO_STATI.INVIATO && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handlePdf(r.id);
                                }}
                                className="text-text-muted hover:text-text-primary transition-colors"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Vedi tutti button su mobile */}
                  {rapporti.length > 3 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setMostraListaRapporti(!mostraListaRapporti)}
                      className="w-full"
                      icon={<ChevronDown className={cn("h-4 w-4 transition-transform", mostraListaRapporti && "rotate-180")} />}
                    >
                      {mostraListaRapporti ? "Nascondi" : "Vedi tutti"}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      {rapportoSenzaEmail && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/60 p-4 backdrop-blur-sm"
          onClick={() => setRapportoSenzaEmail(null)}
        >
          <div
            className="w-full max-w-sm bg-bg-card border border-border rounded-lg shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-heading text-lg font-medium text-text-primary">
              {RAPPORTI_INTERVENTO_TESTI.EMAIL_CLIENTE_TITOLO}
            </h2>
            <p className="mt-2 text-sm text-text-muted">
              {RAPPORTI_INTERVENTO_TESTI.EMAIL_CLIENTE_DESCRIZIONE}{" "}
              «{rapportoSenzaEmail.cliente_committente}».
            </p>

            <input
              type="email"
              value={emailNuovoInvio}
              onChange={(e) => setEmailNuovoInvio(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void salvaEmailEProsegui();
                }
              }}
              placeholder="email@cliente.it"
              autoFocus
              disabled={salvataggioEmailInvio}
              className="mt-4 h-10 w-full rounded-md border border-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-brand-500"
            />

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRapportoSenzaEmail(null)}
                disabled={salvataggioEmailInvio}
              >
                {RAPPORTI_INTERVENTO_TESTI.ANNULLA}
              </Button>
              <Button
                size="sm"
                loading={salvataggioEmailInvio}
                disabled={!emailNuovoInvio.trim()}
                onClick={() => void salvaEmailEProsegui()}
              >
                {RAPPORTI_INTERVENTO_TESTI.EMAIL_CLIENTE_CONFERMA}
              </Button>
            </div>
          </div>
        </div>
      )}

      {rapportoDaInviare && (
        <ConfirmDialog
          title={RAPPORTI_INTERVENTO_TESTI.INVIA_AL_CLIENTE}
          message={`${RAPPORTI_INTERVENTO_TESTI.INVIO_CONFERMA} ${rapportoDaInviare.cliente_committente} (${rapportoDaInviare.cantiere_nome_snapshot}, ${formattaData(rapportoDaInviare.data_intervento)}). ${RAPPORTI_INTERVENTO_TESTI.INVIO_CONFERMA_CC}`}
          confirmLabel={RAPPORTI_INTERVENTO_TESTI.INVIA}
          onConfirm={() => void eseguiInvioRapporto()}
          onCancel={() => setRapportoDaInviare(null)}
        />
      )}
    </div>
  );
}