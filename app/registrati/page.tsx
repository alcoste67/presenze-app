"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormAzienda = {
  nome: string;
  partita_iva: string;
  codice_fiscale: string;
  indirizzo: string;
  email: string;
  telefono: string;
};

type FormAdmin = {
  nome: string;
  cognome: string;
  email: string;
  password: string;
  conferma_password: string;
};

type Errori = Partial<Record<keyof FormAzienda | keyof FormAdmin, string>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const FORM_AZIENDA_INIZIALE: FormAzienda = {
  nome: "",
  partita_iva: "",
  codice_fiscale: "",
  indirizzo: "",
  email: "",
  telefono: "",
};

const FORM_ADMIN_INIZIALE: FormAdmin = {
  nome: "",
  cognome: "",
  email: "",
  password: "",
  conferma_password: "",
};

// ─── Validation ───────────────────────────────────────────────────────────────

function validaStep1(form: FormAzienda): Errori {
  const errori: Errori = {};
  if (!form.nome.trim()) errori.nome = "Il nome azienda è obbligatorio";
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errori.email = "Email non valida";
  return errori;
}

function validaStep2(form: FormAdmin): Errori {
  const errori: Errori = {};
  if (!form.nome.trim()) errori.nome = "Il nome è obbligatorio";
  if (!form.cognome.trim()) errori.cognome = "Il cognome è obbligatorio";
  if (!form.email.trim()) errori.email = "L'email è obbligatoria";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errori.email = "Email non valida";
  if (!form.password) errori.password = "La password è obbligatoria";
  else if (form.password.length < 8)
    errori.password = "Minimo 8 caratteri";
  if (form.password !== form.conferma_password)
    errori.conferma_password = "Le password non corrispondono";
  return errori;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegistratiPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [formAzienda, setFormAzienda] = useState<FormAzienda>(FORM_AZIENDA_INIZIALE);
  const [formAdmin, setFormAdmin] = useState<FormAdmin>(FORM_ADMIN_INIZIALE);
  const [errori, setErrori] = useState<Errori>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [erroreGlobale, setErroreGlobale] = useState<string | null>(null);

  const handleStep1 = (e: FormEvent) => {
    e.preventDefault();
    const nuoviErrori = validaStep1(formAzienda);
    if (Object.keys(nuoviErrori).length > 0) { setErrori(nuoviErrori); return; }
    setErrori({});
    setStep(2);
  };

  const handleStep2 = async (e: FormEvent) => {
    e.preventDefault();
    const nuoviErrori = validaStep2(formAdmin);
    if (Object.keys(nuoviErrori).length > 0) { setErrori(nuoviErrori); return; }
    setErrori({});
    setErroreGlobale(null);
    try {
      setLoading(true);
      const res = await fetch("/api/auth/registra-azienda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azienda: formAzienda, admin: formAdmin }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Errore durante la registrazione");
      }
      setSuccess(true);
    } catch (error: unknown) {
      setErroreGlobale(
        error instanceof Error ? error.message : "Errore durante la registrazione"
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Success ───────────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="min-h-dvh bg-bg-base flex items-center justify-center px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/10">
            <svg
              className="h-6 w-6 text-brand-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-heading text-xl font-medium text-text-primary">
            Registrazione completata
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Controlla la tua email per confermare l&apos;account.
          </p>
        </Card>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-bg-base flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="mb-8 text-center">
          <h1 className="font-heading text-2xl font-medium text-text-primary">
            Crea il tuo account
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Inizia la tua prova gratuita di 30 giorni
          </p>
        </div>

        {/* Step indicator */}
        <div className="mb-6 flex items-center gap-3">
          {([1, 2] as const).map((s) => (
            <div key={s} className="flex flex-1 flex-col gap-1.5">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors duration-300",
                  s <= step ? "bg-brand-500" : "bg-border"
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  s === step
                    ? "text-brand-500"
                    : s < step
                      ? "text-text-muted"
                      : "text-text-subtle"
                )}
              >
                {s === 1 ? "Dati azienda" : "Account admin"}
              </span>
            </div>
          ))}
        </div>

        <Card className="p-6">
          {step === 1 && (
            <form onSubmit={handleStep1} noValidate className="flex flex-col gap-4">
              <Input
                label="Nome azienda *"
                value={formAzienda.nome}
                onChange={(e) => setFormAzienda((f) => ({ ...f, nome: e.target.value }))}
                error={errori.nome}
                autoFocus
              />
              <Input
                label="Partita IVA"
                value={formAzienda.partita_iva}
                onChange={(e) => setFormAzienda((f) => ({ ...f, partita_iva: e.target.value }))}
              />
              <Input
                label="Codice fiscale"
                value={formAzienda.codice_fiscale}
                onChange={(e) =>
                  setFormAzienda((f) => ({ ...f, codice_fiscale: e.target.value }))
                }
              />
              <Input
                label="Indirizzo"
                value={formAzienda.indirizzo}
                onChange={(e) => setFormAzienda((f) => ({ ...f, indirizzo: e.target.value }))}
              />
              <Input
                label="Email azienda"
                type="email"
                value={formAzienda.email}
                onChange={(e) => setFormAzienda((f) => ({ ...f, email: e.target.value }))}
                error={errori.email}
              />
              <Input
                label="Telefono"
                type="tel"
                value={formAzienda.telefono}
                onChange={(e) => setFormAzienda((f) => ({ ...f, telefono: e.target.value }))}
              />
              <Button type="submit" className="mt-2 w-full">
                Continua
              </Button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleStep2} noValidate className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Nome *"
                  value={formAdmin.nome}
                  onChange={(e) => setFormAdmin((f) => ({ ...f, nome: e.target.value }))}
                  error={errori.nome}
                  autoFocus
                />
                <Input
                  label="Cognome *"
                  value={formAdmin.cognome}
                  onChange={(e) => setFormAdmin((f) => ({ ...f, cognome: e.target.value }))}
                  error={errori.cognome}
                />
              </div>
              <Input
                label="Email *"
                type="email"
                value={formAdmin.email}
                onChange={(e) => setFormAdmin((f) => ({ ...f, email: e.target.value }))}
                error={errori.email}
                helperText="Sarà il tuo indirizzo di login"
              />
              <Input
                label="Password *"
                type="password"
                value={formAdmin.password}
                onChange={(e) => setFormAdmin((f) => ({ ...f, password: e.target.value }))}
                error={errori.password}
                helperText="Minimo 8 caratteri"
              />
              <Input
                label="Conferma password *"
                type="password"
                value={formAdmin.conferma_password}
                onChange={(e) =>
                  setFormAdmin((f) => ({ ...f, conferma_password: e.target.value }))
                }
                error={errori.conferma_password}
              />

              {erroreGlobale && (
                <p className="rounded-md bg-error-500/10 px-3 py-2 text-sm text-error-500">
                  {erroreGlobale}
                </p>
              )}

              <div className="mt-2 flex gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setStep(1);
                    setErrori({});
                  }}
                  disabled={loading}
                >
                  Indietro
                </Button>
                <Button type="submit" loading={loading} className="flex-1">
                  Crea account
                </Button>
              </div>
            </form>
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-text-muted">
          Hai già un account?{" "}
          <a href="/login" className="text-brand-500 hover:underline">
            Accedi
          </a>
        </p>
      </div>
    </div>
  );
}
