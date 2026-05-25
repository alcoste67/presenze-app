"use client";

import Link from "next/link";
import Image from "next/image";
import type {
  ChangeEvent,
  FormEvent,
} from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { FirmaCanvas } from "@/components/rapportiIntervento/FirmaCanvas";
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

type LavorazioneForm =
  RapportoInterventoLavorazioneInput & {
    localId: string;
    ore_uomo_input: string;
  };

type FotoForm = RapportoInterventoFotoInput & {
  localId: string;
};

type OperatoreForm = Omit<
  RapportoInterventoOperatoreInput,
  "ore_minuti"
> & {
  localId: string;
  ricerca_operatore: string;
  ore_input: string;
  ore_minuti: number;
};

type MaterialeForm = Omit<
  RapportoInterventoMaterialeInput,
  "quantita"
> & {
  localId: string;
  quantita: string;
};

type RapportoForm = {
  cantiere_id: string;
  data_intervento: string;
  cliente_committente: string;
  responsabile_nome: string;
  viaggio_minuti: string;
  diritto_uscita: boolean;
  note: string;
  firma_responsabile_data_url: string | null;
  firma_responsabile_nome: string;
  firma_cliente_data_url: string | null;
  firma_cliente_nome: string;
};

const FORM_INIZIALE: RapportoForm = {
  cantiere_id: "",
  data_intervento: "",
  cliente_committente: "",
  responsabile_nome: "",
  viaggio_minuti: "0",
  diritto_uscita: false,
  note: "",
  firma_responsabile_data_url: null,
  firma_responsabile_nome: "",
  firma_cliente_data_url: null,
  firma_cliente_nome: "",
};

function getLocalId() {
  if (
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function getMessaggioErrore(error: unknown) {
  return error instanceof Error
    ? error.message
    : RAPPORTI_INTERVENTO_TESTI.ERRORI
        .GENERICO;
}

function getNomeDipendente(
  dipendente: Dipendente
) {
  return `${dipendente.nome} ${dipendente.cognome}`.trim();
}

function getLabelDipendente(
  dipendente: Dipendente
) {
  return `${getNomeDipendente(dipendente)} - ${dipendente.email}`;
}

function formattaData(data: string) {
  if (!data) {
    return "";
  }

  return new Intl.DateTimeFormat(
    RAPPORTI_INTERVENTO_PDF.LOCALE
  ).format(new Date(`${data}T00:00:00`));
}

function getNumeroIntero(
  value: string
): number | null {
  const numero = Number(value.trim());

  if (!Number.isInteger(numero) || numero < 0) {
    return null;
  }

  return numero;
}

function getNumeroDecimale(
  value: string
): number | null {
  const numero = Number(
    value.trim().replace(",", ".")
  );

  if (!Number.isFinite(numero) || numero < 0) {
    return null;
  }

  return numero;
}

function isFirmaValida(
  firmaDataUrl: string | null
) {
  return (
    !firmaDataUrl ||
    firmaDataUrl.length <=
      RAPPORTI_INTERVENTO_LIMITI.FIRMA_MAX_DATA_URL_CARATTERI
  );
}

function isFotoValida(fotoDataUrl: string) {
  return (
    fotoDataUrl.startsWith("data:image/") &&
    fotoDataUrl.length <=
      RAPPORTI_INTERVENTO_LIMITI.FOTO_MAX_DATA_URL_CARATTERI
  );
}

function getStatoClassName(
  stato: RapportoIntervento["stato"]
) {
  if (
    stato === RAPPORTI_INTERVENTO_STATI.FIRMATO
  ) {
    return "bg-industrial-success-bg text-industrial-success-text";
  }

  if (
    stato === RAPPORTI_INTERVENTO_STATI.ANNULLATO
  ) {
    return "bg-industrial-danger-bg text-industrial-danger-text";
  }

  return "bg-industrial-warning-bg text-industrial-warning-text";
}

function scaricaBlobPdf({
  blob,
  nomeFile,
}: {
  blob: Blob;
  nomeFile: string;
}) {
  const url = URL.createObjectURL(blob);
  const link =
    document.createElement("a");

  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function normalizzaLavorazioni(
  lavorazioni: LavorazioneForm[]
):
  | {
      lavorazioni: RapportoInterventoLavorazioneInput[];
    }
  | { errore: string } {
  if (lavorazioni.length === 0) {
    return {
      errore:
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .LAVORAZIONE_OBBLIGATORIA,
    };
  }

  const lavorazioniNormalizzate: RapportoInterventoLavorazioneInput[] =
    [];

  for (const [
    index,
    lavorazione,
  ] of lavorazioni.entries()) {
    const descrizione =
      lavorazione.descrizione_snapshot
        .trim()
        .replace(/\s+/g, " ");

    if (!descrizione) {
      return {
        errore:
          RAPPORTI_INTERVENTO_TESTI.ERRORI
            .DESCRIZIONE_OBBLIGATORIA,
      };
    }

    if (
      !lavorazione.ore_uomo_input.trim()
    ) {
      return {
        errore:
          RAPPORTI_INTERVENTO_TESTI.ERRORI
            .ORE_NON_VALIDE,
      };
    }

    const oreUomoMinuti =
      parseOreMinutiInput(
        lavorazione.ore_uomo_input
      );

    if (oreUomoMinuti === null) {
      return {
        errore:
          RAPPORTI_INTERVENTO_TESTI.ERRORI
            .FORMATO_ORE_NON_VALIDO,
      };
    }

    lavorazioniNormalizzate.push({
      lavorazione_id:
        lavorazione.lavorazione_id,
      descrizione_snapshot: descrizione,
      ore_uomo_minuti: oreUomoMinuti,
      ordine: index + 1,
    });
  }

  return {
    lavorazioni: lavorazioniNormalizzate,
  };
}

function normalizzaFoto(
  foto: FotoForm[]
):
  | {
      foto: RapportoInterventoFotoInput[];
    }
  | { errore: string } {
  const fotoNormalizzate: RapportoInterventoFotoInput[] =
    [];

  for (const [index, immagine] of foto.entries()) {
    if (!isFotoValida(immagine.immagine_data_url)) {
      return {
        errore:
          immagine.immagine_data_url.length >
          RAPPORTI_INTERVENTO_LIMITI.FOTO_MAX_DATA_URL_CARATTERI
            ? RAPPORTI_INTERVENTO_TESTI.ERRORI
                .FOTO_TROPPO_GRANDE
            : RAPPORTI_INTERVENTO_TESTI.ERRORI
                .FOTO_NON_VALIDA,
      };
    }

    fotoNormalizzate.push({
      immagine_data_url:
        immagine.immagine_data_url,
      descrizione:
        immagine.descrizione.trim(),
      ordine: index + 1,
    });
  }

  return {
    foto: fotoNormalizzate,
  };
}

function normalizzaOperatori(
  operatori: OperatoreForm[]
):
  | {
      operatori: RapportoInterventoOperatoreInput[];
    }
  | { errore: string } {
  if (operatori.length === 0) {
    return {
      errore:
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .OPERATORE_OBBLIGATORIO,
    };
  }

  const dipendentiIds = new Set<string>();
  const operatoriNormalizzati: RapportoInterventoOperatoreInput[] =
    [];

  for (const [
    index,
    operatore,
  ] of operatori.entries()) {
    if (
      !operatore.dipendente_id ||
      !operatore.nome_snapshot.trim()
    ) {
      return {
        errore:
          RAPPORTI_INTERVENTO_TESTI.ERRORI
            .OPERATORE_NON_VALIDO,
      };
    }

    if (
      dipendentiIds.has(
        operatore.dipendente_id
      )
    ) {
      return {
        errore:
          RAPPORTI_INTERVENTO_TESTI.ERRORI
            .OPERATORE_DUPLICATO,
      };
    }

    dipendentiIds.add(
      operatore.dipendente_id
    );

    if (!operatore.ore_input.trim()) {
      return {
        errore:
          RAPPORTI_INTERVENTO_TESTI.ERRORI
            .ORE_OPERATORE_NON_VALIDE,
      };
    }

    const oreMinuti =
      parseOreMinutiInput(
        operatore.ore_input
      );

    if (oreMinuti === null) {
      return {
        errore:
          RAPPORTI_INTERVENTO_TESTI.ERRORI
            .FORMATO_ORE_NON_VALIDO,
      };
    }

    operatoriNormalizzati.push({
      dipendente_id:
        operatore.dipendente_id,
      nome_snapshot:
        operatore.nome_snapshot
          .trim()
          .replace(/\s+/g, " "),
      email_snapshot:
        operatore.email_snapshot,
      ore_minuti: oreMinuti,
      ordine: index + 1,
    });
  }

  return {
    operatori: operatoriNormalizzati,
  };
}

function normalizzaMateriali(
  materiali: MaterialeForm[]
):
  | {
      materiali: RapportoInterventoMaterialeInput[];
    }
  | { errore: string } {
  const materialiNormalizzati: RapportoInterventoMaterialeInput[] =
    [];

  for (const [
    index,
    materiale,
  ] of materiali.entries()) {
    const descrizione =
      materiale.descrizione
        .trim()
        .replace(/\s+/g, " ");

    if (!descrizione) {
      return {
        errore:
          RAPPORTI_INTERVENTO_TESTI.ERRORI
            .MATERIALE_DESCRIZIONE_OBBLIGATORIA,
      };
    }

    const quantita = getNumeroDecimale(
      materiale.quantita
    );

    if (quantita === null) {
      return {
        errore:
          RAPPORTI_INTERVENTO_TESTI.ERRORI
            .MATERIALE_QUANTITA_NON_VALIDA,
      };
    }

    const unitaMisura =
      materiale.unita_misura
        .trim()
        .replace(/\s+/g, " ");

    if (!unitaMisura) {
      return {
        errore:
          RAPPORTI_INTERVENTO_TESTI.ERRORI
            .MATERIALE_UNITA_OBBLIGATORIA,
      };
    }

    materialiNormalizzati.push({
      descrizione,
      quantita,
      unita_misura: unitaMisura,
      ordine: index + 1,
    });
  }

  return {
    materiali: materialiNormalizzati,
  };
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
}):
  | { payload: RapportoInterventoInput }
  | { errore: string } {
  if (!form.cantiere_id) {
    return {
      errore:
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .CANTIERE_OBBLIGATORIO,
    };
  }

  if (!form.data_intervento) {
    return {
      errore:
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .DATA_OBBLIGATORIA,
    };
  }

  const cliente =
    form.cliente_committente.trim();

  if (!cliente) {
    return {
      errore:
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .CLIENTE_OBBLIGATORIO,
    };
  }

  const responsabile =
    form.responsabile_nome.trim();

  if (!responsabile) {
    return {
      errore:
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .RESPONSABILE_OBBLIGATORIO,
    };
  }

  const viaggioMinuti = getNumeroIntero(
    form.viaggio_minuti
  );

  if (viaggioMinuti === null) {
    return {
      errore:
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .VIAGGIO_NON_VALIDO,
    };
  }

  if (
    !isFirmaValida(
      form.firma_responsabile_data_url
    ) ||
    !isFirmaValida(
      form.firma_cliente_data_url
    )
  ) {
    return {
      errore:
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .FIRMA_TROPPO_GRANDE,
    };
  }

  const lavorazioniNormalizzate =
    normalizzaLavorazioni(lavorazioni);

  if ("errore" in lavorazioniNormalizzate) {
    return lavorazioniNormalizzate;
  }

  const operatoriNormalizzati =
    normalizzaOperatori(operatori);

  if ("errore" in operatoriNormalizzati) {
    return operatoriNormalizzati;
  }

  const fotoNormalizzate =
    normalizzaFoto(foto);

  if ("errore" in fotoNormalizzate) {
    return fotoNormalizzate;
  }

  const materialiNormalizzati =
    normalizzaMateriali(materiali);

  if ("errore" in materialiNormalizzati) {
    return materialiNormalizzati;
  }

  return {
    payload: {
      cantiere_id: form.cantiere_id,
      data_intervento:
        form.data_intervento,
      cliente_committente: cliente,
      responsabile_nome: responsabile,
      viaggio_minuti: viaggioMinuti,
      diritto_uscita:
        form.diritto_uscita,
      note: form.note.trim(),
      firma_responsabile_data_url:
        form.firma_responsabile_data_url,
      firma_responsabile_nome:
        form.firma_responsabile_data_url
          ? form.firma_responsabile_nome.trim() ||
            responsabile
          : null,
      firma_cliente_data_url:
        form.firma_cliente_data_url,
      firma_cliente_nome:
        form.firma_cliente_data_url
          ? form.firma_cliente_nome.trim() ||
            cliente
          : null,
      lavorazioni:
        lavorazioniNormalizzate.lavorazioni,
      operatori:
        operatoriNormalizzati.operatori,
      foto: fotoNormalizzate.foto,
      materiali:
        materialiNormalizzati.materiali,
    },
  };
}

export default function BackofficeRapportiInterventoPage() {
  const [cantieri, setCantieri] = useState<
    CantiereBackoffice[]
  >([]);
  const [dipendenti, setDipendenti] =
    useState<Dipendente[]>([]);
  const [rapporti, setRapporti] = useState<
    RapportoIntervento[]
  >([]);
  const [form, setForm] =
    useState<RapportoForm>(FORM_INIZIALE);
  const [lavorazioni, setLavorazioni] =
    useState<LavorazioneForm[]>([]);
  const [operatori, setOperatori] =
    useState<OperatoreForm[]>([]);
  const [foto, setFoto] = useState<
    FotoForm[]
  >([]);
  const [materiali, setMateriali] =
    useState<MaterialeForm[]>([]);
  const [
    rapportoInModificaId,
    setRapportoInModificaId,
  ] = useState<string | null>(null);
  const [readonly, setReadonly] =
    useState(false);
  const [loading, setLoading] =
    useState(true);
  const [utenteAdmin, setUtenteAdmin] =
    useState(false);
  const [loadingSnapshot, setLoadingSnapshot] =
    useState(false);
  const [salvataggio, setSalvataggio] =
    useState(false);
  const [pdfId, setPdfId] = useState<
    string | null
  >(null);
  const [errore, setErrore] = useState<
    string | null
  >(null);
  const [messaggio, setMessaggio] =
    useState<string | null>(null);

  const oreUomoRealiMinuti = useMemo(
    () =>
      operatori.reduce(
        (totale, operatore) =>
          totale +
          (parseOreMinutiInput(
            operatore.ore_input
          ) || 0),
        0
      ),
    [operatori]
  );

  const viaggioMinuti =
    getNumeroIntero(form.viaggio_minuti) || 0;
  const calcolo = calcolaOreFatturabili({
    oreUomoRealiMinuti,
    viaggioMinuti,
  });
  const caricaDati = useCallback(async () => {
    try {
      setLoading(true);
      setErrore(null);

      const [
        cantieriData,
        dipendentiData,
        rapportiData,
      ] = await Promise.all([
        loadCantieriBackoffice(),
        loadDipendentiAttivi(),
        loadRapportiIntervento(),
      ]);

      setCantieri(cantieriData);
      setDipendenti(dipendentiData);
      setRapporti(rapportiData);
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setLoading(false);
    }
  }, []);
  const dipendentiPerRicerca = useMemo(() => {
    const dipendentiMap =
      new Map<string, Dipendente>();

    for (const dipendente of dipendenti) {
      dipendentiMap.set(
        getLabelDipendente(dipendente),
        dipendente
      );
      dipendentiMap.set(
        dipendente.email,
        dipendente
      );
    }

    return dipendentiMap;
  }, [dipendenti]);

  useEffect(() => {
    let attivo = true;

    const verificaRuolo = async () => {
      try {
        const user = await loadUtenteAuth();
        const adminCorrente = user?.email
          ? await isAdmin(user.email)
          : false;

        if (attivo) {
          setUtenteAdmin(adminCorrente);
        }
      } catch (error: unknown) {
        console.error(
          "Errore verifica ruolo rapporti intervento",
          error
        );

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

    const caricaDatiIniziali =
      async () => {
        try {
          const [
            cantieriData,
            dipendentiData,
            rapportiData,
          ] = await Promise.all([
            loadCantieriBackoffice(),
            loadDipendentiAttivi(),
            loadRapportiIntervento(),
          ]);

          if (!attivo) {
            return;
          }

          setCantieri(cantieriData);
          setDipendenti(dipendentiData);
          setRapporti(rapportiData);
        } catch (error: unknown) {
          if (attivo) {
            setErrore(
              getMessaggioErrore(error)
            );
          }
        } finally {
          if (attivo) {
            setLoading(false);
          }
        }
      };

    void caricaDatiIniziali();

    return () => {
      attivo = false;
    };
  }, []);

  const resetForm = ({
    mantieniMessaggio = false,
  }: {
    mantieniMessaggio?: boolean;
  } = {}) => {
    setForm(FORM_INIZIALE);
    setLavorazioni([]);
    setOperatori([]);
    setFoto([]);
    setMateriali([]);
    setRapportoInModificaId(null);
    setReadonly(false);
    setErrore(null);
    if (!mantieniMessaggio) {
      setMessaggio(null);
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
    field:
      | "descrizione_snapshot"
      | "ore_uomo_input";
    value: string;
  }) => {
    setLavorazioni((lavorazioniCorrenti) =>
      lavorazioniCorrenti.map(
        (lavorazione) => {
          if (lavorazione.localId !== localId) {
            return lavorazione;
          }

          const minuti =
            field === "ore_uomo_input"
              ? parseOreMinutiInput(value)
              : null;

          return {
            ...lavorazione,
            [field]: value,
            ore_uomo_minuti:
              field === "ore_uomo_input"
                ? minuti || 0
                : lavorazione.ore_uomo_minuti,
          };
        }
      )
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
        ordine:
          lavorazioniCorrenti.length + 1,
      },
    ]);
  };

  const rimuoviLavorazione = (
    localId: string
  ) => {
    setLavorazioni((lavorazioniCorrenti) =>
      lavorazioniCorrenti.filter(
        (lavorazione) =>
          lavorazione.localId !== localId
      )
    );
  };

  const getDipendenteDaRicerca = (
    ricerca: string
  ) =>
    dipendentiPerRicerca.get(ricerca) || null;

  const aggiungiOperatore = () => {
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
  };

  const handleOperatoreChange = ({
    localId,
    ricerca,
  }: {
    localId: string;
    ricerca: string;
  }) => {
    const dipendente =
      getDipendenteDaRicerca(ricerca);

    setOperatori((operatoriCorrenti) =>
      operatoriCorrenti.map((operatore) => {
        if (operatore.localId !== localId) {
          return operatore;
        }

        const nextDipendenteId =
          dipendente?.id || null;
        const nextNomeSnapshot = dipendente
          ? getNomeDipendente(dipendente)
          : "";
        const nextEmailSnapshot =
          dipendente?.email || null;

        if (
          operatore.ricerca_operatore === ricerca &&
          operatore.dipendente_id ===
            nextDipendenteId &&
          operatore.nome_snapshot ===
            nextNomeSnapshot &&
          operatore.email_snapshot ===
            nextEmailSnapshot
        ) {
          return operatore;
        }

        return {
          ...operatore,
          dipendente_id: nextDipendenteId,
          nome_snapshot: nextNomeSnapshot,
          email_snapshot: nextEmailSnapshot,
          ricerca_operatore: ricerca,
        };
      })
    );
  };

  const handleOreOperatoreChange = ({
    localId,
    value,
  }: {
    localId: string;
    value: string;
  }) => {
    setOperatori((operatoriCorrenti) =>
      operatoriCorrenti.map((operatore) => {
        if (operatore.localId !== localId) {
          return operatore;
        }

        const minuti =
          parseOreMinutiInput(value);

        return {
          ...operatore,
          ore_input: value,
          ore_minuti: minuti || 0,
        };
      })
    );
  };

  const rimuoviOperatore = (
    localId: string
  ) => {
    setOperatori((operatoriCorrenti) =>
      operatoriCorrenti.filter(
        (operatore) =>
          operatore.localId !== localId
      )
    );
  };

  const leggiFileComeDataUrl = (
    file: File
  ) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }

        reject(
          new Error(
            RAPPORTI_INTERVENTO_TESTI.ERRORI
              .FOTO_NON_VALIDA
          )
        );
      };

      reader.onerror = () => {
        reject(
          new Error(
            RAPPORTI_INTERVENTO_TESTI.ERRORI
              .FOTO_NON_VALIDA
          )
        );
      };

      reader.readAsDataURL(file);
    });

  const handleFotoChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(
      event.target.files || []
    );

    if (files.length === 0) {
      return;
    }

    try {
      const fotoDataUrl = await Promise.all(
        files.map(async (file) => {
          if (!file.type.startsWith("image/")) {
            throw new Error(
              RAPPORTI_INTERVENTO_TESTI.ERRORI
                .FOTO_NON_VALIDA
            );
          }

          return leggiFileComeDataUrl(file);
        })
      );

      const nuoveFoto = fotoDataUrl.map(
        (immagineDataUrl, index) => ({
          localId: getLocalId(),
          immagine_data_url: immagineDataUrl,
          descrizione: "",
          ordine: foto.length + index + 1,
        })
      );

      setFoto((fotoCorrenti) => [
        ...fotoCorrenti,
        ...nuoveFoto,
      ]);
      event.target.value = "";
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
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
        immagine.localId === localId
          ? {
              ...immagine,
              descrizione,
            }
          : immagine
      )
    );
  };

  const rimuoviFoto = (localId: string) => {
    setFoto((fotoCorrenti) =>
      fotoCorrenti.filter(
        (immagine) =>
          immagine.localId !== localId
      )
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
        ordine:
          materialiCorrenti.length + 1,
      },
    ]);
  };

  const handleMaterialeChange = ({
    localId,
    field,
    value,
  }: {
    localId: string;
    field:
      | "descrizione"
      | "quantita"
      | "unita_misura";
    value: string;
  }) => {
    setMateriali((materialiCorrenti) =>
      materialiCorrenti.map((materiale) =>
        materiale.localId === localId
          ? {
              ...materiale,
              [field]: value,
            }
          : materiale
      )
    );
  };

  const rimuoviMateriale = (
    localId: string
  ) => {
    setMateriali((materialiCorrenti) =>
      materialiCorrenti.filter(
        (materiale) =>
          materiale.localId !== localId
      )
    );
  };

  const caricaSnapshot = async () => {
    if (!form.cantiere_id) {
      setErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .CANTIERE_OBBLIGATORIO
      );
      return;
    }

    if (!form.data_intervento) {
      setErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .DATA_OBBLIGATORIA
      );
      return;
    }

    try {
      setLoadingSnapshot(true);
      setErrore(null);
      setMessaggio(null);

      const snapshot =
        await loadLavorazioniRapportoIntervento({
          cantiereId: form.cantiere_id,
          dataIntervento:
            form.data_intervento,
        });

      setLavorazioni(
        snapshot.map((lavorazione) => ({
          ...lavorazione,
          localId: getLocalId(),
          ore_uomo_input:
            formatMinutiOreInput(
              lavorazione.ore_uomo_minuti
            ),
        }))
      );
      setMessaggio(
        RAPPORTI_INTERVENTO_TESTI.MESSAGGI
          .SNAPSHOT_CARICATO
      );
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const caricaRapportoInForm = async (
    rapporto: RapportoIntervento
  ) => {
    try {
      setErrore(null);
      setMessaggio(null);

      const rapportoCompleto =
        await loadRapportoIntervento(
          rapporto.id
        );

      if (!rapportoCompleto) {
        throw new Error(
          RAPPORTI_INTERVENTO_TESTI.ERRORI
            .RAPPORTO_NON_TROVATO
        );
      }

      setRapportoInModificaId(
        rapportoCompleto.id
      );
      setReadonly(
        rapportoCompleto.stato ===
          RAPPORTI_INTERVENTO_STATI.FIRMATO
      );
      setForm({
        cantiere_id:
          rapportoCompleto.cantiere_id,
        data_intervento:
          rapportoCompleto.data_intervento,
        cliente_committente:
          rapportoCompleto.cliente_committente,
        responsabile_nome:
          rapportoCompleto.responsabile_nome,
        viaggio_minuti: String(
          rapportoCompleto.viaggio_minuti
        ),
        diritto_uscita:
          rapportoCompleto.diritto_uscita,
        note: rapportoCompleto.note,
        firma_responsabile_data_url:
          rapportoCompleto.firma_responsabile_data_url,
        firma_responsabile_nome:
          rapportoCompleto.firma_responsabile_nome ||
          "",
        firma_cliente_data_url:
          rapportoCompleto.firma_cliente_data_url,
        firma_cliente_nome:
          rapportoCompleto.firma_cliente_nome ||
          "",
      });
      setLavorazioni(
        rapportoCompleto.lavorazioni.map(
          (lavorazione) => ({
            localId: getLocalId(),
            lavorazione_id:
              lavorazione.lavorazione_id,
            descrizione_snapshot:
              lavorazione.descrizione_snapshot,
            ore_uomo_minuti:
              lavorazione.ore_uomo_minuti,
            ore_uomo_input:
              formatMinutiOreInput(
                lavorazione.ore_uomo_minuti
              ),
            ordine: lavorazione.ordine,
          })
        )
      );
      setOperatori(
        rapportoCompleto.operatori.map(
          (operatore) => ({
            localId: getLocalId(),
            dipendente_id:
              operatore.dipendente_id,
            nome_snapshot:
              operatore.nome_snapshot,
            email_snapshot:
              operatore.email_snapshot,
            ricerca_operatore:
              operatore.email_snapshot
                ? `${operatore.nome_snapshot} - ${operatore.email_snapshot}`
                : operatore.nome_snapshot,
            ore_minuti:
              operatore.ore_minuti,
            ore_input:
              formatMinutiOreInput(
                operatore.ore_minuti
              ),
            ordine: operatore.ordine,
          })
        )
      );
      setFoto(
        rapportoCompleto.foto.map(
          (immagine) => ({
            localId: getLocalId(),
            immagine_data_url:
              immagine.immagine_data_url,
            descrizione:
              immagine.descrizione,
            ordine: immagine.ordine,
          })
        )
      );
      setMateriali(
        rapportoCompleto.materiali.map(
          (materiale) => ({
            localId: getLocalId(),
            descrizione:
              materiale.descrizione,
            quantita: String(
              materiale.quantita
            ),
            unita_misura:
              materiale.unita_misura,
            ordine: materiale.ordine,
          })
        )
      );
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (readonly) {
      return;
    }

    const preparazione = preparaPayload({
      form,
      lavorazioni,
      operatori,
      foto,
      materiali,
    });

    if ("errore" in preparazione) {
      setErrore(preparazione.errore);
      return;
    }

    try {
      setSalvataggio(true);
      setErrore(null);
      setMessaggio(null);

      if (rapportoInModificaId) {
        await aggiornaRapportoIntervento({
          rapportoInterventoId:
            rapportoInModificaId,
          rapporto: preparazione.payload,
        });
        setMessaggio(
          RAPPORTI_INTERVENTO_TESTI.MESSAGGI
            .AGGIORNATO
        );
      } else {
        await creaRapportoIntervento(
          preparazione.payload
        );
        setMessaggio(
          RAPPORTI_INTERVENTO_TESTI.MESSAGGI
            .CREATO
        );
      }

      await caricaDati();
      resetForm({
        mantieniMessaggio: true,
      });
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setSalvataggio(false);
    }
  };

  const handlePdf = async (
    rapportoInterventoId: string
  ) => {
    try {
      setPdfId(rapportoInterventoId);
      setErrore(null);

      const pdf =
        await fetchRapportoInterventoPdf(
          rapportoInterventoId
        );

      scaricaBlobPdf(pdf);
    } catch (error: unknown) {
      setErrore(getMessaggioErrore(error));
    } finally {
      setPdfId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {RAPPORTI_INTERVENTO_TESTI.TITOLO}
            </h1>
          </div>

          <div className="flex gap-4 text-sm font-semibold">
            {utenteAdmin && (
              <Link
                href={APP_ROUTES.BACKOFFICE}
                className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
              >
                {RAPPORTI_INTERVENTO_TESTI.BACKOFFICE}
              </Link>
            )}
            <Link
              href={APP_ROUTES.HOME}
              className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange active:border-industrial-orange-active active:bg-industrial-orange-active active:text-white"
            >
              {RAPPORTI_INTERVENTO_TESTI.TIMBRATURE}
            </Link>
          </div>
        </div>

        {errore && (
          <p className="mb-4 rounded-lg bg-industrial-danger-bg p-4 text-sm text-industrial-danger-text">
            {errore}
          </p>
        )}

        {messaggio && (
          <p className="mb-4 rounded-lg bg-industrial-success-bg p-4 text-sm text-industrial-success-text">
            {messaggio}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                {rapportoInModificaId
                  ? readonly
                    ? RAPPORTI_INTERVENTO_TESTI.VISUALIZZA
                    : RAPPORTI_INTERVENTO_TESTI.MODIFICA
                  : RAPPORTI_INTERVENTO_TESTI.NUOVO}
              </h2>

              <button
                type="button"
                onClick={() => resetForm()}
                className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
              >
                {RAPPORTI_INTERVENTO_TESTI.NUOVO}
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid gap-5"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-industrial-muted">
                    {
                      RAPPORTI_INTERVENTO_TESTI.CANTIERE
                    }
                  </span>
                  <select
                    value={form.cantiere_id}
                    onChange={(
                      event: ChangeEvent<HTMLSelectElement>
                    ) =>
                      handleFormChange(
                        "cantiere_id",
                        event.target.value
                      )
                    }
                    disabled={readonly}
                    className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                  >
                    <option value="">
                      {
                        RAPPORTI_INTERVENTO_TESTI.SELEZIONA_CANTIERE
                      }
                    </option>
                    {cantieri.map((cantiere) => (
                      <option
                        key={cantiere.id}
                        value={cantiere.id}
                      >
                        {cantiere.nome}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-industrial-muted">
                    {
                      RAPPORTI_INTERVENTO_TESTI.DATA_INTERVENTO
                    }
                  </span>
                  <input
                    type="date"
                    value={form.data_intervento}
                    onChange={(event) =>
                      handleFormChange(
                        "data_intervento",
                        event.target.value
                      )
                    }
                    disabled={readonly}
                    className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-industrial-muted">
                    {
                      RAPPORTI_INTERVENTO_TESTI.CLIENTE_COMMITTENTE
                    }
                  </span>
                  <input
                    type="text"
                    value={
                      form.cliente_committente
                    }
                    onChange={(event) =>
                      handleFormChange(
                        "cliente_committente",
                        event.target.value
                      )
                    }
                    disabled={readonly}
                    className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-industrial-muted">
                    {
                      RAPPORTI_INTERVENTO_TESTI.RESPONSABILE_NOME
                    }
                  </span>
                  <input
                    type="text"
                    value={form.responsabile_nome}
                    onChange={(event) =>
                      handleFormChange(
                        "responsabile_nome",
                        event.target.value
                      )
                    }
                    disabled={readonly}
                    className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-industrial-muted">
                    {
                      RAPPORTI_INTERVENTO_TESTI.VIAGGIO_MINUTI
                    }
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.viaggio_minuti}
                    onChange={(event) =>
                      handleFormChange(
                        "viaggio_minuti",
                        event.target.value
                      )
                    }
                    disabled={readonly}
                    className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                  />
                </label>

                <label className="flex items-center gap-3 self-end rounded-lg border border-industrial-border bg-industrial-control p-3">
                  <input
                    type="checkbox"
                    checked={
                      form.diritto_uscita
                    }
                    onChange={(event) =>
                      handleFormChange(
                        "diritto_uscita",
                        event.target.checked
                      )
                    }
                    disabled={readonly}
                    className="h-5 w-5 accent-industrial-orange"
                  />
                  <span className="text-sm font-medium text-industrial-text">
                    {
                      RAPPORTI_INTERVENTO_TESTI.DIRITTO_USCITA
                    }
                  </span>
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-industrial-muted">
                  {RAPPORTI_INTERVENTO_TESTI.NOTE}
                </span>
                <textarea
                  value={form.note}
                  onChange={(event) =>
                    handleFormChange(
                      "note",
                      event.target.value
                    )
                  }
                  disabled={readonly}
                  rows={4}
                  className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                />
              </label>

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">
                    {
                      RAPPORTI_INTERVENTO_TESTI.OPERATORI
                    }
                  </h3>

                  {!readonly && (
                    <button
                      type="button"
                      onClick={aggiungiOperatore}
                      className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
                    >
                      {
                        RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_OPERATORE
                      }
                    </button>
                  )}
                </div>

                <datalist id="operatori-rapporto-list">
                  {dipendenti.map((dipendente) => (
                    <option
                      key={dipendente.id}
                      value={getLabelDipendente(
                        dipendente
                      )}
                    />
                  ))}
                </datalist>

                {operatori.length === 0 ? (
                  <p className="rounded-lg border border-industrial-border-soft bg-industrial-surface-strong p-4 text-sm text-industrial-muted">
                    {
                      RAPPORTI_INTERVENTO_TESTI.NESSUN_OPERATORE
                    }
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {operatori.map((operatore) => (
                      <div
                        key={operatore.localId}
                        className="grid gap-3 rounded-lg border border-industrial-border-soft bg-industrial-surface-strong p-3 md:grid-cols-[minmax(0,1fr)_140px_auto]"
                      >
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-industrial-muted">
                            {
                              RAPPORTI_INTERVENTO_TESTI.OPERATORE
                            }
                          </span>
                          <input
                            type="text"
                            list="operatori-rapporto-list"
                            value={
                              operatore.ricerca_operatore
                            }
                            onChange={(event) =>
                              handleOperatoreChange(
                                {
                                  localId:
                                    operatore.localId,
                                  ricerca:
                                    event.target.value,
                                }
                              )
                            }
                            placeholder={
                              RAPPORTI_INTERVENTO_TESTI.SELEZIONA_OPERATORE
                            }
                            disabled={readonly}
                            className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-sm text-industrial-text outline-none transition-colors duration-200 ease-out placeholder:text-industrial-muted-strong focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-industrial-muted">
                            {
                              RAPPORTI_INTERVENTO_TESTI.ORE_OPERATORE
                            }
                          </span>
                          <input
                            type="text"
                            value={
                              operatore.ore_input
                            }
                            onChange={(event) =>
                              handleOreOperatoreChange(
                                {
                                  localId:
                                    operatore.localId,
                                  value:
                                    event.target.value,
                                }
                              )
                            }
                            disabled={readonly}
                            className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-sm text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                          />
                          <span className="mt-1 block text-xs text-industrial-muted">
                            {parseOreMinutiInput(
                              operatore.ore_input
                            ) === null
                              ? RAPPORTI_INTERVENTO_TESTI
                                  .ERRORI
                                  .FORMATO_ORE_NON_VALIDO
                              : formatMinutiOre(
                                  parseOreMinutiInput(
                                    operatore.ore_input
                                  ) || 0
                                )}
                          </span>
                        </label>

                        {!readonly && (
                          <button
                            type="button"
                            onClick={() =>
                              rimuoviOperatore(
                                operatore.localId
                              )
                            }
                            className="self-end rounded-lg border border-industrial-danger-border bg-industrial-danger-bg px-3 py-3 text-sm font-semibold text-industrial-danger-text transition-colors duration-200 ease-out hover:border-industrial-danger-text"
                          >
                            {
                              RAPPORTI_INTERVENTO_TESTI.RIMUOVI
                            }
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 rounded-lg border border-industrial-border-soft bg-industrial-bg-soft p-4">
                  <p className="text-sm font-medium text-industrial-muted">
                    {
                      RAPPORTI_INTERVENTO_TESTI.ORE_UOMO_REALI
                    }
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {formatMinutiOre(
                      oreUomoRealiMinuti
                    )}
                  </p>
                </div>
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">
                    {
                      RAPPORTI_INTERVENTO_TESTI.LAVORAZIONI
                    }
                  </h3>

                  {!readonly && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={caricaSnapshot}
                        disabled={loadingSnapshot}
                        className="rounded-lg border border-industrial-orange bg-industrial-orange px-3 py-2 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover disabled:cursor-not-allowed disabled:border-industrial-border disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
                      >
                        {loadingSnapshot
                          ? RAPPORTI_INTERVENTO_TESTI.CARICAMENTO
                          : RAPPORTI_INTERVENTO_TESTI.CARICA_SNAPSHOT}
                      </button>
                      <button
                        type="button"
                        onClick={aggiungiLavorazione}
                        className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
                      >
                        {
                          RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_LAVORAZIONE
                        }
                      </button>
                    </div>
                  )}
                </div>

                {lavorazioni.length === 0 ? (
                  <p className="rounded-lg border border-industrial-border-soft bg-industrial-surface-strong p-4 text-sm text-industrial-muted">
                    {
                      RAPPORTI_INTERVENTO_TESTI.NESSUNA_LAVORAZIONE
                    }
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {lavorazioni.map(
                      (lavorazione) => (
                        <div
                          key={lavorazione.localId}
                          className="grid gap-3 rounded-lg border border-industrial-border-soft bg-industrial-surface-strong p-3 md:grid-cols-[minmax(0,1fr)_140px_auto]"
                        >
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-industrial-muted">
                              {
                                RAPPORTI_INTERVENTO_TESTI.DESCRIZIONE
                              }
                            </span>
                            <input
                              type="text"
                              value={
                                lavorazione.descrizione_snapshot
                              }
                              onChange={(event) =>
                                handleLavorazioneChange(
                                  {
                                    localId:
                                      lavorazione.localId,
                                    field:
                                      "descrizione_snapshot",
                                    value:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                              disabled={readonly}
                              className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-sm text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                            />
                          </label>

                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-industrial-muted">
                              {
                                RAPPORTI_INTERVENTO_TESTI.ORE_UOMO_MINUTI
                              }
                            </span>
                            <input
                              type="text"
                              value={
                                lavorazione.ore_uomo_input
                              }
                              onChange={(event) =>
                                handleLavorazioneChange(
                                  {
                                    localId:
                                      lavorazione.localId,
                                    field:
                                      "ore_uomo_input",
                                    value:
                                      event
                                        .target
                                        .value,
                                  }
                                )
                              }
                              disabled={readonly}
                              className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-sm text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                            />
                            <span className="mt-1 block text-xs text-industrial-muted">
                              {parseOreMinutiInput(
                                lavorazione.ore_uomo_input
                              ) === null
                                ? RAPPORTI_INTERVENTO_TESTI
                                    .ERRORI
                                    .FORMATO_ORE_NON_VALIDO
                                : formatMinutiOre(
                                    parseOreMinutiInput(
                                      lavorazione.ore_uomo_input
                                    ) || 0
                                  )}
                            </span>
                          </label>

                          {!readonly && (
                            <button
                              type="button"
                              onClick={() =>
                                rimuoviLavorazione(
                                  lavorazione.localId
                                )
                              }
                              className="self-end rounded-lg border border-industrial-danger-border bg-industrial-danger-bg px-3 py-3 text-sm font-semibold text-industrial-danger-text transition-colors duration-200 ease-out hover:border-industrial-danger-text"
                            >
                              {
                                RAPPORTI_INTERVENTO_TESTI.RIMUOVI
                              }
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">
                    {
                      RAPPORTI_INTERVENTO_TESTI.MATERIALI
                    }
                  </h3>

                  {!readonly && (
                    <button
                      type="button"
                      onClick={aggiungiMateriale}
                      className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
                    >
                      {
                        RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_MATERIALE
                      }
                    </button>
                  )}
                </div>

                {materiali.length === 0 ? (
                  <p className="rounded-lg border border-industrial-border-soft bg-industrial-surface-strong p-4 text-sm text-industrial-muted">
                    {
                      RAPPORTI_INTERVENTO_TESTI.NESSUN_MATERIALE
                    }
                  </p>
                ) : (
                  <div className="grid gap-3">
                    {materiali.map((materiale) => (
                      <div
                        key={materiale.localId}
                        className="grid gap-3 rounded-lg border border-industrial-border-soft bg-industrial-surface-strong p-3 md:grid-cols-[minmax(0,1fr)_120px_120px_auto]"
                      >
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-industrial-muted">
                            {
                              RAPPORTI_INTERVENTO_TESTI.DESCRIZIONE
                            }
                          </span>
                          <input
                            type="text"
                            value={
                              materiale.descrizione
                            }
                            onChange={(event) =>
                              handleMaterialeChange(
                                {
                                  localId:
                                    materiale.localId,
                                  field:
                                    "descrizione",
                                  value:
                                    event.target.value,
                                }
                              )
                            }
                            disabled={readonly}
                            className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-sm text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-industrial-muted">
                            {
                              RAPPORTI_INTERVENTO_TESTI.QUANTITA
                            }
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={materiale.quantita}
                            onChange={(event) =>
                              handleMaterialeChange(
                                {
                                  localId:
                                    materiale.localId,
                                  field: "quantita",
                                  value:
                                    event.target.value,
                                }
                              )
                            }
                            disabled={readonly}
                            className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-sm text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-industrial-muted">
                            {
                              RAPPORTI_INTERVENTO_TESTI.UNITA_MISURA
                            }
                          </span>
                          <input
                            type="text"
                            value={
                              materiale.unita_misura
                            }
                            onChange={(event) =>
                              handleMaterialeChange(
                                {
                                  localId:
                                    materiale.localId,
                                  field:
                                    "unita_misura",
                                  value:
                                    event.target.value,
                                }
                              )
                            }
                            disabled={readonly}
                            className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-sm text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                          />
                        </label>

                        {!readonly && (
                          <button
                            type="button"
                            onClick={() =>
                              rimuoviMateriale(
                                materiale.localId
                              )
                            }
                            className="self-end rounded-lg border border-industrial-danger-border bg-industrial-danger-bg px-3 py-3 text-sm font-semibold text-industrial-danger-text transition-colors duration-200 ease-out hover:border-industrial-danger-text"
                          >
                            {
                              RAPPORTI_INTERVENTO_TESTI.RIMUOVI
                            }
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">
                    {
                      RAPPORTI_INTERVENTO_TESTI.FOTO
                    }
                  </h3>

                  {!readonly && (
                    <label className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange">
                      {
                        RAPPORTI_INTERVENTO_TESTI.AGGIUNGI_FOTO
                      }
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) =>
                          void handleFotoChange(event)
                        }
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {foto.length === 0 ? (
                  <p className="rounded-lg border border-industrial-border-soft bg-industrial-surface-strong p-4 text-sm text-industrial-muted">
                    {
                      RAPPORTI_INTERVENTO_TESTI.NESSUNA_FOTO
                    }
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {foto.map((immagine) => (
                      <div
                        key={immagine.localId}
                        className="rounded-lg border border-industrial-border-soft bg-industrial-surface-strong p-3"
                      >
                        <Image
                          src={
                            immagine.immagine_data_url
                          }
                          alt={
                            immagine.descrizione ||
                            RAPPORTI_INTERVENTO_TESTI.FOTO
                          }
                          width={640}
                          height={480}
                          unoptimized
                          className="aspect-[4/3] w-full rounded-lg border border-industrial-border object-cover"
                        />

                        <label className="mt-3 block">
                          <span className="mb-1 block text-xs font-medium text-industrial-muted">
                            {
                              RAPPORTI_INTERVENTO_TESTI.DESCRIZIONE_FOTO
                            }
                          </span>
                          <input
                            type="text"
                            value={
                              immagine.descrizione
                            }
                            onChange={(event) =>
                              handleDescrizioneFotoChange(
                                {
                                  localId:
                                    immagine.localId,
                                  descrizione:
                                    event.target.value,
                                }
                              )
                            }
                            disabled={readonly}
                            className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-sm text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                          />
                        </label>

                        {!readonly && (
                          <button
                            type="button"
                            onClick={() =>
                              rimuoviFoto(
                                immagine.localId
                              )
                            }
                            className="mt-3 w-full rounded-lg border border-industrial-danger-border bg-industrial-danger-bg px-3 py-3 text-sm font-semibold text-industrial-danger-text transition-colors duration-200 ease-out hover:border-industrial-danger-text"
                          >
                            {
                              RAPPORTI_INTERVENTO_TESTI.RIMUOVI
                            }
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section
                className={`grid gap-4 rounded-lg border border-industrial-border-soft bg-industrial-bg-soft p-4 ${utenteAdmin ? "md:grid-cols-3" : ""}`}
              >
                <div>
                  <p className="text-sm font-medium text-industrial-muted">
                    {
                      RAPPORTI_INTERVENTO_TESTI.ORE_UOMO_REALI
                    }
                  </p>
                  <p className="mt-2 text-2xl font-bold">
                    {formatMinutiOre(
                      oreUomoRealiMinuti
                    )}
                  </p>
                </div>

                {utenteAdmin && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-industrial-muted">
                        {
                          RAPPORTI_INTERVENTO_TESTI.REGOLA_FATTURAZIONE
                        }
                      </p>
                      <p className="mt-2 text-lg font-semibold">
                        {
                          LABEL_REGOLE_FATTURAZIONE_INTERVENTO[
                            calcolo
                              .regola_fatturazione
                          ]
                        }
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-industrial-muted">
                        {
                          RAPPORTI_INTERVENTO_TESTI.ORE_FATTURABILI
                        }
                      </p>
                      <p className="mt-2 text-2xl font-bold">
                        {formatMinutiOre(
                          calcolo.ore_fatturabili_minuti
                        )}
                      </p>
                    </div>
                  </>
                )}
              </section>

              <section className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-3">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-industrial-muted">
                      {
                        RAPPORTI_INTERVENTO_TESTI.NOME_FIRMA_RESPONSABILE
                      }
                    </span>
                    <input
                      type="text"
                      value={
                        form.firma_responsabile_nome
                      }
                      onChange={(event) =>
                        handleFormChange(
                          "firma_responsabile_nome",
                          event.target.value
                        )
                      }
                      disabled={readonly}
                      className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                    />
                  </label>
                  <FirmaCanvas
                    label={
                      RAPPORTI_INTERVENTO_TESTI.FIRMA_RESPONSABILE
                    }
                    clearLabel={
                      RAPPORTI_INTERVENTO_TESTI.CANCELLA_FIRMA
                    }
                    value={
                      form.firma_responsabile_data_url
                    }
                    disabled={readonly}
                    onChange={(value) =>
                      handleFormChange(
                        "firma_responsabile_data_url",
                        value
                      )
                    }
                  />
                </div>

                <div className="grid gap-3">
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-industrial-muted">
                      {
                        RAPPORTI_INTERVENTO_TESTI.NOME_FIRMA_CLIENTE
                      }
                    </span>
                    <input
                      type="text"
                      value={
                        form.firma_cliente_nome
                      }
                      onChange={(event) =>
                        handleFormChange(
                          "firma_cliente_nome",
                          event.target.value
                        )
                      }
                      disabled={readonly}
                      className="w-full rounded-lg border border-industrial-border bg-industrial-control p-3 text-industrial-text outline-none transition-colors duration-200 ease-out focus:border-industrial-orange disabled:bg-industrial-surface-strong"
                    />
                  </label>
                  <FirmaCanvas
                    label={
                      RAPPORTI_INTERVENTO_TESTI.FIRMA_CLIENTE
                    }
                    clearLabel={
                      RAPPORTI_INTERVENTO_TESTI.CANCELLA_FIRMA
                    }
                    value={
                      form.firma_cliente_data_url
                    }
                    disabled={readonly}
                    onChange={(value) =>
                      handleFormChange(
                        "firma_cliente_data_url",
                        value
                      )
                    }
                  />
                </div>
              </section>

              {!readonly && (
                <button
                  type="submit"
                  disabled={salvataggio}
                  className="rounded-lg border border-industrial-orange bg-industrial-orange px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover disabled:cursor-not-allowed disabled:border-industrial-border disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
                >
                  {salvataggio
                    ? RAPPORTI_INTERVENTO_TESTI.SALVATAGGIO
                    : RAPPORTI_INTERVENTO_TESTI.SALVA}
                </button>
              )}
            </form>
          </section>

          <aside className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 shadow-[0_12px_28px_rgb(36_38_43/0.08)]">
            <h2 className="mb-4 text-xl font-semibold">
              {RAPPORTI_INTERVENTO_TESTI.LISTA}
            </h2>

            {loading ? (
              <p className="text-industrial-muted">
                {
                  RAPPORTI_INTERVENTO_TESTI.CARICAMENTO
                }
              </p>
            ) : rapporti.length === 0 ? (
              <p className="rounded-lg border border-industrial-border-soft bg-industrial-surface-strong p-4 text-sm text-industrial-muted">
                {
                  RAPPORTI_INTERVENTO_TESTI.NESSUN_RAPPORTO
                }
              </p>
            ) : (
              <ul className="grid gap-3">
                {rapporti.map((rapporto) => (
                  <li
                    key={rapporto.id}
                    className="rounded-lg border border-industrial-border-soft bg-industrial-surface-strong p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {
                            rapporto.cantiere_nome_snapshot
                          }
                        </p>
                        <p className="mt-1 text-sm text-industrial-muted">
                          {formattaData(
                            rapporto.data_intervento
                          )}
                        </p>
                        <p className="mt-1 text-sm text-industrial-muted">
                          {
                            rapporto.cliente_committente
                          }
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatoClassName(
                          rapporto.stato
                        )}`}
                      >
                        {
                          LABEL_STATI_RAPPORTO_INTERVENTO[
                            rapporto.stato
                          ]
                        }
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-industrial-muted">
                      <span>
                        {
                          RAPPORTI_INTERVENTO_TESTI.ORE_UOMO_REALI
                        }
                      </span>
                      <span className="text-right font-semibold text-industrial-text">
                        {formatMinutiOre(
                          rapporto.ore_uomo_reali_minuti
                        )}
                      </span>
                      {utenteAdmin && (
                        <>
                          <span>
                            {
                              RAPPORTI_INTERVENTO_TESTI.ORE_FATTURABILI
                            }
                          </span>
                          <span className="text-right font-semibold text-industrial-text">
                            {formatMinutiOre(
                              rapporto.ore_fatturabili_minuti
                            )}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void caricaRapportoInForm(
                            rapporto
                          )
                        }
                        className="rounded-lg border border-industrial-border bg-industrial-control px-3 py-2 text-sm font-semibold text-industrial-text transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
                      >
                        {rapporto.stato ===
                        RAPPORTI_INTERVENTO_STATI.FIRMATO
                          ? RAPPORTI_INTERVENTO_TESTI.VISUALIZZA
                          : RAPPORTI_INTERVENTO_TESTI.FIRMA}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handlePdf(
                            rapporto.id
                          )
                        }
                        disabled={pdfId === rapporto.id}
                        className="rounded-lg border border-industrial-orange bg-industrial-orange px-3 py-2 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:border-industrial-orange-hover hover:bg-industrial-orange-hover disabled:cursor-not-allowed disabled:border-industrial-border disabled:bg-industrial-surface-strong disabled:text-industrial-muted-strong"
                      >
                        {pdfId === rapporto.id
                          ? RAPPORTI_INTERVENTO_TESTI.CARICAMENTO
                          : RAPPORTI_INTERVENTO_TESTI.GENERA_PDF}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
