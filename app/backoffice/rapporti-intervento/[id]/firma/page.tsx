"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Home } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import {
  LABEL_REGOLE_FATTURAZIONE_INTERVENTO,
  RAPPORTI_INTERVENTO_STATI,
  RAPPORTI_INTERVENTO_TESTI,
} from "@/constants/rapportiIntervento";
import { loadRapportoIntervento } from "@/services/rapportiIntervento/loadRapportoIntervento";
import { firmaRapportoIntervento } from "@/services/rapportiIntervento/firmaRapportoIntervento";
import { formatMinutiOre } from "@/services/rapportiIntervento/oreMinuti";
import type { RapportoInterventoCompleto } from "@/types/rapportiIntervento";

import { AppHeader } from "@/components/ui/AppHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FirmaCanvas } from "@/components/rapportiIntervento/FirmaCanvas";
import { useToast } from "@/components/ui/Toast";
import { getMessaggioErrore } from "@/lib/errors";

function formattaData(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("it-IT").format(
    new Date(`${value}T00:00:00`)
  );
}

export default function FirmaRapportoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const toast = useToast();

  const rapportoId = params?.id || "";

  const [rapporto, setRapporto] =
    useState<RapportoInterventoCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);

  const [firmaResponsabile, setFirmaResponsabile] =
    useState<string | null>(null);
  const [nomeResponsabile, setNomeResponsabile] = useState("");
  const [firmaCliente, setFirmaCliente] =
    useState<string | null>(null);
  const [nomeCliente, setNomeCliente] = useState("");
  const [mostraPropostaInvio, setMostraPropostaInvio] = useState(false);

  useEffect(() => {
    let attivo = true;

    const init = async () => {
      try {
        const dati = await loadRapportoIntervento(rapportoId);
        if (!attivo) return;

        if (!dati) {
          toast.error(
            RAPPORTI_INTERVENTO_TESTI.ERRORI.RAPPORTO_NON_TROVATO
          );
          router.replace(APP_ROUTES.BACKOFFICE_RAPPORTI_INTERVENTO);
          return;
        }

        if (dati.stato !== RAPPORTI_INTERVENTO_STATI.BOZZA) {
          toast.error(
            RAPPORTI_INTERVENTO_TESTI.RAPPORTO_NON_FIRMABILE
          );
          router.replace(APP_ROUTES.BACKOFFICE_RAPPORTI_INTERVENTO);
          return;
        }

        setRapporto(dati);
        setNomeResponsabile(
          dati.firma_responsabile_nome || dati.responsabile_nome
        );
        setNomeCliente(
          dati.firma_cliente_nome || dati.cliente_committente
        );
      } catch (error: unknown) {
        if (attivo)
          toast.error(
            getMessaggioErrore(
              error,
              RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO
            )
          );
      } finally {
        if (attivo) setLoading(false);
      }
    };

    void init();
    return () => {
      attivo = false;
    };
  }, [rapportoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConferma = async () => {
    if (!rapporto) return;

    if (!firmaResponsabile || !firmaCliente) {
      toast.error(
        RAPPORTI_INTERVENTO_TESTI.ERRORI.FIRME_OBBLIGATORIE
      );
      return;
    }

    try {
      setSalvataggio(true);

      await firmaRapportoIntervento({
        rapportoId: rapporto.id,
        firmaResponsabileDataUrl: firmaResponsabile,
        firmaResponsabileNome: nomeResponsabile,
        firmaClienteDataUrl: firmaCliente,
        firmaClienteNome: nomeCliente,
      });

      toast.success(RAPPORTI_INTERVENTO_TESTI.FIRMA_CONFERMATA);
      // Proponi subito l'invio al cliente
      setMostraPropostaInvio(true);
      setSalvataggio(false);
      return;
    } catch (error: unknown) {
      toast.error(
        getMessaggioErrore(
          error,
          RAPPORTI_INTERVENTO_TESTI.ERRORI.GENERICO
        )
      );
      setSalvataggio(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <Link href={APP_ROUTES.BACKOFFICE_RAPPORTI_INTERVENTO}>
            <Button variant="secondary" size="sm">
              {RAPPORTI_INTERVENTO_TESTI.TITOLO}
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-[720px] px-5 py-6">
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          className="mb-5 flex items-center gap-1.5 text-sm text-text-muted"
        >
          <Link
            href={APP_ROUTES.HOME}
            className="hover:text-text-primary transition-colors duration-150"
          >
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link
            href={APP_ROUTES.BACKOFFICE_RAPPORTI_INTERVENTO}
            className="hover:text-text-primary transition-colors duration-150"
          >
            {RAPPORTI_INTERVENTO_TESTI.TITOLO}
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">
            {RAPPORTI_INTERVENTO_TESTI.FIRMA_PAGINA_TITOLO}
          </span>
        </nav>

        <h1 className="font-heading text-2xl font-medium text-text-primary">
          {RAPPORTI_INTERVENTO_TESTI.FIRMA_PAGINA_TITOLO}
        </h1>

        {loading && (
          <p className="mt-6 text-sm text-text-muted">
            {RAPPORTI_INTERVENTO_TESTI.CARICAMENTO}
          </p>
        )}

        {!loading && rapporto && (
          <div className="mt-5 flex flex-col gap-5">
            {/* Riepilogo */}
            <Card className="p-5">
              <h2 className="font-heading text-lg font-medium text-text-primary mb-3">
                {RAPPORTI_INTERVENTO_TESTI.FIRMA_RIEPILOGO}
              </h2>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">Cantiere</dt>
                  <dd className="font-medium text-text-primary">
                    {rapporto.cantiere_nome_snapshot}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Data intervento</dt>
                  <dd className="font-medium text-text-primary">
                    {formattaData(rapporto.data_intervento)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Cliente</dt>
                  <dd className="font-medium text-text-primary">
                    {rapporto.cliente_committente}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Responsabile</dt>
                  <dd className="font-medium text-text-primary">
                    {rapporto.responsabile_nome}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Ore fatturabili</dt>
                  <dd className="font-medium text-text-primary">
                    {formatMinutiOre(rapporto.ore_fatturabili_minuti)}
                    {" · "}
                    {
                      LABEL_REGOLE_FATTURAZIONE_INTERVENTO[
                        rapporto.regola_fatturazione
                      ]
                    }
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Operatori</dt>
                  <dd className="font-medium text-text-primary">
                    {rapporto.operatori
                      .map((o) => o.nome_snapshot)
                      .join(", ") || "—"}
                  </dd>
                </div>
              </dl>

              {rapporto.lavorazioni.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-text-muted mb-1">Lavorazioni</p>
                  <ul className="text-sm text-text-primary list-disc list-inside">
                    {rapporto.lavorazioni.map((l) => (
                      <li key={l.id}>
                        {l.descrizione_snapshot} —{" "}
                        {formatMinutiOre(l.ore_uomo_minuti)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {rapporto.note && (
                <div className="mt-4">
                  <p className="text-xs text-text-muted mb-1">Note</p>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">
                    {rapporto.note}
                  </p>
                </div>
              )}
            </Card>

            {/* Avviso immutabilità */}
            <div className="flex items-start gap-3 rounded-md border border-warning-500/40 bg-warning-50 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning-500" />
              <p className="text-sm text-text-primary">
                {RAPPORTI_INTERVENTO_TESTI.FIRMA_AVVISO}
              </p>
            </div>

            {/* Firme */}
            <Card className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <FirmaCanvas
                    label={RAPPORTI_INTERVENTO_TESTI.FIRMA_RESPONSABILE}
                    clearLabel={RAPPORTI_INTERVENTO_TESTI.CANCELLA_FIRMA}
                    value={firmaResponsabile}
                    onChange={setFirmaResponsabile}
                    disabled={salvataggio}
                  />
                  <Input
                    label={
                      RAPPORTI_INTERVENTO_TESTI.NOME_FIRMA_RESPONSABILE
                    }
                    type="text"
                    value={nomeResponsabile}
                    onChange={(e) => setNomeResponsabile(e.target.value)}
                    disabled={salvataggio}
                  />
                </div>

                <div className="space-y-2">
                  <FirmaCanvas
                    label={RAPPORTI_INTERVENTO_TESTI.FIRMA_CLIENTE}
                    clearLabel={RAPPORTI_INTERVENTO_TESTI.CANCELLA_FIRMA}
                    value={firmaCliente}
                    onChange={setFirmaCliente}
                    disabled={salvataggio}
                  />
                  <Input
                    label={RAPPORTI_INTERVENTO_TESTI.NOME_FIRMA_CLIENTE}
                    type="text"
                    value={nomeCliente}
                    onChange={(e) => setNomeCliente(e.target.value)}
                    disabled={salvataggio}
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => void handleConferma()}
                  loading={salvataggio}
                  disabled={!firmaResponsabile || !firmaCliente}
                  className="flex-1"
                >
                  {salvataggio
                    ? RAPPORTI_INTERVENTO_TESTI.FIRMA_IN_CORSO
                    : RAPPORTI_INTERVENTO_TESTI.CONFERMA_FIRMA}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.back()}
                  disabled={salvataggio}
                >
                  {RAPPORTI_INTERVENTO_TESTI.ANNULLA}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>
      {mostraPropostaInvio && (
        <ConfirmDialog
          title={RAPPORTI_INTERVENTO_TESTI.FIRMA_CONFERMATA}
          message={RAPPORTI_INTERVENTO_TESTI.PROPOSTA_INVIO_POST_FIRMA}
          confirmLabel={RAPPORTI_INTERVENTO_TESTI.INVIA_ORA}
          onConfirm={() =>
            // replace: il back button non deve riportare alla pagina di firma
            router.replace(
              `${APP_ROUTES.BACKOFFICE_RAPPORTI_INTERVENTO}?invia=${rapportoId}`
            )
          }
          onCancel={() =>
            router.replace(APP_ROUTES.BACKOFFICE_RAPPORTI_INTERVENTO)
          }
        />
      )}
    </div>
  );
}
