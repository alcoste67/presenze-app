"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAuthError } from "@supabase/supabase-js";
import { ArrowRight } from "lucide-react";

import {
  AUTH_ERROR_CODES,
  AUTH_HTTP_STATUS,
  AUTH_OTP,
  AUTH_TESTI,
} from "@/constants/auth";
import { APP_ROUTES } from "@/constants/routes";

import { isDipendenteAttivo } from "@/services/dipendenti/isDipendenteAttivo";
import { inviaCodiceOtp } from "@/services/auth/inviaCodiceOtp";
import { verificaCodiceOtp } from "@/services/auth/verificaCodiceOtp";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function isErroreRateLimitAuth(error: unknown): boolean {
  return (
    isAuthError(error) &&
    (error.status === AUTH_HTTP_STATUS.TROPPE_RICHIESTE ||
      error.code === AUTH_ERROR_CODES.OVER_REQUEST_RATE_LIMIT ||
      error.code === AUTH_ERROR_CODES.OVER_EMAIL_SEND_RATE_LIMIT)
  );
}

function getMessaggioErroreAuth(error: unknown): string {
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

function formattaCooldownAuth(secondi: number): string {
  return `${AUTH_TESTI.COOLDOWN_PREFIX} ${secondi}${AUTH_TESTI.COOLDOWN_SUFFIX}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();

  const [emailLogin, setEmailLogin] = useState("");
  const [codiceOtp, setCodiceOtp] = useState("");
  const [codiceInviato, setCodiceInviato] = useState(false);
  const [loadingInvioCodice, setLoadingInvioCodice] = useState(false);
  const [loadingVerificaCodice, setLoadingVerificaCodice] = useState(false);
  const [erroreAuth, setErroreAuth] = useState<string | null>(null);
  const [messaggioAuth, setMessaggioAuth] = useState<string | null>(null);
  const [cooldownOtp, setCooldownOtp] = useState(0);

  const loadingAuth = loadingInvioCodice || loadingVerificaCodice;

  useEffect(() => {
    if (cooldownOtp <= 0) return;

    const timer = window.setTimeout(() => {
      setCooldownOtp((s) => Math.max(s - 1, 0));
    }, AUTH_OTP.COOLDOWN_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [cooldownOtp]);

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

      await verificaCodiceOtp({ email: emailNormalizzata, token });

      router.push(APP_ROUTES.HOME);
    } catch (error: unknown) {
      setErroreAuth(getMessaggioErroreAuth(error));
    } finally {
      setLoadingVerificaCodice(false);
    }
  };

  const testoInvioCodice = loadingInvioCodice
    ? AUTH_TESTI.INVIO_CODICE
    : cooldownOtp > 0
      ? formattaCooldownAuth(cooldownOtp)
      : codiceInviato
        ? AUTH_TESTI.REINVIA_CODICE
        : AUTH_TESTI.INVIA_CODICE;

  return (
    <div className="min-h-dvh bg-bg-base flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/cantivo-logo.png"
            alt="Cantivo"
            className="h-12 w-auto"
          />
          <h1 className="mt-6 font-heading text-2xl font-medium text-text-primary">
            Accedi a Cantivo
          </h1>
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
                disabled={loadingAuth || codiceOtp.length !== AUTH_OTP.CODICE_LENGTH}
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

        <p className="mt-4 text-center text-xs text-text-muted">
          Non hai un account?{" "}
          <Link href="/registrati" className="text-brand-500 hover:underline">
            Registrati
          </Link>
        </p>
      </div>
    </div>
  );
}
