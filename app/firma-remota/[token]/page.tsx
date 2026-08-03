"use client";

import { use, useEffect, useState } from "react";

import { FirmaCanvas } from "@/components/rapportiIntervento/FirmaCanvas";

type Riepilogo = {
  cliente: string;
  cantiere: string;
  indirizzo: string | null;
  data_intervento: string;
  responsabile: string;
  note: string;
  lavorazioni: string[];
};

function formattaData(value: string) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("it-IT").format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

export default function FirmaRemotaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [riepilogo, setRiepilogo] = useState<Riepilogo | null>(null);
  const [nome, setNome] = useState("");
  const [firma, setFirma] = useState<string | null>(null);
  const [invio, setInvio] = useState(false);
  const [fatto, setFatto] = useState(false);

  useEffect(() => {
    const carica = async () => {
      try {
        const res = await fetch(`/api/firma-remota/${token}`);
        const payload = await res.json().catch(() => null);
        if (!res.ok) {
          setErrore(payload?.errore || "Link non valido");
          return;
        }
        setRiepilogo(payload as Riepilogo);
        setNome((payload as Riepilogo).cliente || "");
      } catch {
        setErrore("Errore di caricamento");
      } finally {
        setCaricamento(false);
      }
    };
    void carica();
  }, [token]);

  const handleFirma = async () => {
    if (!firma) return;
    try {
      setInvio(true);
      const res = await fetch(`/api/firma-remota/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmaDataUrl: firma, nome: nome.trim() }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        setErrore(payload?.errore || "Firma non riuscita");
        return;
      }
      setFatto(true);
    } catch {
      setErrore("Errore durante la firma");
    } finally {
      setInvio(false);
    }
  };

  return (
    <main className="min-h-dvh bg-bg-base">
      <div className="mx-auto flex max-w-[560px] flex-col gap-4 px-4 py-6">
        <h1 className="text-xl font-semibold text-text-primary">
          Firma rapporto di lavoro
        </h1>

        {caricamento && (
          <p className="text-sm text-text-muted">Caricamento…</p>
        )}

        {errore && !fatto && (
          <div className="rounded-md border border-error-200 bg-error-50 p-4 text-sm text-error-600">
            {errore}
          </div>
        )}

        {fatto && (
          <div className="rounded-md border border-success-200 bg-success-50 p-4 text-sm text-success-600">
            Grazie, il rapporto è stato firmato correttamente.
          </div>
        )}

        {riepilogo && !fatto && !errore && (
          <>
            <div className="rounded-md border border-border bg-bg-card p-4 text-sm">
              <dl className="grid grid-cols-1 gap-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Cliente</dt>
                  <dd className="text-right font-medium text-text-primary">{riepilogo.cliente}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Cantiere</dt>
                  <dd className="text-right font-medium text-text-primary">{riepilogo.cantiere}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Data</dt>
                  <dd className="text-right font-medium text-text-primary">
                    {formattaData(riepilogo.data_intervento)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-text-muted">Responsabile</dt>
                  <dd className="text-right font-medium text-text-primary">{riepilogo.responsabile}</dd>
                </div>
              </dl>

              {riepilogo.lavorazioni.length > 0 && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1 text-xs font-medium text-text-muted">Lavorazioni</p>
                  <ul className="list-disc pl-5 text-sm text-text-primary">
                    {riepilogo.lavorazioni.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}

              {riepilogo.note && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1 text-xs font-medium text-text-muted">Note</p>
                  <p className="text-sm text-text-primary">{riepilogo.note}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">
                Nome di chi firma
              </label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="h-10 rounded-md border border-border bg-bg-card px-3 text-sm text-text-primary outline-none focus:border-brand-500"
                placeholder="Nome e cognome"
              />
            </div>

            <FirmaCanvas
              label="Firma del cliente"
              clearLabel="Cancella"
              value={firma}
              onChange={setFirma}
              disabled={invio}
            />

            <button
              type="button"
              disabled={!firma || invio}
              onClick={() => void handleFirma()}
              className="h-11 rounded-md bg-brand-500 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              {invio ? "Invio…" : "Firma e conferma"}
            </button>

            <p className="text-center text-xs text-text-muted">
              Firmando confermi la presa visione e l&apos;accettazione del rapporto.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
