"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Home } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { ORDINI_LAVORO_STATI, ORDINI_LAVORO_TESTI } from "@/constants/ordiniLavoro";
import { loadOrdineLavoro } from "@/services/ordiniLavoro/loadOrdiniLavoro";
import { firmaOrdineLavoroEdison } from "@/services/ordiniLavoro/firmaOrdineLavoroEdison";
import type { OrdineLavoroEdison } from "@/types/ordiniLavoro";

import { AppHeader } from "@/components/ui/AppHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FirmaCanvas } from "@/components/rapportiIntervento/FirmaCanvas";
import { useToast } from "@/components/ui/Toast";
import { getMessaggioErrore } from "@/lib/errors";

export default function FirmaOrdineLavoroPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const toast = useToast();

  const ordineId = params?.id || "";

  const [ordine, setOrdine] = useState<OrdineLavoroEdison | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);

  const [firmaTecnico, setFirmaTecnico] = useState<string | null>(null);
  const [nomeTecnico, setNomeTecnico] = useState("");
  const [firmaCliente, setFirmaCliente] = useState<string | null>(null);
  const [nomeCliente, setNomeCliente] = useState("");
  const [mostraPropostaInvio, setMostraPropostaInvio] = useState(false);

  useEffect(() => {
    let attivo = true;

    const init = async () => {
      try {
        const dati = await loadOrdineLavoro(ordineId);
        if (!attivo) return;

        if (!dati) {
          toast.error(ORDINI_LAVORO_TESTI.ERRORI.ORDINE_NON_TROVATO);
          router.replace(APP_ROUTES.BACKOFFICE_ORDINI_LAVORO);
          return;
        }

        if (dati.stato !== ORDINI_LAVORO_STATI.BOZZA) {
          toast.error(ORDINI_LAVORO_TESTI.ERRORI.ORDINE_FIRMATO);
          router.replace(APP_ROUTES.BACKOFFICE_ORDINI_LAVORO);
          return;
        }

        setOrdine(dati);
        setNomeTecnico(dati.tecnico_nome);
        setNomeCliente(dati.cliente_nome_cognome);
      } catch (error: unknown) {
        if (attivo)
          toast.error(getMessaggioErrore(error, ORDINI_LAVORO_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoading(false);
      }
    };

    void init();
    return () => {
      attivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordineId]);

  const handleConferma = async () => {
    if (!ordine) return;

    if (!firmaTecnico || !firmaCliente) {
      toast.error(ORDINI_LAVORO_TESTI.ERRORI.FIRME_OBBLIGATORIE);
      return;
    }

    try {
      setSalvataggio(true);

      await firmaOrdineLavoroEdison({
        ordineId: ordine.id,
        firmaTecnicoDataUrl: firmaTecnico,
        firmaTecnicoNome: nomeTecnico,
        firmaClienteDataUrl: firmaCliente,
        firmaClienteNome: nomeCliente,
      });

      toast.success(ORDINI_LAVORO_TESTI.FIRMA_CONFERMATA);
      setMostraPropostaInvio(true);
      setSalvataggio(false);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, ORDINI_LAVORO_TESTI.ERRORI.GENERICO));
      setSalvataggio(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <Link href={APP_ROUTES.BACKOFFICE_ORDINI_LAVORO}>
            <Button variant="secondary" size="sm">
              {ORDINI_LAVORO_TESTI.TITOLO}
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-[720px] px-5 py-6">
        <nav
          aria-label="breadcrumb"
          className="mb-5 flex items-center gap-1.5 text-sm text-text-muted"
        >
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link
            href={APP_ROUTES.BACKOFFICE_ORDINI_LAVORO}
            className="hover:text-text-primary transition-colors duration-150"
          >
            {ORDINI_LAVORO_TESTI.TITOLO}
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">
            {ORDINI_LAVORO_TESTI.FIRMA_PAGINA_TITOLO}
          </span>
        </nav>

        <h1 className="font-heading text-2xl font-medium text-text-primary">
          {ORDINI_LAVORO_TESTI.FIRMA_PAGINA_TITOLO}
        </h1>

        {loading && (
          <p className="mt-6 text-sm text-text-muted">{ORDINI_LAVORO_TESTI.CARICAMENTO}</p>
        )}

        {!loading && ordine && (
          <div className="mt-5 flex flex-col gap-5">
            <Card className="p-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">
                    {ORDINI_LAVORO_TESTI.CLIENTE_NOME_COGNOME}
                  </dt>
                  <dd className="font-medium text-text-primary">
                    {ordine.cliente_nome_cognome || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">{ORDINI_LAVORO_TESTI.CLIENTE_COMUNE}</dt>
                  <dd className="font-medium text-text-primary">{ordine.cliente_comune || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">{ORDINI_LAVORO_TESTI.CLIENTE_EMAIL}</dt>
                  <dd className="font-medium text-text-primary">{ordine.cliente_email || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">{ORDINI_LAVORO_TESTI.INTERVENTO_NUMERO}</dt>
                  <dd className="font-medium text-text-primary">{ordine.intervento_numero || "-"}</dd>
                </div>
              </dl>

              {ordine.osservazioni && (
                <div className="mt-4">
                  <p className="text-xs text-text-muted mb-1">{ORDINI_LAVORO_TESTI.OSSERVAZIONI}</p>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">
                    {ordine.osservazioni}
                  </p>
                </div>
              )}
            </Card>

            <div className="flex items-start gap-3 rounded-md border border-warning-500/40 bg-warning-50 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning-500" />
              <p className="text-sm text-text-primary">{ORDINI_LAVORO_TESTI.FIRMA_AVVISO}</p>
            </div>

            <Card className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <FirmaCanvas
                    label={ORDINI_LAVORO_TESTI.FIRMA_TECNICO}
                    clearLabel={ORDINI_LAVORO_TESTI.CANCELLA_FIRMA}
                    value={firmaTecnico}
                    onChange={setFirmaTecnico}
                    disabled={salvataggio}
                  />
                  <Input
                    label={ORDINI_LAVORO_TESTI.NOME_FIRMA_TECNICO}
                    type="text"
                    value={nomeTecnico}
                    onChange={(e) => setNomeTecnico(e.target.value)}
                    disabled={salvataggio}
                  />
                </div>

                <div className="space-y-2">
                  <FirmaCanvas
                    label={ORDINI_LAVORO_TESTI.FIRMA_CLIENTE}
                    clearLabel={ORDINI_LAVORO_TESTI.CANCELLA_FIRMA}
                    value={firmaCliente}
                    onChange={setFirmaCliente}
                    disabled={salvataggio}
                  />
                  <Input
                    label={ORDINI_LAVORO_TESTI.NOME_FIRMA_CLIENTE}
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
                  disabled={!firmaTecnico || !firmaCliente}
                  className="flex-1"
                >
                  {salvataggio ? ORDINI_LAVORO_TESTI.FIRMA_IN_CORSO : ORDINI_LAVORO_TESTI.CONFERMA_FIRMA}
                </Button>
                <Button variant="secondary" onClick={() => router.back()} disabled={salvataggio}>
                  {ORDINI_LAVORO_TESTI.ANNULLA}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>

      {mostraPropostaInvio && (
        <ConfirmDialog
          title={ORDINI_LAVORO_TESTI.FIRMA_CONFERMATA}
          message={ORDINI_LAVORO_TESTI.PROPOSTA_INVIO_POST_FIRMA}
          confirmLabel={ORDINI_LAVORO_TESTI.INVIA_ORA}
          onConfirm={() => router.replace(`${APP_ROUTES.BACKOFFICE_ORDINI_LAVORO}?invia=${ordineId}`)}
          onCancel={() => router.replace(APP_ROUTES.BACKOFFICE_ORDINI_LAVORO)}
        />
      )}
    </div>
  );
}
