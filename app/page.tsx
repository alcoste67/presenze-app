"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { isAuthError, type User } from "@supabase/supabase-js";

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

import { A2CLogo } from "@/components/a2c-logo";
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
      <main className="min-h-dvh bg-[#0B0B0C] px-4 text-[#FAFAF7]">
        <div className="flex min-h-dvh items-center justify-center">
          <div className="flex items-center gap-3 border border-[#2B2B2F] bg-[#0F0F10] px-4 py-3 text-[10px] font-medium uppercase tracking-[0.24em] text-[#FAFAF7]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#FF6B1A] border-t-transparent" />
            {TIMBRATURE_TESTI.UI.CARICAMENTO}
          </div>
        </div>
      </main>
    );
  }

  // =========================
  // LOGIN
  // =========================

  if (!user) {
    return (
      <main className="min-h-dvh bg-[#0B0B0C] px-4 py-6 text-[#FAFAF7]">
        <div className="mx-auto flex min-h-dvh w-full max-w-md items-center">
          <section className="w-full border border-[#2B2B2F] bg-[#0F0F10] p-5">
            <A2CLogo color="auto" className="h-12 w-auto" />
            <p className="mt-4 text-[10px] font-medium uppercase tracking-[0.28em] text-[#8C8780]">
              {AUTH_TESTI.TITOLO}
            </p>
            <h1 className="mt-2 text-3xl font-medium tracking-tight text-[#FAFAF7]">
              {AUTH_TESTI.TITOLO}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#C7C2B7]">
              {TIMBRATURE_TESTI.UI.APP_SOTTOTITOLO}
            </p>

            <form
              onSubmit={handleInviaCodiceOtp}
              noValidate
              className="mt-6 space-y-4"
            >
              <label className="block">
                <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.24em] text-[#8C8780]">
                  {AUTH_TESTI.EMAIL_LABEL}
                </span>

                <input
                  type="email"
                  value={emailLogin}
                  onChange={handleEmailLoginChange}
                  placeholder={AUTH_TESTI.EMAIL_PLACEHOLDER}
                  autoComplete="email"
                  disabled={loadingAuth}
                  className="h-12 w-full rounded-none border border-[#2B2B2F] bg-[#161617] px-4 text-sm text-[#FAFAF7] outline-none transition-colors placeholder:text-[#6F6A61] focus:border-[#FF6B1A] disabled:cursor-not-allowed disabled:bg-[#141416] disabled:text-[#8C8780]"
                />
              </label>

              <button
                type="submit"
                disabled={loadingAuth || cooldownOtp > 0}
                className="inline-flex h-12 w-full items-center justify-center gap-2 border border-[#FF6B1A] bg-[#FF6B1A] px-4 text-[10px] font-medium uppercase tracking-[0.24em] text-white transition-colors hover:bg-[#f65e0e] disabled:cursor-not-allowed disabled:border-[#2B2B2F] disabled:bg-[#1A1A1C] disabled:text-[#8C8780]"
              >
                {loadingAuth ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {AUTH_TESTI.INVIO_CODICE}
                  </>
                ) : (
                  testoInvioCodice
                )}
              </button>
            </form>

            {codiceInviato && (
              <form
                onSubmit={handleVerificaCodiceOtp}
                noValidate
                className="mt-4 space-y-4"
              >
                <label className="block">
                  <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.24em] text-[#8C8780]">
                    {AUTH_TESTI.CODICE_LABEL}
                  </span>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern={AUTH_OTP.CODICE_PATTERN}
                    maxLength={AUTH_OTP.CODICE_LENGTH}
                    value={codiceOtp}
                    onChange={handleCodiceOtpChange}
                    placeholder={AUTH_TESTI.CODICE_PLACEHOLDER}
                    autoComplete="one-time-code"
                    disabled={loadingAuth}
                    className="h-12 w-full rounded-none border border-[#2B2B2F] bg-[#161617] px-4 text-center text-2xl font-medium tracking-[0.35em] text-[#FAFAF7] outline-none transition-colors placeholder:text-[#6F6A61] focus:border-[#FF6B1A] disabled:cursor-not-allowed disabled:bg-[#141416] disabled:text-[#8C8780]"
                  />
                </label>

                <button
                  type="submit"
                  disabled={
                    loadingAuth ||
                    codiceOtp.length !==
                      AUTH_OTP.CODICE_LENGTH
                  }
                  className="inline-flex h-12 w-full items-center justify-center gap-2 border border-[#2B2B2F] bg-[#161617] px-4 text-[10px] font-medium uppercase tracking-[0.24em] text-[#FAFAF7] transition-colors hover:border-[#FF6B1A] disabled:cursor-not-allowed disabled:border-[#2B2B2F] disabled:bg-[#141416] disabled:text-[#8C8780]"
                >
                  {loadingVerificaCodice ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {AUTH_TESTI.VERIFICA_IN_CORSO}
                    </>
                  ) : (
                    AUTH_TESTI.VERIFICA_CODICE
                  )}
                </button>
              </form>
            )}

            <div aria-live="polite" className="mt-4 min-h-6">
              {messaggioAuth && (
                <p className="border border-[#2B2B2F] bg-[#161617] p-3 text-sm text-[#FAFAF7]">
                  {messaggioAuth}
                </p>
              )}

              {erroreAuth && (
                <p className="border border-[#5B2A29] bg-[#1A1112] p-3 text-sm text-[#FFB3A6]">
                  {erroreAuth}
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    );
  }

  // =========================
  // UI
  // =========================

  return (
    <main className="min-h-dvh bg-[#0B0B0C] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-[#FAFAF7]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <header className="border border-[#2B2B2F] bg-[#0F0F10] p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <A2CLogo color="auto" className="h-10 w-auto" />
              <p className="mt-3 text-[10px] font-medium uppercase tracking-[0.28em] text-[#8C8780]">
                {TIMBRATURE_TESTI.UI.APP_SOTTOTITOLO}
              </p>
              <h1 className="mt-2 text-4xl font-medium tracking-tight text-[#FAFAF7]">
                {TIMBRATURE_TESTI.UI.APP_TITOLO}
              </h1>
              <p className="mt-2 truncate text-sm text-[#C7C2B7]">
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
                  alert(getMessaggioErroreAuth(error));
                }
              }}
              className="inline-flex h-10 items-center gap-2 border border-[#2B2B2F] bg-[#161617] px-3 text-[10px] font-medium uppercase tracking-[0.24em] text-[#C7C2B7] transition-colors hover:border-[#FF6B1A] hover:text-[#FAFAF7]"
            >
              {TIMBRATURE_TESTI.UI.LOGOUT}
            </button>
          </div>

          <nav className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/storico"
              className="inline-flex h-10 items-center gap-2 border border-[#2B2B2F] bg-[#161617] px-3 text-[10px] font-medium uppercase tracking-[0.24em] text-[#FAFAF7] transition-colors hover:border-[#FF6B1A] hover:text-[#FF6B1A]"
            >
              {TIMBRATURE_TESTI.UI.STORICO}
            </Link>

            {mostraBackoffice && (
              <Link
                href="/backoffice"
                className="inline-flex h-10 items-center gap-2 border border-[#FF6B1A] bg-[#FF6B1A] px-3 text-[10px] font-medium uppercase tracking-[0.24em] text-white transition-colors hover:bg-[#f65e0e]"
              >
                {TIMBRATURE_TESTI.UI.BACKOFFICE}
              </Link>
            )}
          </nav>
        </header>

        <section className="border border-[#2B2B2F] bg-[#161617] p-4">
          <div className="mb-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-[#8C8780]">
              {TIMBRATURE_TESTI.UI.DESTINAZIONE_TITOLO}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#C7C2B7]">
              {TIMBRATURE_TESTI.UI.DESTINAZIONE_DESCRIZIONE}
            </p>
          </div>

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
        </section>

        <StatoBadge
          stato={statoAttuale}
          ultimaTimbratura={ultimaTimbratura}
        />

        <PulsantiTimbratura
          statoAttuale={statoAttuale}
          loading={loadingTimbratura}
          onTimbratura={handleTimbraturaPage}
        />
      </div>

      {mostraLavorazioniUscita && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lavorazioni-uscita-titolo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-hidden border border-[#2B2B2F] bg-[#0F0F10] text-[#FAFAF7]">
            <div className="border-b border-[#2B2B2F] p-4">
              <h2
                id="lavorazioni-uscita-titolo"
                className="text-xl font-medium tracking-tight"
              >
                {dialogCambioCantiere
                  ? TIMBRATURE_LAVORAZIONI_TESTI.TITOLO_CAMBIO_CANTIERE
                  : TIMBRATURE_LAVORAZIONI_TESTI.TITOLO_USCITA}
              </h2>

              <p className="mt-2 text-sm leading-6 text-[#C7C2B7]">
                {dialogCambioCantiere
                  ? TIMBRATURE_LAVORAZIONI_TESTI.DESCRIZIONE_CAMBIO_CANTIERE
                  : TIMBRATURE_LAVORAZIONI_TESTI.DESCRIZIONE_USCITA}
              </p>
            </div>

            <div className="flex max-h-[52dvh] flex-col gap-3 overflow-y-auto p-4">
              {lavorazioniUscita.map((lavorazione) => (
                <div
                  key={lavorazione.id}
                  className="flex flex-col gap-4 border border-[#2B2B2F] bg-[#161617] p-4"
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={lavorazioniUscitaSelezionate.includes(
                        lavorazione.id
                      )}
                      onChange={() =>
                        toggleLavorazioneUscita(lavorazione)
                      }
                      disabled={loadingTimbratura}
                      id={`lavorazione-uscita-${lavorazione.id}`}
                      className="h-5 w-5 border-[#2B2B2F] bg-[#0F0F10] text-[#FF6B1A] accent-[#FF6B1A]"
                    />

                    <label
                      htmlFor={`lavorazione-uscita-${lavorazione.id}`}
                      className="min-w-0 flex-1 text-sm font-medium leading-5 text-[#FAFAF7]"
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
                      disabled={loadingTimbratura}
                      className="min-w-0 flex-1 accent-[#FF6B1A]"
                    />

                    <input
                      type="number"
                      min={LAVORAZIONI_LIMITI.PERCENTUALE_MIN}
                      max={LAVORAZIONI_LIMITI.PERCENTUALE_MAX}
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
                      disabled={loadingTimbratura}
                      className="h-10 w-20 rounded-none border border-[#2B2B2F] bg-[#0F0F10] px-2 text-right text-sm font-medium text-[#FAFAF7] outline-none transition-colors focus:border-[#FF6B1A] disabled:cursor-not-allowed disabled:bg-[#141416] disabled:text-[#8C8780]"
                    />
                  </div>
                </div>
              ))}
            </div>

            {erroreLavorazioniUscita && (
              <p className="mx-4 border border-[#5B2A29] bg-[#1A1112] p-3 text-sm font-medium text-[#FFB3A6]">
                {erroreLavorazioniUscita}
              </p>
            )}

            <div className="flex gap-3 border-t border-[#2B2B2F] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={resetLavorazioniUscita}
                disabled={loadingTimbratura}
                className="min-h-12 flex-1 border border-[#2B2B2F] bg-[#161617] p-3 text-[10px] font-medium uppercase tracking-[0.24em] text-[#FAFAF7] transition-colors hover:border-[#FF6B1A] disabled:cursor-not-allowed disabled:bg-[#141416] disabled:text-[#8C8780]"
              >
                {TIMBRATURE_LAVORAZIONI_TESTI.ANNULLA}
              </button>

              <button
                type="button"
                onClick={handleConfermaLavorazioniUscita}
                disabled={loadingTimbratura}
                className="min-h-12 flex-1 border border-[#FF6B1A] bg-[#FF6B1A] p-3 text-[10px] font-medium uppercase tracking-[0.24em] text-white transition-colors hover:bg-[#f65e0e] disabled:cursor-not-allowed disabled:border-[#2B2B2F] disabled:bg-[#1A1A1C] disabled:text-[#8C8780]"
              >
                {loadingTimbratura
                  ? TIMBRATURE_LAVORAZIONI_TESTI.SALVATAGGIO
                  : dialogCambioCantiere
                    ? TIMBRATURE_LAVORAZIONI_TESTI.SALVA_CAMBIO_CANTIERE
                    : TIMBRATURE_LAVORAZIONI_TESTI.SALVA_USCITA}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
