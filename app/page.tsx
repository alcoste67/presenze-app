"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";
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
import { TIMBRATURE } from "@/constants/stati";
import { TipoAttivita } from "@/types/attivita";
import { TipoTimbratura } from "@/types/timbrature";

import { ascoltaSessioneAuth } from "@/services/auth/ascoltaSessioneAuth";
import { esciAuth } from "@/services/auth/esciAuth";
import { inviaCodiceOtp } from "@/services/auth/inviaCodiceOtp";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { verificaCodiceOtp } from "@/services/auth/verificaCodiceOtp";
import { loadCantieri } from "@/services/cantieri/loadCantieri";
import { isAdmin } from "@/services/dipendenti/isAdmin";

import { useTimbrature } from "@/hooks/useTimbrature";

import { StatoBadge } from "@/components/timbrature/StatoBadge";
import { PulsantiTimbratura } from "@/components/timbrature/PulsantiTimbratura";
import { SelectAttivita } from "@/components/attivita/SelectAttivita";
import { SelectCantiere } from "@/components/cantieri/SelectCantiere";

type Cantiere = {
  id: string;
  nome: string;
};

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

    const init = async () => {
      try {
        // =========================
        // USER
        // =========================

        const user = await loadUtenteAuth();

        setUser(user);
        await refreshMostraBackoffice(user);

        // =========================
        // CANTIERI
        // =========================

        const cantieriData =
          await loadCantieri();

        setCantieri(cantieriData);

        // =========================
        // ULTIMA TIMBRATURA
        // =========================

        if (user) {
          await refreshUltimaTimbratura(
            user.id
          );
        }
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

          setUser(currentUser);
          await refreshMostraBackoffice(
            currentUser
          );

          await refreshUltimaTimbratura(
            currentUser?.id || null
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

  const handleTimbraturaPage = async (
    tipo: TipoTimbratura
  ) => {
    if (tipo === TIMBRATURE.ENTRATA) {
      if (!cantiereId && !attivitaTipo) {
        alert(
          "Seleziona un cantiere oppure un'attività"
        );

        return;
      }

      if (cantiereId && attivitaTipo) {
        alert(
          "Seleziona solo un cantiere oppure solo un'attività"
        );

        return;
      }
    }

    try {
      await handleTimbratura({
        cantiereId: cantiereId || null,
        attivitaTipo: attivitaTipo || null,
        tipo,
      });

      alert(
        `Timbratura ${tipo} registrata`
      );
    } catch (error: unknown) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Errore timbratura"
      );
    }
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

  // =========================
  // LOADING INIT
  // =========================

  if (!inizializzato) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-900">
        <div className="text-gray-500">
          Caricamento...
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
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6 text-gray-900">
        {/* HEADER */}

        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold mb-2">
            PRESENZE APP
          </h1>

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
            className="text-sm font-semibold text-gray-500"
          >
            Logout
          </button>
        </div>

        <div className="mb-4 flex gap-4 text-sm font-semibold">
          <Link
            href="/storico"
            className="text-blue-600"
          >
            Storico
          </Link>

          {mostraBackoffice && (
            <Link
              href="/backoffice"
              className="text-blue-600"
            >
              Back-office
            </Link>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-6">
          Utente: {user.email}
        </p>

        {/* CANTIERE */}

        <SelectCantiere
          cantieri={cantieri}
          cantiereId={cantiereId}
          onChange={handleCantiereChange}
        />

        <SelectAttivita
          attivitaTipo={attivitaTipo}
          onChange={handleAttivitaChange}
        />

        {/* STATO */}

        <StatoBadge
          stato={statoAttuale}
          ultimaTimbratura={
            ultimaTimbratura
          }
        />

        {/* BOTTONI */}

        <PulsantiTimbratura
          statoAttuale={statoAttuale}
          loading={loadingTimbratura}
          onTimbratura={
            handleTimbraturaPage
          }
        />
      </div>
    </main>
  );
}
