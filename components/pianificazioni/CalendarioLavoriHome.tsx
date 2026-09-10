"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { PIANIFICAZIONI_TESTI } from "@/constants/pianificazioni";
import { getMessaggioErrore } from "@/lib/errors";
import { fetchPianificazioni } from "@/services/pianificazioni/fetchPianificazioni";
import type { PianificazioneLavoro } from "@/types/pianificazioni";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function getDataInput(offsetGiorni: number) {
  const data = new Date();
  data.setDate(data.getDate() + offsetGiorni);
  const year = data.getFullYear();
  const month = String(data.getMonth() + 1).padStart(2, "0");
  const day = String(data.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function raggruppaPerGiorno(pianificazioni: PianificazioneLavoro[]) {
  const gruppi = new Map<string, PianificazioneLavoro[]>();
  pianificazioni.forEach((p) => {
    const lista = gruppi.get(p.data) || [];
    lista.push(p);
    gruppi.set(p.data, lista);
  });
  return gruppi;
}

const OGGI = getDataInput(0);
const DOMANI = getDataInput(1);

function SezioneGiorno({
  titolo,
  pianificazioni,
}: {
  titolo: string;
  pianificazioni: PianificazioneLavoro[];
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
        {titolo}
      </p>
      {pianificazioni.length === 0 ? (
        <p className="mt-1 text-sm text-text-muted">
          {PIANIFICAZIONI_TESTI.NESSUN_RISULTATO}
        </p>
      ) : (
        <div className="mt-1.5 flex flex-col gap-2">
          {pianificazioni.map((p) => (
            <div key={p.id} className="rounded-md border border-border bg-bg-base p-2.5">
              <p className="text-sm font-medium text-text-primary">{p.cantiereNome}</p>
              {p.squadra.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {p.squadra.map((m) => (
                    <Badge key={m.dipendenteId} variant="brand" size="sm">{m.nome}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CalendarioLavoriHome() {
  const [pianificazioni, setPianificazioni] = useState<PianificazioneLavoro[]>([]);
  const [loading, setLoading] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let attivo = true;
    const carica = async () => {
      try {
        const risposta = await fetchPianificazioni(
          { dataInizio: OGGI, dataFine: DOMANI },
          { soloMie: true }
        );
        if (attivo) setPianificazioni(risposta.pianificazioni);
      } catch (error: unknown) {
        if (attivo) {
          setErrore(getMessaggioErrore(error, PIANIFICAZIONI_TESTI.ERRORI.GENERICO));
        }
      } finally {
        if (attivo) setLoading(false);
      }
    };
    void carica();
    return () => {
      attivo = false;
    };
  }, []);

  if (errore) return null;

  const gruppi = raggruppaPerGiorno(pianificazioni);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-brand-500" />
          <div>
            <h2 className="font-heading text-lg font-medium text-text-primary">
              {PIANIFICAZIONI_TESTI.TITOLO}
            </h2>
            <p className="text-xs text-text-muted">
              {PIANIFICAZIONI_TESTI.SOTTOTITOLO_SOLA_LETTURA}
            </p>
          </div>
        </div>
        <Link href={APP_ROUTES.BACKOFFICE_CALENDARIO}>
          <Button variant="secondary" size="sm">Apri</Button>
        </Link>
      </div>

      {loading ? (
        <p className="mt-3 text-sm text-text-muted">{PIANIFICAZIONI_TESTI.CARICAMENTO}</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SezioneGiorno titolo="Oggi" pianificazioni={gruppi.get(OGGI) || []} />
          <SezioneGiorno titolo="Domani" pianificazioni={gruppi.get(DOMANI) || []} />
        </div>
      )}
    </Card>
  );
}
