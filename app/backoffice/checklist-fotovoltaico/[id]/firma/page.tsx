"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Home } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import {
  CHECKLIST_FOTOVOLTAICO_STATI,
  CHECKLIST_FOTOVOLTAICO_TESTI,
} from "@/constants/checklistFotovoltaico";
import { loadChecklistFotovoltaico } from "@/services/checklistFotovoltaico/loadChecklistiFotovoltaico";
import { firmaChecklistFotovoltaico } from "@/services/checklistFotovoltaico/firmaChecklistFotovoltaico";
import type { ChecklistFotovoltaico } from "@/types/checklistFotovoltaico";

import { AppHeader } from "@/components/ui/AppHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FirmaCanvas } from "@/components/rapportiIntervento/FirmaCanvas";
import { useToast } from "@/components/ui/Toast";
import { getMessaggioErrore } from "@/lib/errors";

export default function FirmaChecklistFotovoltaicoPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const toast = useToast();

  const checklistId = params?.id || "";

  const [checklist, setChecklist] = useState<ChecklistFotovoltaico | null>(null);
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
        const dati = await loadChecklistFotovoltaico(checklistId);
        if (!attivo) return;

        if (!dati) {
          toast.error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.CHECKLIST_NON_TROVATA);
          router.replace(APP_ROUTES.BACKOFFICE_CHECKLIST_FOTOVOLTAICO);
          return;
        }

        if (dati.stato !== CHECKLIST_FOTOVOLTAICO_STATI.BOZZA) {
          toast.error(CHECKLIST_FOTOVOLTAICO_TESTI.CHECKLIST_NON_FIRMABILE);
          router.replace(APP_ROUTES.BACKOFFICE_CHECKLIST_FOTOVOLTAICO);
          return;
        }

        setChecklist(dati);
        setNomeCliente(`${dati.nome} ${dati.cognome}`.trim());
      } catch (error: unknown) {
        if (attivo) toast.error(getMessaggioErrore(error, CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.GENERICO));
      } finally {
        if (attivo) setLoading(false);
      }
    };

    void init();
    return () => {
      attivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklistId]);

  const handleConferma = async () => {
    if (!checklist) return;

    if (!firmaTecnico || !firmaCliente) {
      toast.error(CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.FIRME_OBBLIGATORIE);
      return;
    }

    try {
      setSalvataggio(true);

      await firmaChecklistFotovoltaico({
        checklistId: checklist.id,
        firmaTecnicoDataUrl: firmaTecnico,
        firmaTecnicoNome: nomeTecnico,
        firmaClienteDataUrl: firmaCliente,
        firmaClienteNome: nomeCliente,
      });

      toast.success(CHECKLIST_FOTOVOLTAICO_TESTI.FIRMA_CONFERMATA);
      setMostraPropostaInvio(true);
      setSalvataggio(false);
    } catch (error: unknown) {
      toast.error(getMessaggioErrore(error, CHECKLIST_FOTOVOLTAICO_TESTI.ERRORI.GENERICO));
      setSalvataggio(false);
    }
  };

  return (
    <div className="min-h-dvh bg-bg-base">
      <AppHeader
        actions={
          <Link href={APP_ROUTES.BACKOFFICE_CHECKLIST_FOTOVOLTAICO}>
            <Button variant="secondary" size="sm">
              {CHECKLIST_FOTOVOLTAICO_TESTI.TITOLO}
            </Button>
          </Link>
        }
      />

      <main className="mx-auto max-w-[720px] px-5 py-6">
        <nav aria-label="breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-text-muted">
          <Link href={APP_ROUTES.HOME} className="hover:text-text-primary transition-colors duration-150">
            <Home className="h-4 w-4" />
          </Link>
          <span>/</span>
          <Link
            href={APP_ROUTES.BACKOFFICE_CHECKLIST_FOTOVOLTAICO}
            className="hover:text-text-primary transition-colors duration-150"
          >
            {CHECKLIST_FOTOVOLTAICO_TESTI.TITOLO}
          </Link>
          <span>/</span>
          <span className="font-medium text-text-primary">
            {CHECKLIST_FOTOVOLTAICO_TESTI.FIRMA_PAGINA_TITOLO}
          </span>
        </nav>

        <h1 className="font-heading text-2xl font-medium text-text-primary">
          {CHECKLIST_FOTOVOLTAICO_TESTI.FIRMA_PAGINA_TITOLO}
        </h1>

        {loading && <p className="mt-6 text-sm text-text-muted">{CHECKLIST_FOTOVOLTAICO_TESTI.CARICAMENTO}</p>}

        {!loading && checklist && (
          <div className="mt-5 flex flex-col gap-5">
            <Card className="p-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-text-muted">Cliente</dt>
                  <dd className="font-medium text-text-primary">
                    {`${checklist.nome} ${checklist.cognome}`.trim() || "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">{CHECKLIST_FOTOVOLTAICO_TESTI.COMUNE}</dt>
                  <dd className="font-medium text-text-primary">{checklist.comune || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">{CHECKLIST_FOTOVOLTAICO_TESTI.EMAIL_CLIENTE}</dt>
                  <dd className="font-medium text-text-primary">{checklist.email_cliente || "-"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">{CHECKLIST_FOTOVOLTAICO_TESTI.POTENZA_CONSIGLIATA}</dt>
                  <dd className="font-medium text-text-primary">
                    {checklist.potenza_consigliata_kwp === null
                      ? "-"
                      : `${checklist.potenza_consigliata_kwp} kWp`}
                  </dd>
                </div>
              </dl>

              {checklist.note && (
                <div className="mt-4">
                  <p className="text-xs text-text-muted mb-1">{CHECKLIST_FOTOVOLTAICO_TESTI.NOTE}</p>
                  <p className="text-sm text-text-primary whitespace-pre-wrap">{checklist.note}</p>
                </div>
              )}
            </Card>

            <div className="flex items-start gap-3 rounded-md border border-warning-500/40 bg-warning-50 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning-500" />
              <p className="text-sm text-text-primary">{CHECKLIST_FOTOVOLTAICO_TESTI.FIRMA_AVVISO}</p>
            </div>

            <Card className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <FirmaCanvas
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.FIRMA_TECNICO}
                    clearLabel={CHECKLIST_FOTOVOLTAICO_TESTI.CANCELLA_FIRMA}
                    value={firmaTecnico}
                    onChange={setFirmaTecnico}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.NOME_FIRMA_TECNICO}
                    type="text"
                    value={nomeTecnico}
                    onChange={(e) => setNomeTecnico(e.target.value)}
                    disabled={salvataggio}
                  />
                </div>

                <div className="space-y-2">
                  <FirmaCanvas
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.FIRMA_CLIENTE}
                    clearLabel={CHECKLIST_FOTOVOLTAICO_TESTI.CANCELLA_FIRMA}
                    value={firmaCliente}
                    onChange={setFirmaCliente}
                    disabled={salvataggio}
                  />
                  <Input
                    label={CHECKLIST_FOTOVOLTAICO_TESTI.NOME_FIRMA_CLIENTE}
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
                  {salvataggio ? CHECKLIST_FOTOVOLTAICO_TESTI.FIRMA_IN_CORSO : CHECKLIST_FOTOVOLTAICO_TESTI.CONFERMA_FIRMA}
                </Button>
                <Button variant="secondary" onClick={() => router.back()} disabled={salvataggio}>
                  {CHECKLIST_FOTOVOLTAICO_TESTI.ANNULLA}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </main>

      {mostraPropostaInvio && (
        <ConfirmDialog
          title={CHECKLIST_FOTOVOLTAICO_TESTI.FIRMA_CONFERMATA}
          message={CHECKLIST_FOTOVOLTAICO_TESTI.PROPOSTA_INVIO_POST_FIRMA}
          confirmLabel={CHECKLIST_FOTOVOLTAICO_TESTI.INVIA_ORA}
          onConfirm={() =>
            router.replace(`${APP_ROUTES.BACKOFFICE_CHECKLIST_FOTOVOLTAICO}?invia=${checklistId}`)
          }
          onCancel={() => router.replace(APP_ROUTES.BACKOFFICE_CHECKLIST_FOTOVOLTAICO)}
        />
      )}
    </div>
  );
}
