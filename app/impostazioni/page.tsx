"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { APP_ROUTES } from "@/constants/routes";
import { API_HEADERS } from "@/constants/api";
import { supabase } from "@/lib/supabase";
import { getMessaggioErrore } from "@/lib/errors";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { isAdmin } from "@/services/dipendenti/isAdmin";

// ─── Types ────────────────────────────────────────────────────────────────────

type Colori = { primary: string; secondary: string };

type DatiAzienda = {
  nome: string;
  partita_iva: string;
  codice_fiscale: string;
  indirizzo: string;
  email: string;
  telefono: string;
  sito_web: string;
  logo_url: string | null;
  colori: Colori;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FORM_INIZIALE: DatiAzienda = {
  nome: "",
  partita_iva: "",
  codice_fiscale: "",
  indirizzo: "",
  email: "",
  telefono: "",
  sito_web: "",
  logo_url: null,
  colori: { primary: "#e95624", secondary: "#1a1a2e" },
};

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const PALETTE_COLORI = [
  "#e95624",
  "#1e2d4a",
  "#16a34a",
  "#7c3aed",
  "#dc2626",
] as const;

// ─── Helper ───────────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessione utente non valida");
  return token;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImpostazioniPage() {
  const router = useRouter();
  const toast = useToast();

  const [autorizzato, setAutorizzato] = useState(false);
  const [caricamento, setCaricamento] = useState(true);
  const [form, setForm] = useState<DatiAzienda>(FORM_INIZIALE);
  const [salvataggio, setSalvataggio] = useState(false);
  const [uploadLogo, setUploadLogo] = useState(false);

  // ── Auth + caricamento dati ────────────────────────────────────────────────

  useEffect(() => {
    let attivo = true;

    const inizializza = async () => {
      try {
        const user = await loadUtenteAuth();

        if (!user?.email) {
          router.replace(APP_ROUTES.HOME);
          return;
        }

        const adminOk = await isAdmin(user.email);
        if (!adminOk) {
          router.replace(APP_ROUTES.HOME);
          return;
        }

        if (!attivo) return;
        setAutorizzato(true);

        const token = await getAccessToken();
        const res = await fetch("/api/azienda/impostazioni", {
          headers: {
            [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
          },
        });

        if (!res.ok) throw new Error("Errore caricamento dati azienda");

        const data = (await res.json()) as Partial<DatiAzienda>;

        if (attivo) {
          setForm({
            nome: data.nome ?? "",
            partita_iva: data.partita_iva ?? "",
            codice_fiscale: data.codice_fiscale ?? "",
            indirizzo: data.indirizzo ?? "",
            email: data.email ?? "",
            telefono: data.telefono ?? "",
            sito_web: data.sito_web ?? "",
            logo_url: data.logo_url ?? null,
            colori: {
              primary: data.colori?.primary ?? "#e95624",
              secondary: data.colori?.secondary ?? "#1a1a2e",
            },
          });
        }
      } catch (error: unknown) {
        if (attivo)
          toast.error(getMessaggioErrore(error, "Errore caricamento impostazioni"));
      } finally {
        if (attivo) setCaricamento(false);
      }
    };

    void inizializza();
    return () => {
      attivo = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Salva dati + colori ────────────────────────────────────────────────────

  const handleSalva = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setSalvataggio(true);
      const token = await getAccessToken();
      const res = await fetch("/api/azienda/impostazioni", {
        method: "PATCH",
        headers: {
          [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
        },
        body: JSON.stringify({
          nome: form.nome.trim(),
          partita_iva: form.partita_iva.trim() || null,
          codice_fiscale: form.codice_fiscale.trim() || null,
          indirizzo: form.indirizzo.trim() || null,
          email: form.email.trim() || null,
          telefono: form.telefono.trim() || null,
          sito_web: form.sito_web.trim() || null,
          colori: form.colori,
        }),
      });
      if (!res.ok) throw new Error("Errore salvataggio");
      if (form.colori.primary) {
        document.documentElement.style.setProperty('--color-brand-500', form.colori.primary);
      }
      toast.success("Impostazioni salvate");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore salvataggio impostazioni"));
    } finally {
      setSalvataggio(false);
    }
  };

  // ── Upload logo ────────────────────────────────────────────────────────────

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Formato non supportato. Usa PNG o JPG.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("File troppo grande. Massimo 2MB.");
      e.target.value = "";
      return;
    }

    try {
      setUploadLogo(true);
      const token = await getAccessToken();
      const body = new FormData();
      body.append("logo", file);
      const res = await fetch("/api/azienda/logo", {
        method: "POST",
        headers: {
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
        },
        body,
      });
      if (!res.ok) throw new Error("Errore upload logo");
      const data = (await res.json()) as { logo_url: string };
      setForm((f) => ({ ...f, logo_url: data.logo_url }));
      toast.success("Logo caricato");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore upload logo"));
    } finally {
      setUploadLogo(false);
      e.target.value = "";
    }
  };

  const handleRimuoviLogo = async () => {
    try {
      setUploadLogo(true);
      const token = await getAccessToken();
      const res = await fetch("/api/azienda/logo", {
        method: "DELETE",
        headers: {
          [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}`,
        },
      });
      if (!res.ok) throw new Error("Errore rimozione logo");
      setForm((f) => ({ ...f, logo_url: null }));
      toast.success("Logo rimosso");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore rimozione logo"));
    } finally {
      setUploadLogo(false);
    }
  };

  // ── Schermata di caricamento ───────────────────────────────────────────────

  if (!autorizzato || caricamento) {
    return (
      <div className="min-h-dvh bg-bg-base flex items-center justify-center">
        <p className="text-sm text-text-muted">Caricamento...</p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-bg-base">
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Link
          href={APP_ROUTES.BACKOFFICE}
          className="mb-6 inline-flex items-center gap-1 text-sm text-text-muted transition-colors duration-150 hover:text-text-primary"
        >
          ← Back-office
        </Link>

        <h1 className="font-heading text-2xl font-medium text-text-primary">
          Impostazioni azienda
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Gestisci i dati, il logo e i colori del tuo profilo azienda.
        </p>

        <div className="mt-8 flex flex-col gap-6">

          {/* ── Sezione 1: Dati azienda ── */}
          <Card className="p-6">
            <h2 className="font-heading text-base font-medium text-text-primary mb-5">
              Dati azienda
            </h2>
            <form onSubmit={(e) => void handleSalva(e)} className="flex flex-col gap-4">
              <Input
                label="Nome azienda *"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                disabled={salvataggio}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Partita IVA"
                  value={form.partita_iva}
                  onChange={(e) => setForm((f) => ({ ...f, partita_iva: e.target.value }))}
                  disabled={salvataggio}
                />
                <Input
                  label="Codice fiscale"
                  value={form.codice_fiscale}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, codice_fiscale: e.target.value }))
                  }
                  disabled={salvataggio}
                />
              </div>
              <Input
                label="Indirizzo"
                value={form.indirizzo}
                onChange={(e) => setForm((f) => ({ ...f, indirizzo: e.target.value }))}
                disabled={salvataggio}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  disabled={salvataggio}
                />
                <Input
                  label="Telefono"
                  type="tel"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  disabled={salvataggio}
                />
              </div>
              <Input
                label="Sito web"
                type="url"
                value={form.sito_web}
                onChange={(e) => setForm((f) => ({ ...f, sito_web: e.target.value }))}
                disabled={salvataggio}
              />

              {/* ── Sezione 3: Colori brand ── */}
              <div className="border-t border-border pt-4 mt-2">
                <p className="text-sm font-medium text-text-primary mb-3">Colori brand</p>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-text-muted">Colore primario</span>
                    <div className="flex gap-2">
                      {PALETTE_COLORI.map((colore) => (
                        <button
                          key={colore}
                          type="button"
                          disabled={salvataggio}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              colori: { ...f.colori, primary: colore },
                            }))
                          }
                          style={{ backgroundColor: colore }}
                          aria-label={colore}
                          className={`h-8 w-8 rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50${form.colori.primary === colore ? " ring-2 ring-offset-2 ring-gray-800" : " cursor-pointer"}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs text-text-muted">Colore secondario</span>
                    <div className="flex gap-2">
                      {PALETTE_COLORI.map((colore) => (
                        <button
                          key={colore}
                          type="button"
                          disabled={salvataggio}
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              colori: { ...f.colori, secondary: colore },
                            }))
                          }
                          style={{ backgroundColor: colore }}
                          aria-label={colore}
                          className={`h-8 w-8 rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50${form.colori.secondary === colore ? " ring-2 ring-offset-2 ring-gray-800" : " cursor-pointer"}`}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Live preview */}
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-md px-3 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: form.colori.primary }}
                    >
                      Primario
                    </span>
                    <span
                      className="inline-flex items-center rounded-md px-3 py-1 text-xs font-medium text-white"
                      style={{ backgroundColor: form.colori.secondary }}
                    >
                      Secondario
                    </span>
                  </div>
                </div>
              </div>

              <Button type="submit" loading={salvataggio} className="mt-2 self-start">
                Salva impostazioni
              </Button>
            </form>
          </Card>

          {/* ── Sezione 2: Logo ── */}
          <Card className="p-6">
            <h2 className="font-heading text-base font-medium text-text-primary mb-1">
              Logo azienda
            </h2>
            <p className="text-xs text-text-muted mb-5">PNG o JPG, massimo 2MB.</p>

            <div className="flex flex-wrap items-center gap-4">
              {form.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.logo_url}
                  alt="Logo azienda"
                  className="h-16 w-auto max-w-[160px] rounded-md border border-border object-contain p-1"
                />
              )}

              <div className="flex items-center gap-2">
                <label
                  htmlFor="logo-upload"
                  className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-medium text-white transition-colors bg-brand-500 hover:bg-brand-600 ${uploadLogo ? "pointer-events-none opacity-50" : ""}`}
                >
                  {uploadLogo
                    ? "Caricamento..."
                    : form.logo_url
                      ? "Sostituisci"
                      : "Carica logo"}
                </label>

                {form.logo_url && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleRimuoviLogo()}
                    disabled={uploadLogo}
                  >
                    Rimuovi
                  </Button>
                )}
              </div>

              <input
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(e) => void handleLogoChange(e)}
                disabled={uploadLogo}
              />
            </div>
          </Card>

        </div>
      </main>
    </div>
  );
}
