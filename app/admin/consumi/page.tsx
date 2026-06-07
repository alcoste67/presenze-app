"use client";

import { Zap } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const TOKEN_USATI = 750;
const TOKEN_TOTALI = 1000;
const RESET_DATE = "31 luglio 2025";

const OPERAZIONI_MOCK = [
  { id: 1, data: "07/06/2025", tipo: "Generazione rapporto SAL", token: 120 },
  { id: 2, data: "05/06/2025", tipo: "Analisi presenze mensili", token: 95 },
  { id: 3, data: "03/06/2025", tipo: "Generazione rapporto SAL", token: 110 },
  { id: 4, data: "01/06/2025", tipo: "Export commessa Excel", token: 80 },
  { id: 5, data: "29/05/2025", tipo: "Analisi presenze mensili", token: 105 },
] as const;

export default function ConsumiPage() {
  const percent = Math.round((TOKEN_USATI / TOKEN_TOTALI) * 100);
  const rimanenti = TOKEN_TOTALI - TOKEN_USATI;
  const barVariant = percent >= 90 ? "bg-error-500" : percent >= 70 ? "bg-warning-500" : "bg-brand-500";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-medium text-text-primary">
          Consumi AI
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Utilizzo del credito token AI per il mese corrente.
        </p>
      </div>

      {/* Token usage */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-500">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">Token AI</p>
            <p className="text-xs text-text-muted">Reset il {RESET_DATE}</p>
          </div>
          <Badge
            variant={percent >= 90 ? "error" : percent >= 70 ? "warning" : "success"}
            className="ml-auto"
          >
            {percent}% usati
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="h-3 w-full rounded-full bg-bg-subtle overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barVariant}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
          <span>{TOKEN_USATI.toLocaleString("it-IT")} usati</span>
          <span>{rimanenti.toLocaleString("it-IT")} rimanenti su {TOKEN_TOTALI.toLocaleString("it-IT")}</span>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <Button
            disabled
            title="Disponibile presto"
            variant="secondary"
          >
            Acquista token extra
          </Button>
          <p className="mt-2 text-xs text-text-muted">Disponibile presto</p>
        </div>
      </Card>

      {/* Operations table */}
      <Card className="p-6">
        <h3 className="font-heading text-base font-medium text-text-primary mb-4">
          Ultime operazioni AI
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Data
                </th>
                <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Operazione
                </th>
                <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Token
                </th>
              </tr>
            </thead>
            <tbody>
              {OPERAZIONI_MOCK.map((op) => (
                <tr key={op.id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4 text-text-muted">{op.data}</td>
                  <td className="py-3 pr-4 text-text-primary">{op.tipo}</td>
                  <td className="py-3 text-right font-medium text-text-primary">
                    {op.token}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
