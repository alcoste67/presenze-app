"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  isAuthError,
  type AuthChangeEvent,
  type User,
} from "@supabase/supabase-js";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  History,
  Pause,
  Repeat,
} from "lucide-react";

import {
  AUTH_ERROR_CODES,
  AUTH_HTTP_STATUS,
  AUTH_OTP,
  AUTH_TESTI,
} from "@/constants/auth";
import { LAVORAZIONI_LIMITI } from "@/constants/lavorazioni";
import { RAPPORTI_INTERVENTO_TESTI } from "@/constants/rapportiIntervento";
import { APP_ROUTES } from "@/constants/routes";
import {
  STATI,
  TIMBRATURE,
  TIMBRATURE_TESTI,
} from "@/constants/stati";
import { TIMBRATURE_LAVORAZIONI_TESTI } from "@/constants/timbratureLavorazioni";
import { TipoAttivita } from "@/types/attivita";
import type { LavorazioneCantiere } from "@/types/lavorazioni";
import {
  type StatoLavoratore,
  TipoTimbratura,
} from "@/types/timbrature";
import type { TimbraturaLavorazioneInput } from "@/types/timbratureLavorazioni";

import { ascoltaSessioneAuth } from "@/services/auth/ascoltaSessioneAuth";
import { esciAuth } from "@/services/auth/esciAuth";
import { inviaCodiceOtp } from "@/services/auth/inviaCodiceOtp";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { verificaCodiceOtp } from "@/services/auth/verificaCodiceOtp";
import { loadCantieri } from "@/services/cantieri/loadCantieri";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isDipendenteAttivo } from "@/services/dipendenti/isDipendenteAttivo";
import {
  loadDipendenteByUserId,
  type DipendenteBase,
} from "@/services/dipendenti/loadDipendenteByUserId";
import { loadLavorazioniAttiveCantiere } from "@/services/lavorazioni/loadLavorazioniAttiveCantiere";

import { useTimbrature } from "@/hooks/useTimbrature";

import { SelectAttivita } from "@/components/attivita/SelectAttivita";
import { SelectCantiere } from "@/components/cantieri/SelectCantiere";
import { AppHeader } from "@/components/ui/AppHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Cantiere = {
  id: string;
  nome: string;
};

type PercentualiLavorazioniUscita = Record<string, string>;

type TipoDialogLavorazioni =
  | typeof TIMBRATURE.USCITA
  | typeof TIMBRATURE.CAMBIO_CANTIERE;

// ─── Local constants ──────────────────────────────────────────────────────────

const STATO_DOT: Record<StatoLavoratore, string> = {
  [STATI.FUORI]: "bg-text-subtle",
  [STATI.DENTRO]: "bg-success-500",
  [STATI.IN_PAUSA]: "bg-warning-500",
};

const STATO_LABEL_COLOR: Record<StatoLavoratore, string> = {
  [STATI.FUORI]: "text-text-muted",
  [STATI.DENTRO]: "text-success-500",
  [STATI.IN_PAUSA]: "text-warning-500",
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function isErroreRateLimitAuth(error: unknown): boolean {
  return (
    isAuthError(error) &&
    (error.status === AUTH_HTTP_STATUS.TROPPE_RICHIESTE ||
      error.code === AUTH_ERROR_CODES.OVER_REQUEST_RATE_LIMIT ||
      error.code === AUTH_ERROR_CODES.OVER_EMAIL_SEND_RATE_LIMIT)
  );
}

function getMessaggioErroreAuth(error: unknown) {
  if (isErroreRateLimitAuth(error)) {
    return AUTH_TESTI.ERRORI.RATE_LIMIT;
  }

  if (isAuthError(error)) {
    if (
      error.code === AUTH_ERROR_CODES.OTP_EXPIRED ||
      error.code === AUTH_ERROR_CODES.INVALID_CREDENTIALS
    ) {
      return AUTH_TESTI.ERRORI.CODICE_NON_VALIDO;
    }

    if (
      error.code === AUTH_ERROR_CODES.USER_NOT_FOUND ||
      error.code === AUTH_ERROR_CODES.EMAIL_ADDRESS_INVALID ||
      error.code === AUTH_ERROR_CODES.EMAIL_ADDRESS_NOT_AUTHORIZED
    ) {
      return AUTH_TESTI.ERRORI.EMAIL_NON_AUTORIZZATA;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return AUTH_TESTI.ERRORI.GENERICO;
}

function formattaCooldownAuth(secondi: number) {
  return `${AUTH_TESTI.COOLDOWN_PREFIX} ${secondi}${AUTH_TESTI.COOLDOWN_SUFFIX}`;
}

// ─── Timbratura helpers ───────────────────────────────────────────────────────

function formattaOra(data: string): string {
  if (!data) return "—";
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data));
}

function getUltimaTimbraturaLabel(
  ultimaTimbratura: { tipo: string; created_at: string } | null
): string {
  if (!ultimaTimbratura) {
    return TIMBRATURE_TESTI.STATO.NESSUNA_TIMBRATURA;
  }

  const tipo =
    ultimaTimbratura.tipo === TIMBRATURE.CAMBIO_CANTIERE
      ? TIMBRATURE_TESTI.STATO.CAMBIO_CANTIERE_LABEL
      : ultimaTimbratura.tipo;

  return `${tipo} ${TIMBRATURE_TESTI.STATO.ULTIMA_TIMBRATURA_ORA} ${formattaOra(ultimaTimbratura.created_at)}`;
}

function getStatoDescrizione(
  stato: StatoLavoratore,
  cantiereName: string | null
): string {
  if (stato === STATI.DENTRO) {
    const desc = TIMBRATURE_TESTI.STATO.DENTRO_DESCRIZIONE;
    return cantiereName ? `${desc} · ${cantiereName}` : desc;
  }
  if (stato === STATI.IN_PAUSA) {
    return TIMBRATURE_TESTI.STATO.IN_PAUSA_DESCRIZIONE;
  }
  return TIMBRATURE_TESTI.STATO.FUORI_DESCRIZIONE;
}

// ─── Local components ─────────────────────────────────────────────────────────

function TimbratureButton({
  label,
  sub,
  loading,
  onClick,
  variant = "primary",
  icon,
}: {
  label: string;
  sub: string;
  loading: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary";
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "flex items-center justify-between gap-4 w-full px-4 py-4 rounded-md",
        "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary"
          ? "bg-brand-500 text-white hover:bg-brand-600"
          : "border border-border bg-bg-card text-text-primary hover:bg-bg-subtle"
      )}
    >
      <span className="min-w-0 text-left">
        <span className="block text-sm font-medium">
          {loading ? TIMBRATURE_TESTI.AZIONI.SALVATAGGIO : label}
        </span>
        <span className="mt-0.5 block text-xs opacity-70">{sub}</span>
      </span>
      <span
        className={cn(
          "shrink-0 flex h-8 w-8 items-center justify-center rounded-full",
          variant === "primary" ? "bg-white/15" : "bg-bg-subtle"
        )}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          icon ?? <ArrowRight className="h-4 w-4" />
        )}
      </span>
    </button>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-subtle rounded-md p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-text-primary truncate">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  // ── Toast ─────────────────────────────────────────────────────────────────

  const toast = useToast();

  // ── State ────────────────────────────────────────────────────────────────

  const [user, setUser] = useState<User | null>(null);

  const [dipendente, setDipendente] = useState<DipendenteBase | null>(null);

  const [cantieri, setCantieri] = useState<Cantiere[]>([]);

  const [cantiereId, setCantiereId] = useState("");

  const [attivitaTipo, setAttivitaTipo] = useState<TipoAttivita | "">("");

  const [lavorazioniUscita, setLavorazioniUscita] = useState<
    LavorazioneCantiere[]
  >([]);

  const [lavorazioniUscitaSelezionate, setLavorazioniUscitaSelezionate] =
    useState<string[]>([]);

  const [
    percentualiLavorazioniUscita,
    setPercentualiLavorazioniUscita,
  ] = useState<PercentualiLavorazioniUscita>({});

  const [cantiereIdUscita, setCantiereIdUscita] = useState<string | null>(null);

  const [cantiereIdNuovoCambio, setCantiereIdNuovoCambio] = useState<
    string | null
  >(null);

  const [tipoDialogLavorazioni, setTipoDialogLavorazioni] =
    useState<TipoDialogLavorazioni | null>(null);

  const [mostraLavorazioniUscita, setMostraLavorazioniUscita] = useState(false);

  const [erroreLavorazioniUscita, setErroreLavorazioniUscita] = useState<
    string | null
  >(null);

  const [inizializzato, setInizializzato] = useState(false);

  const [mostraBackoffice, setMostraBackoffice] = useState(false);

  const [emailLogin, setEmailLogin] = useState("");

  const [codiceOtp, setCodiceOtp] = useState("");

  const [codiceInviato, setCodiceInviato] = useState(false);

  const [loadingInvioCodice, setLoadingInvioCodice] = useState(false);

  const [loadingVerificaCodice, setLoadingVerificaCodice] = useState(false);

  const [erroreAuth, setErroreAuth] = useState<string | null>(null);

  const [messaggioAuth, setMessaggioAuth] = useState<string | null>(null);

  const [cooldownOtp, setCooldownOtp] = useState(0);

  const authUserIdRef = useRef<string | null>(null);
  const authSyncInCorsoRef = useRef(false);

  const loadingAuth = loadingInvioCodice || loadingVerificaCodice;

  // ── Timbrature ───────────────────────────────────────────────────────────

  const {
    ultimaTimbratura,
    statoAttuale,
    loadingTimbratura,
    refreshUltimaTimbratura,
    handleTimbratura,
  } = useTimbrature({
    userId: user?.id || null,
  });

  // ── Derived ──────────────────────────────────────────────────────────────

  const cantiereCorrentiNome =
    cantieri.find((c) => c.id === ultimaTimbratura?.cantiere_id)?.nome ?? null;

  const displayName = dipendente
    ? `${dipendente.nome} ${dipendente.cognome}`
    : user?.email?.split("@")[0] ?? "";

  const ruoloDisplay = dipendente
    ? dipendente.ruolo.charAt(0).toUpperCase() +
      dipendente.ruolo.slice(1).toLowerCase()
    : mostraBackoffice
      ? "Admin"
      : "Dipendente";

  // ── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const refreshMostraBackoffice = async (currentUser: User | null) => {
      if (!currentUser?.email) {
        setMostraBackoffice(false);
        return;
      }

      try {
        const utenteAdmin = await isAdmin(currentUser.email);
        setMostraBackoffice(utenteAdmin);
      } catch (error) {
        console.error("Errore controllo admin", {
          email: currentUser.email,
          error,
        });
        setMostraBackoffice(false);
      }
    };

    const refreshDipendente = async (currentUser: User | null) => {
      if (!currentUser?.id) {
        setDipendente(null);
        return;
      }

      try {
        const data = await loadDipendenteByUserId(currentUser.id);
        setDipendente(data);
      } catch (error) {
        console.error("Errore caricamento dipendente", error);
        setDipendente(null);
      }
    };

    const disconnettiUtenteNonAttivo = async () => {
      setUser(null);
      setDipendente(null);
      setMostraBackoffice(false);
      await refreshUltimaTimbratura(null);
      setErroreAuth(AUTH_TESTI.ERRORI.DIPENDENTE_NON_ATTIVO);
      await esciAuth();
    };

    const sincronizzaUtenteAutenticato = async (
      currentUser: User | null
    ): Promise<User | null> => {
      if (authSyncInCorsoRef.current) {
        return currentUser;
      }

      const nextUserId = currentUser?.id || null;

      if (authUserIdRef.current === nextUserId) {
        return currentUser;
      }

      authSyncInCorsoRef.current = true;
      authUserIdRef.current = nextUserId;

      try {
        if (!currentUser) {
          setUser(null);
          setDipendente(null);
          setMostraBackoffice(false);
          await refreshUltimaTimbratura(null);
          return null;
        }

        if (!currentUser.email) {
          await disconnettiUtenteNonAttivo();
          return null;
        }

        const dipendenteAttivo = await isDipendenteAttivo(currentUser.email);

        if (!dipendenteAttivo) {
          await disconnettiUtenteNonAttivo();
          return null;
        }

        setUser(currentUser);
        await Promise.all([
          refreshMostraBackoffice(currentUser),
          refreshDipendente(currentUser),
          refreshUltimaTimbratura(currentUser.id),
        ]);

        return currentUser;
      } finally {
        authSyncInCorsoRef.current = false;
      }
    };

    const init = async () => {
      try {
        const user = await loadUtenteAuth();
        await sincronizzaUtenteAutenticato(user);

        const cantieriData = await loadCantieri();
        setCantieri(cantieriData);
      } catch (error) {
        console.error(error);
      } finally {
        setInizializzato(true);
      }
    };

    init();

    const subscription = ascoltaSessioneAuth(
      async (event: AuthChangeEvent, session) => {
        const currentUser = session?.user || null;

        if (
          event === "TOKEN_REFRESHED" &&
          currentUser?.id &&
          currentUser.id === authUserIdRef.current
        ) {
          return;
        }

        if (
          event === "INITIAL_SESSION" &&
          currentUser?.id &&
          currentUser.id === authUserIdRef.current
        ) {
          return;
        }

        await sincronizzaUtenteAutenticato(currentUser);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUltimaTimbratura]);

  useEffect(() => {
    if (cooldownOtp <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setCooldownOtp((secondi) => Math.max(secondi - 1, 0));
    }, AUTH_OTP.COOLDOWN_INTERVAL_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldownOtp]);

  // ── Auth handlers ─────────────────────────────────────────────────────────

  const handleEmailLoginChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmailLogin(event.target.value);
    setCodiceOtp("");
    setCodiceInviato(false);
    setCooldownOtp(0);
    setErroreAuth(null);
    setMessaggioAuth(null);
  };

  const handleCodiceOtpChange = (event: ChangeEvent<HTMLInputElement>) => {
    const codiceSoloNumeri = event.target.value
      .replace(/\D/g, "")
      .slice(0, AUTH_OTP.CODICE_LENGTH);

    setCodiceOtp(codiceSoloNumeri);
    setErroreAuth(null);
  };

  const handleInviaCodiceOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emailNormalizzata = emailLogin.trim().toLowerCase();

    if (!emailNormalizzata) {
      setErroreAuth(AUTH_TESTI.ERRORI.EMAIL_OBBLIGATORIA);
      return;
    }

    try {
      setLoadingInvioCodice(true);
      setErroreAuth(null);
      setMessaggioAuth(null);

      const dipendenteAttivo = await isDipendenteAttivo(emailNormalizzata);

      if (!dipendenteAttivo) {
        setErroreAuth(AUTH_TESTI.ERRORI.DIPENDENTE_NON_ATTIVO);
        return;
      }

      await inviaCodiceOtp(emailNormalizzata);

      setEmailLogin(emailNormalizzata);
      setCodiceOtp("");
      setCodiceInviato(true);
      setCooldownOtp(AUTH_OTP.RESEND_COOLDOWN_SECONDS);
      setMessaggioAuth(AUTH_TESTI.CODICE_INVIATO);
    } catch (error: unknown) {
      if (isErroreRateLimitAuth(error)) {
        setCooldownOtp(AUTH_OTP.RESEND_COOLDOWN_SECONDS);
      }

      setErroreAuth(getMessaggioErroreAuth(error));
    } finally {
      setLoadingInvioCodice(false);
    }
  };

  const handleVerificaCodiceOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emailNormalizzata = emailLogin.trim().toLowerCase();
    const token = codiceOtp.trim();

    if (!emailNormalizzata) {
      setErroreAuth(AUTH_TESTI.ERRORI.EMAIL_OBBLIGATORIA);
      return;
    }

    if (token.length !== AUTH_OTP.CODICE_LENGTH) {
      setErroreAuth(AUTH_TESTI.ERRORI.CODICE_OBBLIGATORIO);
      return;
    }

    try {
      setLoadingVerificaCodice(true);
      setErroreAuth(null);
      setMessaggioAuth(null);

      await verificaCodiceOtp({
        email: emailNormalizzata,
        token,
      });
    } catch (error: unknown) {
      setErroreAuth(getMessaggioErroreAuth(error));
    } finally {
      setLoadingVerificaCodice(false);
    }
  };

  // ── Timbratura handlers ───────────────────────────────────────────────────

  const resetLavorazioniUscita = () => {
    setMostraLavorazioniUscita(false);
    setLavorazioniUscita([]);
    setLavorazioniUscitaSelezionate([]);
    setPercentualiLavorazioniUscita({});
    setCantiereIdUscita(null);
    setCantiereIdNuovoCambio(null);
    setTipoDialogLavorazioni(null);
    setErroreLavorazioniUscita(null);
  };

  const toggleLavorazioneUscita = (lavorazione: LavorazioneCantiere) => {
    setLavorazioniUscitaSelezionate((lavorazioneIds) =>
      lavorazioneIds.includes(lavorazione.id)
        ? lavorazioneIds.filter(
            (currentLavorazioneId) => currentLavorazioneId !== lavorazione.id
          )
        : [...lavorazioneIds, lavorazione.id]
    );

    setPercentualiLavorazioniUscita((percentuali) => {
      if (percentuali[lavorazione.id] !== undefined) {
        return percentuali;
      }

      return {
        ...percentuali,
        [lavorazione.id]: String(lavorazione.percentuale_completamento),
      };
    });
    setErroreLavorazioniUscita(null);
  };

  const selezionaLavorazioneUscita = (lavorazioneId: string) => {
    setLavorazioniUscitaSelezionate((lavorazioneIds) =>
      lavorazioneIds.includes(lavorazioneId)
        ? lavorazioneIds
        : [...lavorazioneIds, lavorazioneId]
    );
  };

  const normalizzaPercentualeLavorazioneUscita = (percentuale: string) => {
    if (percentuale.trim() === "") {
      return "";
    }

    const percentualeNumber = Number(percentuale);

    if (!Number.isFinite(percentualeNumber)) {
      return "";
    }

    const percentualeIntera = Math.trunc(percentualeNumber);

    return String(
      Math.min(
        LAVORAZIONI_LIMITI.PERCENTUALE_MAX,
        Math.max(LAVORAZIONI_LIMITI.PERCENTUALE_MIN, percentualeIntera)
      )
    );
  };

  const handlePercentualeLavorazioneUscitaChange = (
    lavorazioneId: string,
    percentuale: string
  ) => {
    selezionaLavorazioneUscita(lavorazioneId);
    setPercentualiLavorazioniUscita((percentuali) => ({
      ...percentuali,
      [lavorazioneId]:
        normalizzaPercentualeLavorazioneUscita(percentuale),
    }));
    setErroreLavorazioniUscita(null);
  };

  const getPercentualeLavorazioneUscitaValue = (
    lavorazione: LavorazioneCantiere
  ) =>
    percentualiLavorazioniUscita[lavorazione.id] ??
    String(lavorazione.percentuale_completamento);

  const getSliderLavorazioneUscitaValue = (
    lavorazione: LavorazioneCantiere
  ) => {
    const percentualeRaw = getPercentualeLavorazioneUscitaValue(lavorazione);
    const percentuale = Number(percentualeRaw);

    if (
      percentualeRaw.trim() !== "" &&
      Number.isInteger(percentuale) &&
      percentuale >= LAVORAZIONI_LIMITI.PERCENTUALE_MIN &&
      percentuale <= LAVORAZIONI_LIMITI.PERCENTUALE_MAX
    ) {
      return percentualeRaw;
    }

    return String(LAVORAZIONI_LIMITI.PERCENTUALE_MIN);
  };

  const getLavorazioniUscitaPayload =
    (): TimbraturaLavorazioneInput[] | null => {
      const payload = lavorazioniUscitaSelezionate.map((lavorazioneId) => {
        const percentualeRaw =
          percentualiLavorazioniUscita[lavorazioneId] ?? "";
        const percentuale = Number(percentualeRaw);

        if (
          percentualeRaw.trim() === "" ||
          !Number.isInteger(percentuale) ||
          percentuale < LAVORAZIONI_LIMITI.PERCENTUALE_MIN ||
          percentuale > LAVORAZIONI_LIMITI.PERCENTUALE_MAX
        ) {
          return null;
        }

        return {
          lavorazioneId,
          percentualeAvanzamento: percentuale,
        };
      });

      if (payload.some((lavorazione) => lavorazione === null)) {
        return null;
      }

      return payload as TimbraturaLavorazioneInput[];
    };

  const mostraDialogLavorazioni = ({
    tipo,
    cantiereIdLavorazioni,
    cantiereIdNuovo = null,
    lavorazioni,
  }: {
    tipo: TipoDialogLavorazioni;
    cantiereIdLavorazioni: string;
    cantiereIdNuovo?: string | null;
    lavorazioni: LavorazioneCantiere[];
  }) => {
    setTipoDialogLavorazioni(tipo);
    setCantiereIdUscita(cantiereIdLavorazioni);
    setCantiereIdNuovoCambio(cantiereIdNuovo);
    setLavorazioniUscita(lavorazioni);
    setLavorazioniUscitaSelezionate([]);
    setPercentualiLavorazioniUscita(
      Object.fromEntries(
        lavorazioni.map((lavorazione) => [
          lavorazione.id,
          String(lavorazione.percentuale_completamento),
        ])
      )
    );
    setErroreLavorazioniUscita(null);
    setMostraLavorazioniUscita(true);
  };

  const registraTimbraturaPage = async ({
    tipo,
    cantiereIdTimbratura = cantiereId || null,
    attivitaTipoTimbratura = attivitaTipo || null,
    lavorazioni = [],
  }: {
    tipo: TipoTimbratura;
    cantiereIdTimbratura?: string | null;
    attivitaTipoTimbratura?: TipoAttivita | null;
    lavorazioni?: TimbraturaLavorazioneInput[];
  }) => {
    try {
      await handleTimbratura({
        cantiereId: cantiereIdTimbratura,
        attivitaTipo: attivitaTipoTimbratura,
        tipo,
        lavorazioni,
      });

      if (tipo === TIMBRATURE.CAMBIO_CANTIERE) {
        setCantiereId(cantiereIdTimbratura || "");
        setAttivitaTipo("");
      }

      resetLavorazioniUscita();

      toast.success(
        `${TIMBRATURE_TESTI.MESSAGGI.REGISTRATA_PREFIX} ${tipo} ${TIMBRATURE_TESTI.MESSAGGI.REGISTRATA_SUFFIX}`
      );
    } catch (error: unknown) {
      console.error(error);

      const messaggioErrore =
        error instanceof Error
          ? error.message
          : TIMBRATURE_TESTI.ERRORI.GENERICO;

      if (
        tipo === TIMBRATURE.USCITA ||
        tipo === TIMBRATURE.CAMBIO_CANTIERE
      ) {
        setErroreLavorazioniUscita(messaggioErrore);
      }

      toast.error(messaggioErrore);
    }
  };

  const handleTimbraturaPage = async (tipo: TipoTimbratura) => {
    if (tipo === TIMBRATURE.ENTRATA) {
      if (!cantiereId && !attivitaTipo) {
        toast.error(TIMBRATURE_TESTI.ERRORI.DESTINAZIONE_OBBLIGATORIA);
        return;
      }

      if (cantiereId && attivitaTipo) {
        toast.error(TIMBRATURE_TESTI.ERRORI.DESTINAZIONE_ESCLUSIVA);
        return;
      }
    }

    if (tipo === TIMBRATURE.USCITA) {
      const destinazioneCantiereId = ultimaTimbratura?.cantiere_id || null;

      if (destinazioneCantiereId) {
        try {
          const lavorazioni = await loadLavorazioniAttiveCantiere(
            destinazioneCantiereId
          );

          if (lavorazioni.length > 0) {
            mostraDialogLavorazioni({
              tipo,
              cantiereIdLavorazioni: destinazioneCantiereId,
              lavorazioni,
            });
            return;
          }
        } catch (error: unknown) {
          console.error(error);
          toast.error(TIMBRATURE_LAVORAZIONI_TESTI.ERRORI.CARICAMENTO);
          return;
        }

        await registraTimbraturaPage({
          tipo,
          cantiereIdTimbratura: destinazioneCantiereId,
          attivitaTipoTimbratura: null,
        });

        return;
      }

      await registraTimbraturaPage({
        tipo,
        cantiereIdTimbratura: null,
        attivitaTipoTimbratura:
          ultimaTimbratura?.attivita_tipo || null,
      });

      return;
    }

    if (tipo === TIMBRATURE.CAMBIO_CANTIERE) {
      const cantiereIdPrecedente = ultimaTimbratura?.cantiere_id || null;
      const nuovoCantiereId = cantiereId || null;

      if (!cantiereIdPrecedente || ultimaTimbratura?.attivita_tipo) {
        toast.error(
          TIMBRATURE_TESTI.ERRORI
            .CAMBIO_CANTIERE_ATTIVITA_NON_CONSENTITA
        );
        return;
      }

      if (!nuovoCantiereId) {
        toast.error(TIMBRATURE_TESTI.ERRORI.CAMBIO_CANTIERE_OBBLIGATORIO);
        return;
      }

      if (nuovoCantiereId === cantiereIdPrecedente) {
        toast.error(TIMBRATURE_TESTI.ERRORI.CAMBIO_CANTIERE_STESSO);
        return;
      }

      try {
        const lavorazioni = await loadLavorazioniAttiveCantiere(
          cantiereIdPrecedente
        );

        if (lavorazioni.length > 0) {
          mostraDialogLavorazioni({
            tipo,
            cantiereIdLavorazioni: cantiereIdPrecedente,
            cantiereIdNuovo: nuovoCantiereId,
            lavorazioni,
          });
          return;
        }
      } catch (error: unknown) {
        console.error(error);
        toast.error(TIMBRATURE_LAVORAZIONI_TESTI.ERRORI.CARICAMENTO);
        return;
      }

      await registraTimbraturaPage({
        tipo,
        cantiereIdTimbratura: nuovoCantiereId,
        attivitaTipoTimbratura: null,
      });

      return;
    }

    await registraTimbraturaPage({ tipo });
  };

  const handleConfermaLavorazioniUscita = async () => {
    if (!cantiereIdUscita || !tipoDialogLavorazioni) {
      setErroreLavorazioniUscita(TIMBRATURE_LAVORAZIONI_TESTI.ERRORI.GENERICO);
      return;
    }

    const lavorazioniPayload = getLavorazioniUscitaPayload();

    if (!lavorazioniPayload) {
      setErroreLavorazioniUscita(
        TIMBRATURE_LAVORAZIONI_TESTI.ERRORI.PERCENTUALE_NON_VALIDA
      );
      return;
    }

    const isCambioCantiere =
      tipoDialogLavorazioni === TIMBRATURE.CAMBIO_CANTIERE;
    const cantiereIdTimbratura = isCambioCantiere
      ? cantiereIdNuovoCambio
      : cantiereIdUscita;

    if (!cantiereIdTimbratura) {
      setErroreLavorazioniUscita(TIMBRATURE_LAVORAZIONI_TESTI.ERRORI.GENERICO);
      return;
    }

    await registraTimbraturaPage({
      tipo: tipoDialogLavorazioni,
      cantiereIdTimbratura,
      attivitaTipoTimbratura: null,
      lavorazioni: lavorazioniPayload,
    });
  };

  const handleCantiereChange = (nextCantiereId: string) => {
    if (nextCantiereId === cantiereId) {
      return;
    }

    setCantiereId(nextCantiereId);

    if (nextCantiereId) {
      setAttivitaTipo("");
    }
  };

  const handleAttivitaChange = (nextAttivitaTipo: TipoAttivita | "") => {
    if (nextAttivitaTipo === attivitaTipo) {
      return;
    }

    setAttivitaTipo(nextAttivitaTipo);

    if (nextAttivitaTipo) {
      setCantiereId("");
    }
  };

  // ── Computed ──────────────────────────────────────────────────────────────

  const testoInvioCodice = loadingInvioCodice
    ? AUTH_TESTI.INVIO_CODICE
    : cooldownOtp > 0
      ? formattaCooldownAuth(cooldownOtp)
      : codiceInviato
        ? AUTH_TESTI.REINVIA_CODICE
        : AUTH_TESTI.INVIA_CODICE;

  const dialogCambioCantiere =
    tipoDialogLavorazioni === TIMBRATURE.CAMBIO_CANTIERE;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (!inizializzato) {
    return (
      <main className="min-h-dvh bg-bg-base flex items-center justify-center px-4">
        <div className="flex items-center gap-3 px-4 py-3 bg-bg-subtle rounded-md text-xs font-medium uppercase tracking-wider text-text-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          {TIMBRATURE_TESTI.UI.CARICAMENTO}
        </div>
      </main>
    );
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <main className="min-h-dvh bg-bg-base flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px]">
          <div className="flex flex-col items-center text-center mb-8">
            <Image
              src="/a2c-logo-arancio.png"
              alt={TIMBRATURE_TESTI.UI.LOGO_ALT}
              width={160}
              height={48}
              style={{ height: "48px", width: "auto" }}
              priority
            />
            <h1 className="mt-6 font-heading text-2xl font-medium text-text-primary">
              {TIMBRATURE_TESTI.UI.APP_TITOLO}
            </h1>
            <p className="mt-1.5 text-sm text-text-muted">
              {TIMBRATURE_TESTI.UI.APP_SOTTOTITOLO}
            </p>
          </div>

          <Card className="p-6">
            <form onSubmit={handleInviaCodiceOtp} noValidate className="space-y-4">
              <Input
                label={AUTH_TESTI.EMAIL_LABEL}
                type="email"
                value={emailLogin}
                onChange={handleEmailLoginChange}
                placeholder={AUTH_TESTI.EMAIL_PLACEHOLDER}
                autoComplete="email"
                disabled={loadingAuth}
              />
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={loadingAuth || cooldownOtp > 0}
                loading={loadingInvioCodice}
                icon={!loadingInvioCodice ? <ArrowRight className="h-4 w-4" /> : undefined}
              >
                {testoInvioCodice}
              </Button>
            </form>

            {codiceInviato && (
              <form
                onSubmit={handleVerificaCodiceOtp}
                noValidate
                className="mt-4 space-y-4"
              >
                <Input
                  label={AUTH_TESTI.CODICE_LABEL}
                  type="text"
                  inputMode="numeric"
                  pattern={AUTH_OTP.CODICE_PATTERN}
                  maxLength={AUTH_OTP.CODICE_LENGTH}
                  value={codiceOtp}
                  onChange={handleCodiceOtpChange}
                  placeholder={AUTH_TESTI.CODICE_PLACEHOLDER}
                  autoComplete="one-time-code"
                  disabled={loadingAuth}
                  className="text-center text-2xl tracking-[0.35em] font-medium"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={
                    loadingAuth || codiceOtp.length !== AUTH_OTP.CODICE_LENGTH
                  }
                  loading={loadingVerificaCodice}
                >
                  {AUTH_TESTI.VERIFICA_CODICE}
                </Button>
              </form>
            )}

            <div aria-live="polite" className="mt-4 space-y-2 min-h-6">
              {messaggioAuth && (
                <p className="bg-success-50 text-success-500 rounded-md p-3 text-sm">
                  {messaggioAuth}
                </p>
              )}
              {erroreAuth && (
                <p className="bg-error-50 text-error-500 rounded-md p-3 text-sm">
                  {erroreAuth}
                </p>
              )}
            </div>
          </Card>
        </div>
      </main>
    );
  }

  // ── App ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader />

      <main className="mx-auto max-w-[640px] px-5 py-5 md:px-6 flex flex-col gap-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">

        {/* ── Card 1: Profilo ── */}
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <Avatar name={displayName || "?"} size="lg" />
            <div className="min-w-0">
              <p className="text-sm text-text-muted">Ciao,</p>
              <h1 className="font-heading text-2xl font-medium text-text-primary truncate">
                {displayName}
              </h1>
              <p className="text-sm text-text-muted truncate">
                {user.email}
                {ruoloDisplay ? ` · ${ruoloDisplay}` : ""}
              </p>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          <div className="flex flex-wrap gap-2">
            <Link href={APP_ROUTES.STORICO}>
              <Button
                variant="secondary"
                size="sm"
                icon={<History className="h-4 w-4" />}
              >
                {TIMBRATURE_TESTI.UI.STORICO}
              </Button>
            </Link>

            <Link href={APP_ROUTES.BACKOFFICE_RAPPORTI_INTERVENTO}>
              <Button
                variant="secondary"
                size="sm"
                icon={<ClipboardList className="h-4 w-4" />}
              >
                {RAPPORTI_INTERVENTO_TESTI.TITOLO}
              </Button>
            </Link>

            {mostraBackoffice && (
              <Link href={APP_ROUTES.BACKOFFICE}>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Building2 className="h-4 w-4" />}
                >
                  {TIMBRATURE_TESTI.UI.BACKOFFICE}
                </Button>
              </Link>
            )}
          </div>
        </Card>

        {/* ── Card 2: Stato attuale ── */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {TIMBRATURE_TESTI.STATO.TITOLO}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success-500 animate-pulse" />
              <Badge variant="success" size="sm">
                {TIMBRATURE_TESTI.STATO.LIVE}
              </Badge>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full shrink-0",
                STATO_DOT[statoAttuale]
              )}
            />
            <h2 className={cn("font-heading text-4xl font-medium", STATO_LABEL_COLOR[statoAttuale])}>
              {statoAttuale}
            </h2>
          </div>

          <p className="mt-1 text-sm text-text-muted">
            {getStatoDescrizione(statoAttuale, cantiereCorrentiNome)}
          </p>

          <div className="mt-4 bg-bg-subtle rounded-md px-3 py-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              {TIMBRATURE_TESTI.STATO.ULTIMA_TIMBRATURA}
            </p>
            <p className="mt-1 text-sm text-text-primary">
              {getUltimaTimbraturaLabel(ultimaTimbratura)}
            </p>
            {cantiereCorrentiNome && (
              <p className="text-xs text-text-muted mt-0.5">{cantiereCorrentiNome}</p>
            )}
          </div>

          {(statoAttuale === STATI.DENTRO ||
            statoAttuale === STATI.IN_PAUSA) && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <KpiCard
                label="Oggi"
                value={formattaOra(ultimaTimbratura?.created_at ?? "")}
              />
              <KpiCard
                label="Cantiere"
                value={cantiereCorrentiNome ?? "—"}
              />
              <KpiCard
                label="Attività"
                value={ultimaTimbratura?.attivita_tipo ?? "—"}
              />
            </div>
          )}
        </Card>

        {/* ── Card 3: Destinazione lavoro ── */}
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted mb-4">
            {TIMBRATURE_TESTI.UI.DESTINAZIONE_TITOLO}
          </p>

          <div className="grid gap-4">
            <SelectCantiere
              cantieri={cantieri}
              cantiereId={cantiereId}
              onChange={handleCantiereChange}
            />
            <SelectAttivita
              attivitaTipo={attivitaTipo}
              onChange={handleAttivitaChange}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2">
            {statoAttuale === STATI.FUORI && (
              <TimbratureButton
                label={TIMBRATURE_TESTI.AZIONI.ENTRATA}
                sub={TIMBRATURE_TESTI.AZIONI_DESCRIZIONI.ENTRATA}
                loading={loadingTimbratura}
                onClick={() => handleTimbraturaPage(TIMBRATURE.ENTRATA)}
              />
            )}

            {statoAttuale === STATI.DENTRO && (
              <>
                <TimbratureButton
                  label={TIMBRATURE_TESTI.AZIONI.PAUSA}
                  sub={TIMBRATURE_TESTI.AZIONI_DESCRIZIONI.PAUSA}
                  icon={<Pause className="h-4 w-4" />}
                  loading={loadingTimbratura}
                  onClick={() => handleTimbraturaPage(TIMBRATURE.PAUSA)}
                />
                <TimbratureButton
                  label={TIMBRATURE_TESTI.AZIONI.USCITA}
                  sub={TIMBRATURE_TESTI.AZIONI_DESCRIZIONI.USCITA}
                  variant="secondary"
                  loading={loadingTimbratura}
                  onClick={() => handleTimbraturaPage(TIMBRATURE.USCITA)}
                />
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full"
                  loading={loadingTimbratura}
                  icon={<Repeat className="h-4 w-4" />}
                  onClick={() =>
                    handleTimbraturaPage(TIMBRATURE.CAMBIO_CANTIERE)
                  }
                >
                  {TIMBRATURE_TESTI.AZIONI.CAMBIO_CANTIERE}
                </Button>
              </>
            )}

            {statoAttuale === STATI.IN_PAUSA && (
              <TimbratureButton
                label={TIMBRATURE_TESTI.AZIONI.RIENTRO}
                sub={TIMBRATURE_TESTI.AZIONI_DESCRIZIONI.RIENTRO}
                loading={loadingTimbratura}
                onClick={() => handleTimbraturaPage(TIMBRATURE.RIENTRO)}
              />
            )}
          </div>
        </Card>
      </main>

      {/* ── Dialog lavorazioni uscita ── */}
      {mostraLavorazioniUscita && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lavorazioni-uscita-titolo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-text-primary/60 p-3 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <Card className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[640px] overflow-hidden">
            <div className="border-b border-border p-4">
              <h2
                id="lavorazioni-uscita-titolo"
                className="font-heading text-xl font-medium text-text-primary"
              >
                {dialogCambioCantiere
                  ? TIMBRATURE_LAVORAZIONI_TESTI.TITOLO_CAMBIO_CANTIERE
                  : TIMBRATURE_LAVORAZIONI_TESTI.TITOLO_USCITA}
              </h2>
              <p className="mt-2 text-sm text-text-muted">
                {dialogCambioCantiere
                  ? TIMBRATURE_LAVORAZIONI_TESTI.DESCRIZIONE_CAMBIO_CANTIERE
                  : TIMBRATURE_LAVORAZIONI_TESTI.DESCRIZIONE_USCITA}
              </p>
            </div>

            <div className="flex max-h-[52dvh] flex-col gap-3 overflow-y-auto p-4">
              {lavorazioniUscita.map((lavorazione) => (
                <div
                  key={lavorazione.id}
                  className="flex flex-col gap-4 p-4 bg-bg-subtle rounded-md"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={lavorazioniUscitaSelezionate.includes(
                        lavorazione.id
                      )}
                      onChange={() => toggleLavorazioneUscita(lavorazione)}
                      disabled={loadingTimbratura}
                      id={`lavorazione-uscita-${lavorazione.id}`}
                      className="h-5 w-5 accent-brand-500"
                    />
                    <label
                      htmlFor={`lavorazione-uscita-${lavorazione.id}`}
                      className="min-w-0 flex-1 text-sm font-medium text-text-primary"
                    >
                      {lavorazione.nome}
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={LAVORAZIONI_LIMITI.PERCENTUALE_MIN}
                      max={LAVORAZIONI_LIMITI.PERCENTUALE_MAX}
                      step="1"
                      value={getSliderLavorazioneUscitaValue(lavorazione)}
                      onChange={(event) =>
                        handlePercentualeLavorazioneUscitaChange(
                          lavorazione.id,
                          event.target.value
                        )
                      }
                      aria-label={`${TIMBRATURE_LAVORAZIONI_TESTI.PERCENTUALE_LABEL} ${lavorazione.nome}`}
                      disabled={loadingTimbratura}
                      className="min-w-0 flex-1 accent-brand-500"
                    />
                    <input
                      type="number"
                      min={LAVORAZIONI_LIMITI.PERCENTUALE_MIN}
                      max={LAVORAZIONI_LIMITI.PERCENTUALE_MAX}
                      step="1"
                      value={getPercentualeLavorazioneUscitaValue(lavorazione)}
                      onChange={(event) =>
                        handlePercentualeLavorazioneUscitaChange(
                          lavorazione.id,
                          event.target.value
                        )
                      }
                      aria-label={`${TIMBRATURE_LAVORAZIONI_TESTI.PERCENTUALE_LABEL} ${lavorazione.nome}`}
                      disabled={loadingTimbratura}
                      className="h-10 w-20 px-2 text-right text-sm font-medium rounded-md border border-border bg-bg-card text-text-primary outline-none focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-muted"
                    />
                  </div>
                </div>
              ))}
            </div>

            {erroreLavorazioniUscita && (
              <p className="mx-4 mb-2 bg-error-50 text-error-500 rounded-md p-3 text-sm font-medium">
                {erroreLavorazioniUscita}
              </p>
            )}

            <div className="flex gap-3 border-t border-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={resetLavorazioniUscita}
                disabled={loadingTimbratura}
              >
                {TIMBRATURE_LAVORAZIONI_TESTI.ANNULLA}
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleConfermaLavorazioniUscita}
                loading={loadingTimbratura}
              >
                {loadingTimbratura
                  ? TIMBRATURE_LAVORAZIONI_TESTI.SALVATAGGIO
                  : dialogCambioCantiere
                    ? TIMBRATURE_LAVORAZIONI_TESTI.SALVA_CAMBIO_CANTIERE
                    : TIMBRATURE_LAVORAZIONI_TESTI.SALVA_USCITA}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
