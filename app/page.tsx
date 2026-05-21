"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import {
  isAuthError,
  type User,
} from "@supabase/supabase-js";

import {
  AUTH_ERROR_CODES,
  AUTH_HTTP_STATUS,
  AUTH_OTP,
  AUTH_TESTI,
} from "@/constants/auth";
import { LAVORAZIONI_LIMITI } from "@/constants/lavorazioni";
import {
  TIMBRATURE,
  TIMBRATURE_TESTI,
} from "@/constants/stati";
import { TIMBRATURE_LAVORAZIONI_TESTI } from "@/constants/timbratureLavorazioni";
import { TipoAttivita } from "@/types/attivita";
import type { LavorazioneCantiere } from "@/types/lavorazioni";
import { TipoTimbratura } from "@/types/timbrature";
import type { TimbraturaLavorazioneInput } from "@/types/timbratureLavorazioni";

import { ascoltaSessioneAuth } from "@/services/auth/ascoltaSessioneAuth";
import { esciAuth } from "@/services/auth/esciAuth";
import { inviaCodiceOtp } from "@/services/auth/inviaCodiceOtp";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { verificaCodiceOtp } from "@/services/auth/verificaCodiceOtp";
import { loadCantieri } from "@/services/cantieri/loadCantieri";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isDipendenteAttivo } from "@/services/dipendenti/isDipendenteAttivo";
import { loadLavorazioniAttiveCantiere } from "@/services/lavorazioni/loadLavorazioniAttiveCantiere";

import { useTimbrature } from "@/hooks/useTimbrature";

import { StatoBadge } from "@/components/timbrature/StatoBadge";
import { PulsantiTimbratura } from "@/components/timbrature/PulsantiTimbratura";
import { SelectAttivita } from "@/components/attivita/SelectAttivita";
import { SelectCantiere } from "@/components/cantieri/SelectCantiere";

type Cantiere = {
  id: string;
  nome: string;
};

type PercentualiLavorazioniUscita = Record<
  string,
  string
>;

type TipoDialogLavorazioni =
  | typeof TIMBRATURE.USCITA
  | typeof TIMBRATURE.CAMBIO_CANTIERE;

function isErroreRateLimitAuth(
  error: unknown
): boolean {
  return (
    isAuthError(error) &&
    (error.status ===
      AUTH_HTTP_STATUS.TROPPE_RICHIESTE ||
      error.code ===
        AUTH_ERROR_CODES.OVER_REQUEST_RATE_LIMIT ||
      error.code ===
        AUTH_ERROR_CODES.OVER_EMAIL_SEND_RATE_LIMIT)
  );
}

function getMessaggioErroreAuth(
  error: unknown
) {
  if (isErroreRateLimitAuth(error)) {
    return AUTH_TESTI.ERRORI.RATE_LIMIT;
  }

  if (isAuthError(error)) {
    if (
      error.code ===
        AUTH_ERROR_CODES.OTP_EXPIRED ||
      error.code ===
        AUTH_ERROR_CODES.INVALID_CREDENTIALS
    ) {
      return AUTH_TESTI.ERRORI.CODICE_NON_VALIDO;
    }

    if (
      error.code ===
        AUTH_ERROR_CODES.USER_NOT_FOUND ||
      error.code ===
        AUTH_ERROR_CODES.EMAIL_ADDRESS_INVALID ||
      error.code ===
        AUTH_ERROR_CODES.EMAIL_ADDRESS_NOT_AUTHORIZED
    ) {
      return AUTH_TESTI.ERRORI.EMAIL_NON_AUTORIZZATA;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return AUTH_TESTI.ERRORI.GENERICO;
}

function formattaCooldownAuth(
  secondi: number
) {
  return `${AUTH_TESTI.COOLDOWN_PREFIX} ${secondi}${AUTH_TESTI.COOLDOWN_SUFFIX}`;
}

export default function HomePage() {
  // =========================
  // STATE
  // =========================

  const [user, setUser] = useState<User | null>(null);

  const [cantieri, setCantieri] = useState<
    Cantiere[]
  >([]);

  const [cantiereId, setCantiereId] =
    useState("");

  const [
    attivitaTipo,
    setAttivitaTipo,
  ] = useState<TipoAttivita | "">("");

  const [
    lavorazioniUscita,
    setLavorazioniUscita,
  ] = useState<LavorazioneCantiere[]>([]);

  const [
    lavorazioniUscitaSelezionate,
    setLavorazioniUscitaSelezionate,
  ] = useState<string[]>([]);

  const [
    percentualiLavorazioniUscita,
    setPercentualiLavorazioniUscita,
  ] =
    useState<PercentualiLavorazioniUscita>(
      {}
    );

  const [
    cantiereIdUscita,
    setCantiereIdUscita,
  ] = useState<string | null>(null);

  const [
    cantiereIdNuovoCambio,
    setCantiereIdNuovoCambio,
  ] = useState<string | null>(null);

  const [
    tipoDialogLavorazioni,
    setTipoDialogLavorazioni,
  ] =
    useState<TipoDialogLavorazioni | null>(
      null
    );

  const [
    mostraLavorazioniUscita,
    setMostraLavorazioniUscita,
  ] = useState(false);

  const [
    erroreLavorazioniUscita,
    setErroreLavorazioniUscita,
  ] = useState<string | null>(null);

  const [inizializzato, setInizializzato] =
    useState(false);

  const [
    mostraBackoffice,
    setMostraBackoffice,
  ] = useState(false);

  const [emailLogin, setEmailLogin] =
    useState("");

  const [codiceOtp, setCodiceOtp] =
    useState("");

  const [
    codiceInviato,
    setCodiceInviato,
  ] = useState(false);

  const [
    loadingInvioCodice,
    setLoadingInvioCodice,
  ] = useState(false);

  const [
    loadingVerificaCodice,
    setLoadingVerificaCodice,
  ] = useState(false);

  const [
    erroreAuth,
    setErroreAuth,
  ] = useState<string | null>(null);

  const [
    messaggioAuth,
    setMessaggioAuth,
  ] = useState<string | null>(null);

  const [
    cooldownOtp,
    setCooldownOtp,
  ] = useState(0);

  const loadingAuth =
    loadingInvioCodice ||
    loadingVerificaCodice;

  // =========================
  // TIMBRATURE
  // =========================

  const {
    ultimaTimbratura,
    statoAttuale,
    loadingTimbratura,
    refreshUltimaTimbratura,
    handleTimbratura,
  } = useTimbrature({
    userId: user?.id || null,
  });

  // =========================
  // INIT
  // =========================

  useEffect(() => {
    const refreshMostraBackoffice = async (
      currentUser: User | null
    ) => {
      if (!currentUser?.email) {
        setMostraBackoffice(false);

        return;
      }

      try {
        const utenteAdmin = await isAdmin(
          currentUser.email
        );

        setMostraBackoffice(utenteAdmin);
      } catch (error) {
        console.error(
          "Errore controllo admin",
          {
            email: currentUser.email,
            error,
          }
        );
        setMostraBackoffice(false);
      }
    };

    const disconnettiUtenteNonAttivo =
      async () => {
        setUser(null);
        setMostraBackoffice(false);
        await refreshUltimaTimbratura(null);
        setErroreAuth(
          AUTH_TESTI.ERRORI.DIPENDENTE_NON_ATTIVO
        );
        await esciAuth();
      };

    const sincronizzaUtenteAutenticato =
      async (
        currentUser: User | null
      ): Promise<User | null> => {
        if (!currentUser) {
          setUser(null);
          setMostraBackoffice(false);
          await refreshUltimaTimbratura(null);

          return null;
        }

        if (!currentUser.email) {
          await disconnettiUtenteNonAttivo();

          return null;
        }

        const dipendenteAttivo =
          await isDipendenteAttivo(
            currentUser.email
          );

        if (!dipendenteAttivo) {
          await disconnettiUtenteNonAttivo();

          return null;
        }

        setUser(currentUser);
        await refreshMostraBackoffice(
          currentUser
        );
        await refreshUltimaTimbratura(
          currentUser.id
        );

        return currentUser;
      };

    const init = async () => {
      try {
        // =========================
        // USER
        // =========================

        const user = await loadUtenteAuth();

        await sincronizzaUtenteAutenticato(
          user
        );

        // =========================
        // CANTIERI
        // =========================

        const cantieriData =
          await loadCantieri();

        setCantieri(cantieriData);
      } catch (error) {
        console.error(error);
      } finally {
        setInizializzato(true);
      }
    };

    init();

    // =========================
    // AUTH LISTENER
    // =========================

    const subscription =
      ascoltaSessioneAuth(
        async (session) => {
          const currentUser =
            session?.user || null;

          await sincronizzaUtenteAutenticato(
            currentUser
          );
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
      setCooldownOtp((secondi) =>
        Math.max(secondi - 1, 0)
      );
    }, AUTH_OTP.COOLDOWN_INTERVAL_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [cooldownOtp]);

  // =========================
  // AUTH
  // =========================

  const handleEmailLoginChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    setEmailLogin(event.target.value);
    setCodiceOtp("");
    setCodiceInviato(false);
    setCooldownOtp(0);
    setErroreAuth(null);
    setMessaggioAuth(null);
  };

  const handleCodiceOtpChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const codiceSoloNumeri =
      event.target.value
        .replace(/\D/g, "")
        .slice(0, AUTH_OTP.CODICE_LENGTH);

    setCodiceOtp(codiceSoloNumeri);
    setErroreAuth(null);
  };

  const handleInviaCodiceOtp = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const emailNormalizzata = emailLogin
      .trim()
      .toLowerCase();

    if (!emailNormalizzata) {
      setErroreAuth(
        AUTH_TESTI.ERRORI.EMAIL_OBBLIGATORIA
      );

      return;
    }

    try {
      setLoadingInvioCodice(true);
      setErroreAuth(null);
      setMessaggioAuth(null);

      const dipendenteAttivo =
        await isDipendenteAttivo(
          emailNormalizzata
        );

      if (!dipendenteAttivo) {
        setErroreAuth(
          AUTH_TESTI.ERRORI.DIPENDENTE_NON_ATTIVO
        );

        return;
      }

      await inviaCodiceOtp(emailNormalizzata);

      setEmailLogin(emailNormalizzata);
      setCodiceOtp("");
      setCodiceInviato(true);
      setCooldownOtp(
        AUTH_OTP.RESEND_COOLDOWN_SECONDS
      );
      setMessaggioAuth(
        AUTH_TESTI.CODICE_INVIATO
      );
    } catch (error: unknown) {
      if (isErroreRateLimitAuth(error)) {
        setCooldownOtp(
          AUTH_OTP.RESEND_COOLDOWN_SECONDS
        );
      }

      setErroreAuth(
        getMessaggioErroreAuth(error)
      );
    } finally {
      setLoadingInvioCodice(false);
    }
  };

  const handleVerificaCodiceOtp = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const emailNormalizzata = emailLogin
      .trim()
      .toLowerCase();
    const token = codiceOtp.trim();

    if (!emailNormalizzata) {
      setErroreAuth(
        AUTH_TESTI.ERRORI.EMAIL_OBBLIGATORIA
      );

      return;
    }

    if (
      token.length !==
      AUTH_OTP.CODICE_LENGTH
    ) {
      setErroreAuth(
        AUTH_TESTI.ERRORI.CODICE_OBBLIGATORIO
      );

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
      setErroreAuth(
        getMessaggioErroreAuth(error)
      );
    } finally {
      setLoadingVerificaCodice(false);
    }
  };

  // =========================
  // HANDLE TIMBRATURA
  // =========================

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

  const toggleLavorazioneUscita = (
    lavorazione: LavorazioneCantiere
  ) => {
    setLavorazioniUscitaSelezionate(
      (lavorazioneIds) =>
        lavorazioneIds.includes(
          lavorazione.id
        )
          ? lavorazioneIds.filter(
              (currentLavorazioneId) =>
                currentLavorazioneId !==
                lavorazione.id
            )
          : [
              ...lavorazioneIds,
              lavorazione.id,
            ]
    );

    setPercentualiLavorazioniUscita(
      (percentuali) => {
        if (
          percentuali[lavorazione.id] !==
          undefined
        ) {
          return percentuali;
        }

        return {
          ...percentuali,
          [lavorazione.id]: String(
            lavorazione.percentuale_completamento
          ),
        };
      }
    );
    setErroreLavorazioniUscita(null);
  };

  const selezionaLavorazioneUscita = (
    lavorazioneId: string
  ) => {
    setLavorazioniUscitaSelezionate(
      (lavorazioneIds) =>
        lavorazioneIds.includes(lavorazioneId)
          ? lavorazioneIds
          : [
              ...lavorazioneIds,
              lavorazioneId,
            ]
    );
  };

  const normalizzaPercentualeLavorazioneUscita =
    (percentuale: string) => {
      if (percentuale.trim() === "") {
        return "";
      }

      const percentualeNumber =
        Number(percentuale);

      if (
        !Number.isFinite(percentualeNumber)
      ) {
        return "";
      }

      const percentualeIntera =
        Math.trunc(percentualeNumber);

      return String(
        Math.min(
          LAVORAZIONI_LIMITI.PERCENTUALE_MAX,
          Math.max(
            LAVORAZIONI_LIMITI.PERCENTUALE_MIN,
            percentualeIntera
          )
        )
      );
    };

  const handlePercentualeLavorazioneUscitaChange =
    (
      lavorazioneId: string,
      percentuale: string
    ) => {
      selezionaLavorazioneUscita(
        lavorazioneId
      );
      setPercentualiLavorazioniUscita(
        (percentuali) => ({
          ...percentuali,
          [lavorazioneId]:
            normalizzaPercentualeLavorazioneUscita(
              percentuale
            ),
        })
      );
      setErroreLavorazioniUscita(null);
    };

  const getPercentualeLavorazioneUscitaValue =
    (lavorazione: LavorazioneCantiere) =>
      percentualiLavorazioniUscita[
        lavorazione.id
      ] ??
      String(
        lavorazione.percentuale_completamento
      );

  const getSliderLavorazioneUscitaValue =
    (lavorazione: LavorazioneCantiere) => {
      const percentualeRaw =
        getPercentualeLavorazioneUscitaValue(
          lavorazione
        );
      const percentuale =
        Number(percentualeRaw);

      if (
        percentualeRaw.trim() !== "" &&
        Number.isInteger(percentuale) &&
        percentuale >=
          LAVORAZIONI_LIMITI.PERCENTUALE_MIN &&
        percentuale <=
          LAVORAZIONI_LIMITI.PERCENTUALE_MAX
      ) {
        return percentualeRaw;
      }

      return String(
        LAVORAZIONI_LIMITI.PERCENTUALE_MIN
      );
    };

  const getLavorazioniUscitaPayload =
    (): TimbraturaLavorazioneInput[] | null => {
      const payload =
        lavorazioniUscitaSelezionate.map(
          (lavorazioneId) => {
            const percentualeRaw =
              percentualiLavorazioniUscita[
                lavorazioneId
              ] ?? "";
            const percentuale =
              Number(percentualeRaw);

            if (
              percentualeRaw.trim() === "" ||
              !Number.isInteger(
                percentuale
              ) ||
              percentuale <
                LAVORAZIONI_LIMITI.PERCENTUALE_MIN ||
              percentuale >
                LAVORAZIONI_LIMITI.PERCENTUALE_MAX
            ) {
              return null;
            }

            return {
              lavorazioneId,
              percentualeAvanzamento:
                percentuale,
            };
          }
        );

      if (
        payload.some(
          (lavorazione) =>
            lavorazione === null
        )
      ) {
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
    setCantiereIdUscita(
      cantiereIdLavorazioni
    );
    setCantiereIdNuovoCambio(
      cantiereIdNuovo
    );
    setLavorazioniUscita(lavorazioni);
    setLavorazioniUscitaSelezionate([]);
    setPercentualiLavorazioniUscita(
      Object.fromEntries(
        lavorazioni.map((lavorazione) => [
          lavorazione.id,
          String(
            lavorazione.percentuale_completamento
          ),
        ])
      )
    );
    setErroreLavorazioniUscita(null);
    setMostraLavorazioniUscita(true);
  };

  const registraTimbraturaPage = async ({
    tipo,
    cantiereIdTimbratura = cantiereId || null,
    attivitaTipoTimbratura = attivitaTipo ||
      null,
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
        attivitaTipo:
          attivitaTipoTimbratura,
        tipo,
        lavorazioni,
      });

      if (
        tipo ===
        TIMBRATURE.CAMBIO_CANTIERE
      ) {
        setCantiereId(
          cantiereIdTimbratura || ""
        );
        setAttivitaTipo("");
      }

      resetLavorazioniUscita();

      alert(
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
        tipo ===
          TIMBRATURE.CAMBIO_CANTIERE
      ) {
        setErroreLavorazioniUscita(
          messaggioErrore
        );
      }

      alert(messaggioErrore);
    }
  };

  const handleTimbraturaPage = async (
    tipo: TipoTimbratura
  ) => {
    if (tipo === TIMBRATURE.ENTRATA) {
      if (!cantiereId && !attivitaTipo) {
        alert(
          TIMBRATURE_TESTI.ERRORI
            .DESTINAZIONE_OBBLIGATORIA
        );

        return;
      }

      if (cantiereId && attivitaTipo) {
        alert(
          TIMBRATURE_TESTI.ERRORI
            .DESTINAZIONE_ESCLUSIVA
        );

        return;
      }
    }

    if (tipo === TIMBRATURE.USCITA) {
      const destinazioneCantiereId =
        ultimaTimbratura?.cantiere_id ||
        null;

      if (destinazioneCantiereId) {
        try {
          const lavorazioni =
            await loadLavorazioniAttiveCantiere(
              destinazioneCantiereId
            );

          if (lavorazioni.length > 0) {
            mostraDialogLavorazioni({
              tipo,
              cantiereIdLavorazioni:
                destinazioneCantiereId,
              lavorazioni,
            });

            return;
          }
        } catch (error: unknown) {
          console.error(error);

          alert(
            TIMBRATURE_LAVORAZIONI_TESTI
              .ERRORI.CARICAMENTO
          );

          return;
        }

        await registraTimbraturaPage({
          tipo,
          cantiereIdTimbratura:
            destinazioneCantiereId,
          attivitaTipoTimbratura: null,
        });

        return;
      }

      await registraTimbraturaPage({
        tipo,
        cantiereIdTimbratura: null,
        attivitaTipoTimbratura:
          ultimaTimbratura?.attivita_tipo ||
          null,
      });

      return;
    }

    if (
      tipo === TIMBRATURE.CAMBIO_CANTIERE
    ) {
      const cantiereIdPrecedente =
        ultimaTimbratura?.cantiere_id ||
        null;
      const nuovoCantiereId =
        cantiereId || null;

      if (
        !cantiereIdPrecedente ||
        ultimaTimbratura?.attivita_tipo
      ) {
        alert(
          TIMBRATURE_TESTI.ERRORI
            .CAMBIO_CANTIERE_ATTIVITA_NON_CONSENTITA
        );

        return;
      }

      if (!nuovoCantiereId) {
        alert(
          TIMBRATURE_TESTI.ERRORI
            .CAMBIO_CANTIERE_OBBLIGATORIO
        );

        return;
      }

      if (
        nuovoCantiereId ===
        cantiereIdPrecedente
      ) {
        alert(
          TIMBRATURE_TESTI.ERRORI
            .CAMBIO_CANTIERE_STESSO
        );

        return;
      }

      try {
        const lavorazioni =
          await loadLavorazioniAttiveCantiere(
            cantiereIdPrecedente
          );

        if (lavorazioni.length > 0) {
          mostraDialogLavorazioni({
            tipo,
            cantiereIdLavorazioni:
              cantiereIdPrecedente,
            cantiereIdNuovo:
              nuovoCantiereId,
            lavorazioni,
          });

          return;
        }
      } catch (error: unknown) {
        console.error(error);

        alert(
          TIMBRATURE_LAVORAZIONI_TESTI.ERRORI
            .CARICAMENTO
        );

        return;
      }

      await registraTimbraturaPage({
        tipo,
        cantiereIdTimbratura:
          nuovoCantiereId,
        attivitaTipoTimbratura: null,
      });

      return;
    }

    await registraTimbraturaPage({
      tipo,
    });
  };

  const handleConfermaLavorazioniUscita =
    async () => {
      if (
        !cantiereIdUscita ||
        !tipoDialogLavorazioni
      ) {
        setErroreLavorazioniUscita(
          TIMBRATURE_LAVORAZIONI_TESTI
            .ERRORI.GENERICO
        );

        return;
      }

      const lavorazioniPayload =
        getLavorazioniUscitaPayload();

      if (!lavorazioniPayload) {
        setErroreLavorazioniUscita(
          TIMBRATURE_LAVORAZIONI_TESTI.ERRORI
            .PERCENTUALE_NON_VALIDA
        );

        return;
      }

      const isCambioCantiere =
        tipoDialogLavorazioni ===
        TIMBRATURE.CAMBIO_CANTIERE;
      const cantiereIdTimbratura =
        isCambioCantiere
          ? cantiereIdNuovoCambio
          : cantiereIdUscita;

      if (!cantiereIdTimbratura) {
        setErroreLavorazioniUscita(
          TIMBRATURE_LAVORAZIONI_TESTI
            .ERRORI.GENERICO
        );

        return;
      }

      await registraTimbraturaPage({
        tipo: tipoDialogLavorazioni,
        cantiereIdTimbratura,
        attivitaTipoTimbratura: null,
        lavorazioni: lavorazioniPayload,
      });
    };

  const handleCantiereChange = (
    nextCantiereId: string
  ) => {
    setCantiereId(nextCantiereId);

    if (nextCantiereId) {
      setAttivitaTipo("");
    }
  };

  const handleAttivitaChange = (
    nextAttivitaTipo: TipoAttivita | ""
  ) => {
    setAttivitaTipo(nextAttivitaTipo);

    if (nextAttivitaTipo) {
      setCantiereId("");
    }
  };

  const testoInvioCodice =
    loadingInvioCodice
      ? AUTH_TESTI.INVIO_CODICE
      : cooldownOtp > 0
        ? formattaCooldownAuth(
            cooldownOtp
          )
        : codiceInviato
          ? AUTH_TESTI.REINVIA_CODICE
          : AUTH_TESTI.INVIA_CODICE;

  const dialogCambioCantiere =
    tipoDialogLavorazioni ===
    TIMBRATURE.CAMBIO_CANTIERE;

  // =========================
  // LOADING INIT
  // =========================

  if (!inizializzato) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-6 text-slate-950">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          {
            TIMBRATURE_TESTI.UI
              .CARICAMENTO
          }
        </div>
      </main>
    );
  }

  // =========================
  // LOGIN
  // =========================

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-100 text-gray-900">
        <div className="bg-white border rounded-2xl shadow p-6 w-full max-w-md text-gray-900">
          <h1 className="text-3xl font-bold mb-6">
            {AUTH_TESTI.TITOLO}
          </h1>

          <form
            onSubmit={handleInviaCodiceOtp}
            noValidate
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-700">
                {AUTH_TESTI.EMAIL_LABEL}
              </span>

              <input
                type="email"
                value={emailLogin}
                onChange={
                  handleEmailLoginChange
                }
                placeholder={
                  AUTH_TESTI.EMAIL_PLACEHOLDER
                }
                autoComplete="email"
                disabled={loadingAuth}
                className="w-full rounded-lg border border-gray-300 p-3 text-gray-900 disabled:bg-gray-100"
              />
            </label>

            <button
              type="submit"
              disabled={
                loadingAuth ||
                cooldownOtp > 0
              }
              className="w-full rounded-lg bg-black p-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {testoInvioCodice}
            </button>
          </form>

          {codiceInviato && (
            <form
              onSubmit={
                handleVerificaCodiceOtp
              }
              noValidate
              className="mt-4 flex flex-col gap-4"
            >
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-700">
                  {AUTH_TESTI.CODICE_LABEL}
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  pattern={
                    AUTH_OTP.CODICE_PATTERN
                  }
                  maxLength={
                    AUTH_OTP.CODICE_LENGTH
                  }
                  value={codiceOtp}
                  onChange={
                    handleCodiceOtpChange
                  }
                  placeholder={
                    AUTH_TESTI.CODICE_PLACEHOLDER
                  }
                  autoComplete="one-time-code"
                  disabled={loadingAuth}
                  className="w-full rounded-lg border border-gray-300 p-3 text-center text-2xl font-semibold tracking-widest text-gray-900 disabled:bg-gray-100"
                />
              </label>

              <button
                type="submit"
                disabled={
                  loadingAuth ||
                  codiceOtp.length !==
                    AUTH_OTP.CODICE_LENGTH
                }
                className="w-full rounded-lg bg-blue-600 p-4 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {loadingVerificaCodice
                  ? AUTH_TESTI.VERIFICA_IN_CORSO
                  : AUTH_TESTI.VERIFICA_CODICE}
              </button>
            </form>
          )}

          <div
            aria-live="polite"
            className="mt-4 min-h-6"
          >
            {messaggioAuth && (
              <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                {messaggioAuth}
              </p>
            )}

            {erroreAuth && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {erroreAuth}
              </p>
            )}
          </div>
        </div>
      </main>
    );
  }

  // =========================
  // UI
  // =========================

  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-slate-950 sm:px-6">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Image
              src="/a2c-logo.svg"
              alt={TIMBRATURE_TESTI.UI.LOGO_ALT}
              width={192}
              height={91}
              priority
              className="h-14 w-auto max-w-48"
            />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              {
                TIMBRATURE_TESTI.UI
                  .APP_SOTTOTITOLO
              }
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              {TIMBRATURE_TESTI.UI.APP_TITOLO}
            </h1>
            <p className="mt-2 truncate text-sm text-slate-500">
              {TIMBRATURE_TESTI.UI.UTENTE_PREFIX}
              {": "}
              {user.email}
            </p>
          </div>

          <button
            onClick={async () => {
              try {
                await esciAuth();
              } catch (error: unknown) {
                alert(
                  getMessaggioErroreAuth(
                    error
                  )
                );
              }
            }}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
          >
            {TIMBRATURE_TESTI.UI.LOGOUT}
          </button>
        </header>

        <nav className="flex gap-2 text-sm font-semibold">
          <Link
            href="/storico"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
          >
            {TIMBRATURE_TESTI.UI.STORICO}
          </Link>

          {mostraBackoffice && (
            <Link
              href="/backoffice"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
            >
              {
                TIMBRATURE_TESTI.UI
                  .BACKOFFICE
              }
            </Link>
          )}
        </nav>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">
              {
                TIMBRATURE_TESTI.UI
                  .DESTINAZIONE_TITOLO
              }
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {
                TIMBRATURE_TESTI.UI
                  .DESTINAZIONE_DESCRIZIONE
              }
            </p>
          </div>

          <div className="flex flex-col gap-4">
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
        </section>

        <StatoBadge
          stato={statoAttuale}
          ultimaTimbratura={
            ultimaTimbratura
          }
        />

        <PulsantiTimbratura
          statoAttuale={statoAttuale}
          loading={loadingTimbratura}
          onTimbratura={
            handleTimbraturaPage
          }
        />
      </div>

      {mostraLavorazioniUscita && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lavorazioni-uscita-titolo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-950 shadow-2xl shadow-slate-950/20 transition-all duration-200">
            <div className="border-b border-slate-100 p-5">
            <h2
              id="lavorazioni-uscita-titolo"
              className="text-xl font-semibold tracking-tight"
            >
              {dialogCambioCantiere
                ? TIMBRATURE_LAVORAZIONI_TESTI
                    .TITOLO_CAMBIO_CANTIERE
                : TIMBRATURE_LAVORAZIONI_TESTI
                    .TITOLO_USCITA}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {dialogCambioCantiere
                ? TIMBRATURE_LAVORAZIONI_TESTI
                    .DESCRIZIONE_CAMBIO_CANTIERE
                : TIMBRATURE_LAVORAZIONI_TESTI
                    .DESCRIZIONE_USCITA}
            </p>
            </div>

            <div className="flex max-h-[52dvh] flex-col gap-3 overflow-y-auto p-4">
              {lavorazioniUscita.map(
                (lavorazione) => (
                  <div
                    key={lavorazione.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={lavorazioniUscitaSelezionate.includes(
                          lavorazione.id
                        )}
                        onChange={() =>
                          toggleLavorazioneUscita(
                            lavorazione
                          )
                        }
                        disabled={
                          loadingTimbratura
                        }
                        id={`lavorazione-uscita-${lavorazione.id}`}
                        className="h-5 w-5 rounded border-slate-300 accent-slate-950"
                      />

                      <label
                        htmlFor={`lavorazione-uscita-${lavorazione.id}`}
                        className="min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-900"
                      >
                        {lavorazione.nome}
                      </label>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={
                          LAVORAZIONI_LIMITI.PERCENTUALE_MIN
                        }
                        max={
                          LAVORAZIONI_LIMITI.PERCENTUALE_MAX
                        }
                        step="1"
                        value={getSliderLavorazioneUscitaValue(
                          lavorazione
                        )}
                        onChange={(event) =>
                          handlePercentualeLavorazioneUscitaChange(
                            lavorazione.id,
                            event.target.value
                          )
                        }
                        aria-label={`${TIMBRATURE_LAVORAZIONI_TESTI.PERCENTUALE_LABEL} ${lavorazione.nome}`}
                        disabled={
                          loadingTimbratura
                        }
                        className="min-w-0 flex-1 accent-slate-950"
                      />

                      <input
                        type="number"
                        min={
                          LAVORAZIONI_LIMITI.PERCENTUALE_MIN
                        }
                        max={
                          LAVORAZIONI_LIMITI.PERCENTUALE_MAX
                        }
                        step="1"
                        value={getPercentualeLavorazioneUscitaValue(
                          lavorazione
                        )}
                        onChange={(event) =>
                          handlePercentualeLavorazioneUscitaChange(
                            lavorazione.id,
                            event.target.value
                          )
                        }
                        aria-label={`${TIMBRATURE_LAVORAZIONI_TESTI.PERCENTUALE_LABEL} ${lavorazione.nome}`}
                        disabled={
                          loadingTimbratura
                        }
                        className="h-10 w-20 rounded-xl border border-slate-200 bg-white px-2 text-right text-sm font-semibold text-slate-950 outline-none transition-all focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
                      />
                    </div>
                  </div>
                )
              )}
            </div>

            {erroreLavorazioniUscita && (
              <p className="mx-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 text-sm font-medium text-rose-700">
                {
                  erroreLavorazioniUscita
                }
              </p>
            )}

            <div className="flex gap-3 border-t border-slate-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={
                  resetLavorazioniUscita
                }
                disabled={loadingTimbratura}
                className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-white p-3 font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {
                  TIMBRATURE_LAVORAZIONI_TESTI.ANNULLA
                }
              </button>

              <button
                type="button"
                onClick={
                  handleConfermaLavorazioniUscita
                }
                disabled={loadingTimbratura}
                className="min-h-12 flex-1 rounded-2xl bg-slate-950 p-3 font-semibold text-white shadow-lg shadow-slate-950/10 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loadingTimbratura
                  ? TIMBRATURE_LAVORAZIONI_TESTI.SALVATAGGIO
                  : dialogCambioCantiere
                    ? TIMBRATURE_LAVORAZIONI_TESTI
                        .SALVA_CAMBIO_CANTIERE
                    : TIMBRATURE_LAVORAZIONI_TESTI.SALVA_USCITA}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
