"use client";

import { Download } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const FATTURE_MOCK = [
  { id: "INV-2025-006", data: "01/06/2025", importo: "€29,00", stato: "Pagato" },
  { id: "INV-2025-005", data: "01/05/2025", importo: "€29,00", stato: "Pagato" },
  { id: "INV-2025-004", data: "01/04/2025", importo: "€29,00", stato: "Pagato" },
  { id: "INV-2025-003", data: "01/03/2025", importo: "€29,00", stato: "Pagato" },
  { id: "INV-2025-002", data: "01/02/2025", importo: "€29,00", stato: "Pagato" },
] as const;

export default function FatturazionePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-medium text-text-primary">
          Fatturazione
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Storico fatture e metodo di pagamento.
        </p>
      </div>

      {/* Payment method */}
      <Card className="p-6">
        <h3 className="font-heading text-base font-medium text-text-primary mb-1">
          Metodo di pagamento
        </h3>
        <p className="text-sm text-text-muted mb-4">
          Carta di credito associata all&apos;account.
        </p>
        <div className="flex items-center gap-3 rounded-md border border-border bg-bg-subtle px-4 py-3">
          <div className="flex h-8 w-12 items-center justify-center rounded border border-border bg-bg-card text-xs font-bold text-text-primary">
            VISA
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">
              Carta terminante in 4242
            </p>
            <p className="text-xs text-text-muted">Scadenza 12/27</p>
          </div>
          <Badge variant="success" className="ml-auto">Attiva</Badge>
        </div>
      </Card>

      {/* Invoices table */}
      <Card className="p-6">
        <h3 className="font-heading text-base font-medium text-text-primary mb-4">
          Storico fatture
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  N. fattura
                </th>
                <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Data
                </th>
                <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Importo
                </th>
                <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Stato
                </th>
                <th className="pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted" />
              </tr>
            </thead>
            <tbody>
              {FATTURE_MOCK.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-4 font-mono text-xs text-text-muted">{f.id}</td>
                  <td className="py-3 pr-4 text-text-secondary">{f.data}</td>
                  <td className="py-3 pr-4 font-medium text-text-primary">{f.importo}</td>
                  <td className="py-3 pr-4">
                    <Badge variant="success">{f.stato}</Badge>
                  </td>
                  <td className="py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled
                      title="Disponibile presto"
                      icon={<Download className="h-3.5 w-3.5" />}
                    >
                      PDF
                    </Button>
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
