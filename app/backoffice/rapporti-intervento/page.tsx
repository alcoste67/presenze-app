"use client";

import Link from "next/link";
import Image from "next/image";
import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Download, Home, PenLine, Plus, Search, Trash2 } from "lucide-react";

import { FileInputPicker } from "@/components/backoffice/FileInputPicker";
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
import { loadClienti } from "@/services/clienti/loadClienti";
import { SelectCliente } from "@/components/clienti/SelectCliente";
import type { Cliente } from "@/types/clienti";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { loadDipendentiAttivi } from "@/services/dipendenti/loadDipendentiAttivi";
import { aggiornaRapportoIntervento } from "@/services/rapportiIntervento/aggiornaRapportoIntervento";
import { calcolaOreFatturabili } from "@/services/rapportiIntervento/calcolaOreFatturabili";
import { creaRapportoIntervento } from "@/services/rapportiIntervento/creaRapportoIntervento";
import { fetchRapportoInterventoPdf } from "@/services/rapportiIntervento/fetchRapportoInterventoPdf";
import { loadLavorazioniRapportoIntervento } from "@/services/rapportiIntervento/loadLavorazioniRapportoIntervento";
import { loadRapportiIntervento } from "@/services/rapportiIntervento/loadRapportiIntervento";
import { loadRapportoIntervento } from "@/services/rapportiIntervento/loadRapportoIntervento";
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
  RapportoInterventoMaterialeInput,
  RapportoInterventoOperatoreInput,
} from "@/types/rapportiIntervento";

import { AppHeader } from "@/components/ui/AppHeader";
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

type MaterialeForm = Omit<RapportoInterventoMaterialeInput, "quantita"> & {
  localId: string;
  quantita: string;
};

type RapportoForm = {
  cantiere_id: string;
  data_intervento: string;
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

const FORM_INIZIALE: RapportoForm = {
  cantiere_id: "",
  data_intervento: "",
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

    if (!lavorazione.ore_uomo_input.trim()) {
      return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.ORE_NON_VALIDE };
    }

    const oreUomoMinuti = parseOreMinutiInput(lavorazione.ore_uomo_input);

    if (oreUomoMinuti === null) {
      return { errore: RAPPORTI_INTERVENTO_TESTI.ERRORI.FORMATO_ORE_NON_VALIDO };
    }

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

function preparaPayload({
  form,
  lavorazioni,
  operatori,
  foto,
  materiali,
}: {
  form: RapportoForm;
  lavorazioni: LavorazioneForm[];
  operatori: OperatoreForm[];
  foto: FotoForm[];
  materiali: MaterialeForm[];
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

  return {
    payload: {
      cantiere_id: form.cantiere_id,
      data_intervento: form.data_intervento,
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
  const [form, setForm] = useState<RapportoForm>(FORM_INIZIALE);
  const [lavorazioni, setLavorazioni] = useState<LavorazioneForm[]>([]);
  const [operatori, setOperatori] = useState<OperatoreForm[]>([]);
  const [foto, setFoto] = useState<FotoForm[]>([]);
  const [materiali, setMateriali] = useState<MaterialeForm[]>([]);
  const [rapportoInModificaId, setRapportoInModificaId] = useState<string | null>(null);
  const [readonly, setReadonly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [utenteAdmin, setUtenteAdmin] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [pdfId, setPdfId] = useState<string | null>(null);
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
    setForm(FORM_INIZIALE);
    setLavorazioni([]);
    setOperatori([]);
    setFoto([]);
    setMateriali([]);
    setRapportoInModificaId(null);
    setReadonly(false);
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

  const aggiungiOperatore = useCallback(() => {
    setOperatori((operatoriCorrenti) => [
      ...operatoriCorrenti,
      {
        localId: getLocalId(),
        dipendente_id: null,
        nome_snapshot: "",
        email_snapshot: null,
        ricerca_operatore: "",
        ore_input: "",
        ore_minuti: 0,
        ordine: operatoriCorrenti.length + 1,
      },
    ]);
  }, []);

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

  const leggiFileComeDataUrl = (file: File) =>
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

          return leggiFileComeDataUrl(file);
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
              {/* Anagrafica */}
              <section className="space-y-4">
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
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </Select>

                  <Input
                    label={RAPPORTI_INTERVENTO_TESTI.DATA_INTERVENTO}
                    type="date"
                    value={form.data_intervento}
                    onChange={(e) => handleFormChange("data_intervento", e.target.value)}
                    disabled={readonly}
                  />

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
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-text-primary">{RAPPORTI_INTERVENTO_TESTI.OPERATORI}</h3>
                  {!readonly && (
                    <Button variant="secondary" size="sm" type="button" onClick={aggiungiOperatore}>
                      +{RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_OPERATORE}
                    </Button>
                  )}
                </div>

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

                <div className="rounded-md bg-bg-subtle p-3">
                  <p className="text-xs text-text-muted">
                    {RAPPORTI_INTERVENTO_TESTI.ORE_UOMO_REALI}: {formatMinutiOre(oreUomoRealiMinuti)}
                  </p>
                </div>
              </section>

              {/* Lavorazioni (riga compatta) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-text-primary">{RAPPORTI_INTERVENTO_TESTI.LAVORAZIONI}</h3>
                  {!readonly && (
                    <Button variant="secondary" size="sm" type="button" onClick={aggiungiLavorazione}>
                      +{RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_LAVORAZIONE}
                    </Button>
                  )}
                </div>

                {lavorazioni.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-text-muted">{RAPPORTI_INTERVENTO_TESTI.NESSUNA_LAVORAZIONE}</p>
                    {!readonly && (
                      <Button variant="secondary" size="sm" type="button" onClick={caricaSnapshot} loading={loadingSnapshot}>
                        {RAPPORTI_INTERVENTO_TESTI.CARICA_SNAPSHOT}
                      </Button>
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

                        <div className="w-full sm:w-24">
                          <Input
                            label={RAPPORTI_INTERVENTO_TESTI.ORE_UOMO_MINUTI}
                            type="text"
                            value={lav.ore_uomo_input}
                            onChange={(e) =>
                              handleLavorazioneChange({
                                localId: lav.localId,
                                field: "ore_uomo_input",
                                value: e.target.value,
                              })
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
                            onClick={() => rimuoviLavorazione(lav.localId)}
                            className="text-error-500 hover:text-error-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}

                    {!readonly && (
                      <Button variant="secondary" size="sm" type="button" onClick={caricaSnapshot} loading={loadingSnapshot}>
                        {RAPPORTI_INTERVENTO_TESTI.CARICA_SNAPSHOT}
                      </Button>
                    )}
                  </div>
                )}
              </section>

              {/* Materiali (riga compatta) */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-text-primary">{RAPPORTI_INTERVENTO_TESTI.MATERIALI}</h3>
                  {!readonly && (
                    <Button variant="secondary" size="sm" type="button" onClick={aggiungiMateriale}>
                      +{RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_MATERIALE}
                    </Button>
                  )}
                </div>

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
              </section>

              {/* Foto (thumbnail compatto + descrizione) */}
              <section className="space-y-3">
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

              {/* KPI / Calculus (display) */}
              <section className="space-y-3 rounded-md bg-bg-subtle p-4">
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
              <section className="space-y-4">
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
                ) : rapportoInModificaId && !readonly ? (
                  <Link
                    href={`${APP_ROUTES.BACKOFFICE_RAPPORTI_INTERVENTO}/${rapportoInModificaId}/firma`}
                  >
                    <Button type="button" variant="secondary">
                      {RAPPORTI_INTERVENTO_TESTI.VAI_ALLA_FIRMA}
                    </Button>
                  </Link>
                ) : !rapportoInModificaId ? (
                  <p className="text-sm text-text-muted">
                    {RAPPORTI_INTERVENTO_TESTI.FIRMA_DISPONIBILE_DOPO_SALVATAGGIO}
                  </p>
                ) : null}
              </section>

              {/* Pulsanti finali */}
              <div className="flex flex-col sm:flex-row gap-2">
                {!readonly && (
                  <Button
                    type="submit"
                    variant="primary"
                    loading={salvataggio}
                    icon={rapportoInModificaId ? undefined : <Plus className="h-4 w-4" />}
                  >
                    {rapportoInModificaId
                      ? RAPPORTI_INTERVENTO_TESTI.SALVA
                      : RAPPORTI_INTERVENTO_TESTI.NUOVO}
                  </Button>
                )}

                {rapportoInModificaId && (
                  <>
                    <Button variant="secondary" type="button" onClick={() => resetForm()}>
                      {RAPPORTI_INTERVENTO_TESTI.ANNULLA}
                    </Button>

                    {readonly && (
                      <Button
                        variant="secondary"
                        type="button"
                        loading={pdfId === rapportoInModificaId}
                        onClick={() => void handlePdf(rapportoInModificaId)}
                      >
                        {RAPPORTI_INTERVENTO_TESTI.GENERA_PDF}
                      </Button>
                    )}
                  </>
                )}
              </div>
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
    </div>
  );
}