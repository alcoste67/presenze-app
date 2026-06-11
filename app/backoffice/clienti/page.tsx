"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Home, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";

import { aggiornaCliente } from "@/services/clienti/aggiornaCliente";
import { cercaClientiSimili } from "@/services/clienti/cercaClientiSimili";
import { creaCliente } from "@/services/clienti/creaCliente";
import { eliminaClienteSeVuoto } from "@/services/clienti/eliminaClienteSeVuoto";
import { loadClienti } from "@/services/clienti/loadClienti";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";

import type { Cliente } from "@/types/clienti";
import type { CantiereBackoffice } from "@/types/cantieri";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { getMessaggioErrore } from "@/lib/errors";

type ClienteForm = {
  ragione_sociale: string;
  email: string;
  telefono: string;
  indirizzo: string;
  note: string;
};

const FORM_INIZIALE: ClienteForm = {
  ragione_sociale: "",
  email: "",
  telefono: "",
  indirizzo: "",
  note: "",
};

export default function BackofficeClientiPage() {
  const toast = useToast();

  const [clienti, setClienti] = useState<Cliente[]>([]);
  const [cantieri, setCantieri] = useState<CantiereBackoffice[]>([]);
  const [form, setForm] = useState<ClienteForm>(FORM_INIZIALE);
  const [clienteInModificaId, setClienteInModificaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);
  const [ricerca, setRicerca] = useState("");
  // Anti-doppioni: nomi simili trovati, in attesa di conferma
  const [similiInAttesa, setSimiliInAttesa] = useState<Cliente[] | null>(null);
  // Eliminazione con doppia conferma: step 1 → step 2
  const [clienteDaEliminare, setClienteDaEliminare] = useState<Cliente | null>(null);
  const [confermaDefinitiva, setConfermaDefinitiva] = useState(false);

  const cantieriPerCliente = useMemo(() => {
    const mappa = new Map<string, CantiereBackoffice[]>();
    for (const cantiere of cantieri) {
      if (!cantiere.cliente_id) continue;
      const lista = mappa.get(cantiere.cliente_id) || [];
      lista.push(cantiere);
      mappa.set(cantiere.cliente_id, lista);
    }
    return mappa;
  }, [cantieri]);

  const clientiFiltrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return clienti;
    return clienti.filter((c) =>
      `${c.ragione_sociale} ${c.email ?? ""}`.toLowerCase().includes(q)
    );
  }, [clienti, ricerca]);

  const formTitolo = clienteInModificaId ? "Modifica cliente" : "Nuovo cliente";

  useEffect(() => {
    let attivo = true;

    const init = async () => {
      try {
        const [clientiData, cantieriData] = await Promise.all([
          loadClienti({ soloAttivi: false }),
          loadCantieriBackoffice(),
        ]);
        if (!attivo) return;
        setClienti(clientiData);
        setCantieri(cantieriData);
      } catch (error: unknown) {
        if (attivo)
          toast.error(getMessaggioErrore(error, "Errore gestione clienti"));
      } finally {
        if (attivo) setLoading(false);
      }
    };

    void init();
    return () => { attivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setForm(FORM_INIZIALE);
    setClienteInModificaId(null);
  };

  const ordina = (lista: Cliente[]) =>
    [...lista].sort((a, b) => a.ragione_sociale.localeCompare(b.ragione_sociale));

  const emailDuplicata = (email: string) => {
    const normalizzata = email.trim().toLowerCase();
    if (!normalizzata) return false;
    return clienti.some(
      (c) =>
        c.id !== clienteInModificaId &&
        c.email?.toLowerCase() === normalizzata
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const ragioneSociale = form.ragione_sociale.trim();
    if (!ragioneSociale) {
      toast.error("Inserisci la ragione sociale");
      return;
    }

    if (emailDuplicata(form.email)) {
      toast.error("Email già usata da un altro cliente");
      return;
    }

    // Anti-doppioni in creazione: nomi simili → chiedi conferma
    if (!clienteInModificaId) {
      try {
        setSalvataggio(true);
        const candidati = await cercaClientiSimili({ nome: ragioneSociale });
        const diversi = candidati.filter(
          (c) =>
            c.ragione_sociale.toLowerCase() !== ragioneSociale.toLowerCase()
        );
        if (diversi.length > 0) {
          setSimiliInAttesa(diversi);
          setSalvataggio(false);
          return;
        }
      } catch {
        // best-effort: in errore si procede con la creazione
      } finally {
        setSalvataggio(false);
      }
    }

    await salvaCliente();
  };

  const salvaCliente = async () => {
    const ragioneSociale = form.ragione_sociale.trim();

    try {
      setSalvataggio(true);

      if (clienteInModificaId) {
        const aggiornato = await aggiornaCliente({
          clienteId: clienteInModificaId,
          cliente: {
            ragione_sociale: ragioneSociale,
            email: form.email.trim() || null,
            telefono: form.telefono.trim() || null,
            indirizzo: form.indirizzo.trim() || null,
            note: form.note.trim(),
          },
        });
        setClienti((correnti) =>
          ordina(correnti.map((c) => (c.id === aggiornato.id ? aggiornato : c)))
        );
        toast.success("Cliente aggiornato");
      } else {
        const nuovo = await creaCliente({
          ragioneSociale,
          email: form.email,
          telefono: form.telefono,
          indirizzo: form.indirizzo,
          note: form.note.trim(),
        });
        setClienti((correnti) => ordina([...correnti, nuovo]));
        toast.success("Cliente creato");
      }

      resetForm();
    } catch (error: unknown) {
      const messaggio = getMessaggioErrore(error, "Errore gestione clienti");
      toast.error(
        messaggio.includes("clienti_email_unica")
          ? "Email già usata da un altro cliente"
          : messaggio
      );
    } finally {
      setSalvataggio(false);
    }
  };

  const avviaModifica = (cliente: Cliente) => {
    setClienteInModificaId(cliente.id);
    setForm({
      ragione_sociale: cliente.ragione_sociale,
      email: cliente.email ?? "",
      telefono: cliente.telefono ?? "",
      indirizzo: cliente.indirizzo ?? "",
      note: cliente.note,
    });
  };

  const eseguiEliminazione = async () => {
    if (!clienteDaEliminare) return;
    const cliente = clienteDaEliminare;
    setClienteDaEliminare(null);
    setConfermaDefinitiva(false);

    try {
      setSalvataggio(true);
      await eliminaClienteSeVuoto({ clienteId: cliente.id });
      setClienti((correnti) => correnti.filter((c) => c.id !== cliente.id));
      if (clienteInModificaId === cliente.id) resetForm();
      toast.success("Cliente eliminato");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore eliminazione cliente"));
    } finally {
      setSalvataggio(false);
    }
  };

  const toggleAttivo = async (cliente: Cliente) => {
    try {
      setSalvataggio(true);
      const aggiornato = await aggiornaCliente({
        clienteId: cliente.id,
        cliente: { attivo: !cliente.attivo },
      });
      setClienti((correnti) =>
        correnti.map((c) => (c.id === aggiornato.id ? aggiornato : c))
      );
      toast.success(aggiornato.attivo ? "Cliente riattivato" : "Cliente disattivato");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore gestione clienti"));
    } finally {
      setSalvataggio(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <>
            <Link href={APP_ROUTES.BACKOFFICE}>
              <Button variant="secondary" size="sm">Back-office</Button>
            </Link>
            <Link href={APP_ROUTES.HOME}>
              <Button variant="secondary" size="sm">Timbrature</Button>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-[1000px] px-6 py-6">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="mb-5 flex items-center gap-1.5 text-sm text-text-muted"
        >
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link href={APP_ROUTES.BACKOFFICE} className="hover:text-text-primary transition-colors duration-150">
            Back-office
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">Clienti</span>
        </nav>

        <h1 className="font-heading text-2xl font-medium text-text-primary">
          Anagrafica clienti
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Clienti e committenti dell&apos;azienda, con cantieri collegati
        </p>

        <div className="mt-6 grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* ── Form ── */}
          <Card className="p-5">
            <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
              {formTitolo}
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Ragione sociale"
                value={form.ragione_sociale}
                onChange={(e) => setForm((f) => ({ ...f, ragione_sociale: e.target.value }))}
                disabled={salvataggio}
              />
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
              <Input
                label="Indirizzo"
                value={form.indirizzo}
                onChange={(e) => setForm((f) => ({ ...f, indirizzo: e.target.value }))}
                disabled={salvataggio}
              />
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-text-primary">Note</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  disabled={salvataggio}
                  rows={3}
                  className="w-full rounded-md border border-border bg-bg-card px-3 py-2 text-sm text-text-primary placeholder:text-text-subtle outline-none transition-colors duration-150 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-bg-subtle disabled:text-text-muted resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  loading={salvataggio}
                  disabled={loading}
                  icon={!salvataggio ? <Plus className="h-4 w-4" /> : undefined}
                  className="flex-1"
                >
                  {clienteInModificaId ? "Salva modifiche" : "Aggiungi cliente"}
                </Button>
                {clienteInModificaId && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={resetForm}
                    disabled={salvataggio}
                  >
                    Annulla
                  </Button>
                )}
              </div>
            </form>
          </Card>

          {/* ── Lista ── */}
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
              <div>
                <h2 className="font-heading text-lg font-medium text-text-primary">
                  Elenco clienti
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {clienti.length} clienti totali
                </p>
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                <input
                  value={ricerca}
                  onChange={(e) => setRicerca(e.target.value)}
                  placeholder="Cerca cliente..."
                  className="h-9 pl-8 pr-3 text-sm border border-border rounded-md bg-bg-card text-text-primary placeholder:text-text-subtle outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors duration-150"
                />
              </div>
            </div>

            {loading && (
              <p className="text-sm text-text-muted py-4">Caricamento...</p>
            )}

            {!loading && clientiFiltrati.length === 0 && (
              <p className="text-sm text-text-muted py-4">
                {ricerca ? "Nessun cliente trovato" : "Nessun cliente in anagrafica"}
              </p>
            )}

            {!loading && clientiFiltrati.length > 0 && (
              <div className="space-y-2">
                {clientiFiltrati.map((cliente) => {
                  const cantieriCollegati =
                    cantieriPerCliente.get(cliente.id) || [];

                  return (
                    <div
                      key={cliente.id}
                      className={cn(
                        "rounded-md border border-border p-3",
                        !cliente.attivo && "opacity-60"
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-text-primary">
                            {cliente.ragione_sociale}
                          </p>
                          <p className="text-xs text-text-muted mt-0.5">
                            {cliente.email || "Email mancante (necessaria per l'invio rapporti)"}
                            {cliente.telefono ? ` · ${cliente.telefono}` : ""}
                          </p>
                          {cantieriCollegati.length > 0 && (
                            <p className="text-xs text-text-subtle mt-0.5">
                              Cantieri: {cantieriCollegati.map((c) => c.nome).join(", ")}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {!cliente.attivo && (
                            <Badge variant="muted" size="sm">Disattivo</Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label="Modifica"
                            onClick={() => avviaModifica(cliente)}
                            disabled={salvataggio}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            aria-label={cliente.attivo ? "Disattiva" : "Riattiva"}
                            onClick={() => void toggleAttivo(cliente)}
                            disabled={salvataggio}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-error-500 hover:text-error-500"
                            aria-label="Elimina"
                            onClick={() => {
                              setConfermaDefinitiva(false);
                              setClienteDaEliminare(cliente);
                            }}
                            disabled={salvataggio}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </main>

      {clienteDaEliminare && !confermaDefinitiva && (
        <ConfirmDialog
          title="Elimina cliente"
          message={`Eliminare «${clienteDaEliminare.ragione_sociale}»? L'operazione non è reversibile. I clienti collegati a cantieri o rapporti non possono essere eliminati.`}
          confirmLabel="Continua"
          onConfirm={() => setConfermaDefinitiva(true)}
          onCancel={() => setClienteDaEliminare(null)}
        />
      )}

      {clienteDaEliminare && confermaDefinitiva && (
        <ConfirmDialog
          title="Conferma definitiva"
          message={`Confermi l'eliminazione definitiva di «${clienteDaEliminare.ragione_sociale}»?`}
          confirmLabel="Elimina definitivamente"
          onConfirm={() => void eseguiEliminazione()}
          onCancel={() => {
            setClienteDaEliminare(null);
            setConfermaDefinitiva(false);
          }}
        />
      )}

      {similiInAttesa && (
        <ConfirmDialog
          title="Possibile doppione"
          message={`Esistono clienti con nome simile: ${similiInAttesa
            .map((c) => c.ragione_sociale)
            .join(", ")}. Creare comunque «${form.ragione_sociale.trim()}»?`}
          confirmLabel="Crea comunque"
          onConfirm={() => {
            setSimiliInAttesa(null);
            void salvaCliente();
          }}
          onCancel={() => setSimiliInAttesa(null)}
        />
      )}
    </div>
  );
}
