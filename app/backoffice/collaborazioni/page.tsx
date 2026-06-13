"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Home, Handshake } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { getAziendaIdFromAuthUser } from "@/lib/multiTenant";
import { supabase } from "@/lib/supabase";
import { loadCantieriBackoffice } from "@/services/cantieri/loadCantieriBackoffice";
import { loadCollaborazioni } from "@/services/collaborazioni/loadCollaborazioni";
import { creaInvitoCollaborazione } from "@/services/collaborazioni/creaInvitoCollaborazione";
import {
  accettaCollaborazione,
  revocaCollaborazione,
} from "@/services/collaborazioni/gestisciCollaborazione";
import { inviaLavorazioniSubappaltatore } from "@/services/collaborazioni/inviaLavorazioniSubappaltatore";
import { segnaCollaborazioniViste } from "@/services/collaborazioni/segnaCollaborazioniViste";
import type { Collaborazione } from "@/types/collaborazioni";
import type { CantiereBackoffice } from "@/types/cantieri";

import { AppHeader } from "@/components/ui/AppHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { getMessaggioErrore } from "@/lib/errors";

export default function BackofficeCollaborazioniPage() {
  const toast = useToast();
  const router = useRouter();

  const [aziendaId, setAziendaId] = useState<string | null>(null);
  const [emailUtente, setEmailUtente] = useState("");
  const [collaborazioni, setCollaborazioni] = useState<Collaborazione[]>([]);
  const [cantieri, setCantieri] = useState<CantiereBackoffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);

  // form invito
  const [cantiereInvitoId, setCantiereInvitoId] = useState("");
  const [emailInvito, setEmailInvito] = useState("");

  const ricarica = async () => {
    const [collab, cant] = await Promise.all([
      loadCollaborazioni(),
      loadCantieriBackoffice(),
    ]);
    setCollaborazioni(collab);
    setCantieri(cant);
  };

  useEffect(() => {
    let attivo = true;
    const init = async () => {
      try {
        const user = await loadUtenteAuth();
        if (!attivo || !user) return;
        setEmailUtente((user.email || "").toLowerCase());
        const aid = await getAziendaIdFromAuthUser(supabase, user.id);
        if (!attivo) return;
        setAziendaId(aid);
        await ricarica();
        // Apertura pagina: spegne le spie di novità del proprio lato
        await segnaCollaborazioniViste();
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, "Errore collaborazioni"));
      } finally {
        if (attivo) setLoading(false);
      }
    };
    void init();
    return () => { attivo = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Inviti ricevuti: indirizzati alla mia email, ancora da accettare,
  // dove non sono io il committente
  const invitiRicevuti = useMemo(
    () =>
      collaborazioni.filter(
        (c) =>
          c.stato === "invitata" &&
          c.email_invito === emailUtente &&
          c.azienda_committente_id !== aziendaId
      ),
    [collaborazioni, emailUtente, aziendaId]
  );

  // Collaborazioni dove sono il committente (inviate)
  const inviate = useMemo(
    () =>
      collaborazioni.filter((c) => c.azienda_committente_id === aziendaId),
    [collaborazioni, aziendaId]
  );

  const handleInvita = async () => {
    if (!cantiereInvitoId || !emailInvito.trim()) {
      toast.error("Seleziona un cantiere e inserisci l'email dell'azienda da invitare");
      return;
    }
    const cantiere = cantieri.find((c) => c.id === cantiereInvitoId);
    try {
      setSalvataggio(true);
      await creaInvitoCollaborazione({
        cantiereId: cantiereInvitoId,
        cantiereNome: cantiere?.nome || "",
        cantiereIndirizzo: cantiere?.indirizzo || "",
        emailInvito,
      });
      setCantiereInvitoId("");
      setEmailInvito("");
      await ricarica();
      toast.success("Invito inviato");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore invito collaborazione"));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleAccetta = async (collab: Collaborazione) => {
    try {
      setSalvataggio(true);
      const esito = await accettaCollaborazione({ collaborazioneId: collab.id });
      toast.success("Collaborazione accettata: cantiere creato");
      // Porta alla pagina lavorazioni col nuovo cantiere caricato
      if (esito?.cantiere_collaboratore_id) {
        router.push(
          `${APP_ROUTES.BACKOFFICE_LAVORAZIONI}?cantiere=${esito.cantiere_collaboratore_id}`
        );
        return;
      }
      await ricarica();
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore accettazione"));
      setSalvataggio(false);
    }
  };

  const handleInviaLavorazioni = async (collab: Collaborazione) => {
    try {
      setSalvataggio(true);
      const esito = await inviaLavorazioniSubappaltatore({ collaborazioneId: collab.id });
      toast.success(
        `${esito.inviate} inviate${esito.rimosse > 0 ? ` · ${esito.rimosse} rimosse` : ""}`
      );
      if (esito.bloccate > 0) {
        toast.error(
          `${esito.bloccate} voci non rimosse: già avanzate dal subappaltatore`
        );
      }
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore invio lavorazioni"));
    } finally {
      setSalvataggio(false);
    }
  };

  const handleRevoca = async (collab: Collaborazione) => {
    try {
      setSalvataggio(true);
      await revocaCollaborazione({ collaborazioneId: collab.id });
      await ricarica();
      toast.success("Collaborazione revocata");
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, "Errore revoca"));
    } finally {
      setSalvataggio(false);
    }
  };

  const badgeStato = (stato: Collaborazione["stato"]) =>
    stato === "accettata" ? "success" : stato === "revocata" ? "muted" : "warning";

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

      <main className="mx-auto max-w-[900px] px-6 py-6">
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link href={APP_ROUTES.BACKOFFICE} className="hover:text-text-primary transition-colors duration-150">
            Back-office
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">Collaborazioni</span>
        </nav>

        <h1 className="font-heading text-2xl font-medium text-text-primary">
          Collaborazioni tra aziende
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Collega un cantiere con un&apos;azienda subappaltatrice: vedrai i suoi
          avanzamenti per il SAL unico. Nessun dato economico viene condiviso.
        </p>

        {loading && <p className="mt-6 text-sm text-text-muted">Caricamento...</p>}

        {!loading && (
          <div className="mt-6 flex flex-col gap-6">
            {/* Inviti ricevuti */}
            {invitiRicevuti.length > 0 && (
              <Card className="border-warning-500/40 p-5">
                <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                  Inviti ricevuti
                </h2>
                <div className="space-y-3">
                  {invitiRicevuti.map((c) => (
                    <div key={c.id} className="rounded-md border border-border bg-bg-subtle p-3">
                      <p className="text-sm text-text-primary">
                        <span className="font-medium">{c.azienda_committente_nome}</span>{" "}
                        ti invita sul cantiere{" "}
                        <span className="font-medium">{c.cantiere_committente_nome}</span>
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        Accettando, il cantiere verrà creato nella tua azienda
                        con le stesse lavorazioni (cliente: {c.azienda_committente_nome}).
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => void handleAccetta(c)}
                          disabled={salvataggio}
                        >
                          Accetta e crea cantiere
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-error-500 hover:text-error-500"
                          onClick={() => void handleRevoca(c)}
                          disabled={salvataggio}
                        >
                          Rifiuta
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Invita un'azienda */}
            <Card className="p-5">
              <h2 className="font-heading text-lg font-medium text-text-primary mb-4">
                Invita un&apos;azienda su un tuo cantiere
              </h2>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Select
                    label="Cantiere"
                    value={cantiereInvitoId}
                    onChange={(e) => setCantiereInvitoId(e.target.value)}
                    disabled={salvataggio}
                  >
                    <option value="">Seleziona un cantiere</option>
                    {cantieri.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex-1">
                  <Input
                    label="Email admin azienda da invitare"
                    type="email"
                    value={emailInvito}
                    onChange={(e) => setEmailInvito(e.target.value)}
                    disabled={salvataggio}
                  />
                </div>
                <Button
                  onClick={() => void handleInvita()}
                  loading={salvataggio}
                  disabled={!cantiereInvitoId || !emailInvito.trim()}
                  icon={<Handshake className="h-4 w-4" />}
                >
                  Invita
                </Button>
              </div>
            </Card>

            {/* Collaborazioni inviate */}
            <Card className="p-5">
              <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                Collaborazioni sui tuoi cantieri
              </h2>
              {inviate.length === 0 ? (
                <p className="text-sm text-text-muted">Nessuna collaborazione attiva.</p>
              ) : (
                <div className="space-y-2">
                  {inviate.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                          {c.cantiere_committente_nome}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {c.stato === "accettata"
                            ? `${c.azienda_collaboratrice_nome} · cantiere "${c.cantiere_collaboratore_nome}"`
                            : `Invito a ${c.email_invito}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={badgeStato(c.stato)} size="sm">
                          {c.stato === "invitata"
                            ? "In attesa"
                            : c.stato === "accettata"
                              ? "Attiva"
                              : "Revocata"}
                        </Badge>
                        {c.stato === "accettata" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void handleInviaLavorazioni(c)}
                            disabled={salvataggio}
                          >
                            Invia lavorazioni
                          </Button>
                        )}
                        {c.stato !== "revocata" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-error-500 hover:text-error-500"
                            onClick={() => void handleRevoca(c)}
                            disabled={salvataggio}
                          >
                            Revoca
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
