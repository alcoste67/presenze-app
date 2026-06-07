"use client";

import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormAzienda = {
  nome: string;
  forma_societaria: string;
  partita_iva: string;
  codice_fiscale: string;
  sede_legale_via: string;
  sede_legale_cap: string;
  sede_legale_citta: string;
  sede_legale_provincia: string;
  email: string;
  pec: string;
  codice_sdi: string;
  telefono: string;
  sito_web: string;
};

type FormAdmin = {
  nome: string;
  cognome: string;
  email: string;
};

type Errori = Partial<Record<keyof FormAzienda | keyof FormAdmin, string>>;

// ─── Constants ────────────────────────────────────────────────────────────────

const FORME_SOCIETARIE = [
  "Ditta individuale",
  "S.r.l.",
  "S.r.l.s.",
  "S.p.A.",
  "S.n.c.",
  "S.a.s.",
  "Associazione",
  "Altro",
] as const;

const FORM_AZIENDA_INIZIALE: FormAzienda = {
  nome: "",
  forma_societaria: "",
  partita_iva: "",
  codice_fiscale: "",
  sede_legale_via: "",
  sede_legale_cap: "",
  sede_legale_citta: "",
  sede_legale_provincia: "",
  email: "",
  pec: "",
  codice_sdi: "0000000",
  telefono: "",
  sito_web: "",
};

const FORM_ADMIN_INIZIALE: FormAdmin = {
  nome: "",
  cognome: "",
  email: "",
};

// ─── Validation ───────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validaStep1(form: FormAzienda): Errori {
  const errori: Errori = {};
  if (!form.nome.trim())
    errori.nome = "Il nome azienda è obbligatorio";
  if (form.partita_iva.trim() && !/^\d{11}$/.test(form.partita_iva.trim()))
    errori.partita_iva = "Deve essere di 11 cifre";
  if (form.codice_fiscale.trim() && form.codice_fiscale.trim().length !== 16)
    errori.codice_fiscale = "Deve essere di 16 caratteri";
  if (form.sede_legale_cap.trim() && !/^\d{5}$/.test(form.sede_legale_cap.trim()))
    errori.sede_legale_cap = "Il CAP deve essere di 5 cifre";
  if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim()))
    errori.email = "Email non valida";
  if (form.pec.trim() && !EMAIL_REGEX.test(form.pec.trim()))
    errori.pec = "PEC non valida";
  if (form.codice_sdi.trim() && form.codice_sdi.trim().length !== 7)
    errori.codice_sdi = "Deve essere di 7 caratteri";
  return errori;
}

function validaStep2(form: FormAdmin): Errori {
  const errori: Errori = {};
  if (!form.nome.trim()) errori.nome = "Il nome è obbligatorio";
  if (!form.cognome.trim()) errori.cognome = "Il cognome è obbligatorio";
  if (!form.email.trim()) errori.email = "L'email è obbligatoria";
  else if (!EMAIL_REGEX.test(form.email.trim())) errori.email = "Email non valida";
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

  // GDPR
  const [gdprPrivacy, setGdprPrivacy] = useState(false);
  const [gdprMarketing, setGdprMarketing] = useState(false);
  const [gdprTerzi, setGdprTerzi] = useState(false);

  // TODO: re-enable Turnstile captcha before go-live

  // Reset state when returning to step 1
  const tornaAStep1 = () => {
    setStep(1);
    setErrori({});
  };

  // ── Step 1 submit ──────────────────────────────────────────────────────────

  const handleStep1 = (e: FormEvent) => {
    e.preventDefault();
    const nuoviErrori = validaStep1(formAzienda);
    if (Object.keys(nuoviErrori).length > 0) { setErrori(nuoviErrori); return; }
    setErrori({});
    setStep(2);
  };

  // ── Step 2 submit ──────────────────────────────────────────────────────────

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
        body: JSON.stringify({
          azienda: formAzienda,
          admin: formAdmin,
          gdpr_marketing: gdprMarketing,
          gdpr_terzi: gdprTerzi,
        }),
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

  const canSubmit = gdprPrivacy;

  // ── Success ────────────────────────────────────────────────────────────────

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
          <Link
            href="/login"
            className="mt-6 inline-flex h-9 items-center rounded-md bg-brand-500 px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Torna al login
          </Link>
        </Card>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-bg-base flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">

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

            {/* ── STEP 1: Dati azienda ── */}
            {step === 1 && (
              <form onSubmit={handleStep1} noValidate className="flex flex-col gap-4">

                <Input
                  label="Nome azienda *"
                  value={formAzienda.nome}
                  onChange={(e) => setFormAzienda((f) => ({ ...f, nome: e.target.value }))}
                  error={errori.nome}
                  autoFocus
                />

                <Select
                  label="Forma societaria"
                  value={formAzienda.forma_societaria}
                  onChange={(e) =>
                    setFormAzienda((f) => ({ ...f, forma_societaria: e.target.value }))
                  }
                >
                  <option value="">Seleziona...</option>
                  {FORME_SOCIETARIE.map((fs) => (
                    <option key={fs} value={fs}>{fs}</option>
                  ))}
                </Select>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Partita IVA"
                    value={formAzienda.partita_iva}
                    onChange={(e) =>
                      setFormAzienda((f) => ({ ...f, partita_iva: e.target.value }))
                    }
                    error={errori.partita_iva}
                    maxLength={11}
                    inputMode="numeric"
                  />
                  <Input
                    label="Codice fiscale"
                    value={formAzienda.codice_fiscale}
                    onChange={(e) =>
                      setFormAzienda((f) => ({
                        ...f,
                        codice_fiscale: e.target.value.toUpperCase(),
                      }))
                    }
                    error={errori.codice_fiscale}
                    maxLength={16}
                  />
                </div>

                {/* Sede legale */}
                <div>
                  <p className="mb-2 text-sm font-medium text-text-primary">Sede legale</p>
                  <div className="flex flex-col gap-3">
                    <Input
                      label="Via / Indirizzo completo"
                      value={formAzienda.sede_legale_via}
                      onChange={(e) =>
                        setFormAzienda((f) => ({ ...f, sede_legale_via: e.target.value }))
                      }
                    />
                    <div className="grid grid-cols-[auto_1fr_auto] gap-3">
                      <div className="w-24">
                        <Input
                          label="CAP"
                          value={formAzienda.sede_legale_cap}
                          onChange={(e) =>
                            setFormAzienda((f) => ({ ...f, sede_legale_cap: e.target.value }))
                          }
                          error={errori.sede_legale_cap}
                          maxLength={5}
                          inputMode="numeric"
                        />
                      </div>
                      <Input
                        label="Città"
                        value={formAzienda.sede_legale_citta}
                        onChange={(e) =>
                          setFormAzienda((f) => ({ ...f, sede_legale_citta: e.target.value }))
                        }
                      />
                      <div className="w-16">
                        <Input
                          label="Prov."
                          value={formAzienda.sede_legale_provincia}
                          onChange={(e) =>
                            setFormAzienda((f) => ({
                              ...f,
                              sede_legale_provincia: e.target.value.toUpperCase().slice(0, 2),
                            }))
                          }
                          maxLength={2}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Email azienda"
                    type="email"
                    value={formAzienda.email}
                    onChange={(e) =>
                      setFormAzienda((f) => ({ ...f, email: e.target.value }))
                    }
                    error={errori.email}
                  />
                  <Input
                    label="PEC"
                    type="email"
                    value={formAzienda.pec}
                    onChange={(e) =>
                      setFormAzienda((f) => ({ ...f, pec: e.target.value }))
                    }
                    error={errori.pec}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Codice SDI"
                    value={formAzienda.codice_sdi}
                    onChange={(e) =>
                      setFormAzienda((f) => ({ ...f, codice_sdi: e.target.value.toUpperCase() }))
                    }
                    error={errori.codice_sdi}
                    maxLength={7}
                    helperText="Default 0000000 per fatturazione via PEC"
                  />
                  <Input
                    label="Telefono"
                    type="tel"
                    value={formAzienda.telefono}
                    onChange={(e) =>
                      setFormAzienda((f) => ({ ...f, telefono: e.target.value }))
                    }
                  />
                </div>

                <Input
                  label="Sito web"
                  type="url"
                  value={formAzienda.sito_web}
                  onChange={(e) =>
                    setFormAzienda((f) => ({ ...f, sito_web: e.target.value }))
                  }
                  helperText="Opzionale"
                />

                <Button type="submit" className="mt-2 w-full">
                  Continua
                </Button>
              </form>
            )}

            {/* ── STEP 2: Account admin ── */}
            {step === 2 && (
              <form onSubmit={(e) => void handleStep2(e)} noValidate className="flex flex-col gap-4">

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

                {/* GDPR */}
                <div className="flex flex-col gap-3 rounded-md border border-border bg-bg-subtle p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Consensi privacy
                  </p>

                  {/* Required */}
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={gdprPrivacy}
                      onChange={(e) => setGdprPrivacy(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-500"
                    />
                    <span className="text-sm text-text-primary">
                      Ho letto e accetto la{" "}
                      <Link
                        href="/privacy"
                        target="_blank"
                        className="text-brand-500 hover:underline"
                      >
                        Privacy Policy
                      </Link>{" "}
                      e i{" "}
                      <Link
                        href="/termini"
                        target="_blank"
                        className="text-brand-500 hover:underline"
                      >
                        Termini di Servizio
                      </Link>
                      {" "}
                      <span className="text-error-500">*</span>
                    </span>
                  </label>

                  {/* Optional marketing */}
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={gdprMarketing}
                      onChange={(e) => setGdprMarketing(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-500"
                    />
                    <span className="text-sm text-text-secondary">
                      Acconsento al trattamento dei dati per l&apos;invio di comunicazioni
                      commerciali e offerte{" "}
                      <span className="text-text-muted">(opzionale)</span>
                    </span>
                  </label>

                  {/* Optional terzi */}
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={gdprTerzi}
                      onChange={(e) => setGdprTerzi(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-brand-500"
                    />
                    <span className="text-sm text-text-secondary">
                      Acconsento alla cessione dei dati a terzi per finalità di marketing{" "}
                      <span className="text-text-muted">(opzionale)</span>
                    </span>
                  </label>
                </div>

                {erroreGlobale && (
                  <div className="rounded-md bg-error-500/10 px-3 py-2 text-sm text-error-500">
                    {erroreGlobale}
                    {erroreGlobale.includes("già registrata") && (
                      <>
                        {" "}
                        <Link href="/login" className="font-semibold underline">
                          Vai al login →
                        </Link>
                      </>
                    )}
                  </div>
                )}

                <div className="mt-2 flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={tornaAStep1}
                    disabled={loading}
                  >
                    Indietro
                  </Button>
                  <Button
                    type="submit"
                    loading={loading}
                    disabled={!canSubmit}
                    className="flex-1"
                  >
                    Crea account
                  </Button>
                </div>

                {!gdprPrivacy && (
                  <p className="text-center text-xs text-text-muted">
                    Accetta la Privacy Policy per procedere.
                  </p>
                )}
              </form>
            )}
          </Card>

          <p className="mt-4 text-center text-xs text-text-muted">
            Hai già un account?{" "}
            <Link href="/login" className="text-brand-500 hover:underline">
              Accedi
            </Link>
          </p>
        </div>
      </div>
  );
}
