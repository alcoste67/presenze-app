"use client";

import { Check } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const PIANO = {
  nome: "Starter",
  prezzo: "€29 / mese",
  rinnovo: "31 agosto 2025",
  features: [
    "Fino a 10 dipendenti",
    "Timbrature illimitate",
    "Report presenze",
    "SAL e freeze mensili",
    "1.000 token AI / mese",
    "Supporto email",
  ],
} as const;

export default function AbbonamentoPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-medium text-text-primary">
          Abbonamento
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Il tuo piano corrente e le funzionalità incluse.
        </p>
      </div>

      {/* Current plan */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-lg font-medium text-text-primary">
                Piano {PIANO.nome}
              </h3>
              <Badge variant="brand">{PIANO.nome}</Badge>
            </div>
            <p className="mt-1 text-2xl font-semibold text-text-primary">
              {PIANO.prezzo}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Rinnovo il {PIANO.rinnovo}
            </p>
          </div>
          <Badge variant="success">Attivo</Badge>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <p className="mb-3 text-sm font-medium text-text-primary">
            Funzionalità incluse
          </p>
          <ul className="flex flex-col gap-2">
            {PIANO.features.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-text-secondary">
                <Check className="h-4 w-4 shrink-0 text-success-500" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Change plan */}
      <Card className="p-6">
        <h3 className="font-heading text-base font-medium text-text-primary">
          Cambia piano
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          Aggiorna o effettua il downgrade del tuo abbonamento.
        </p>
        <div className="mt-4">
          <Button
            disabled
            title="Disponibile presto"
            className="cursor-not-allowed"
          >
            Cambia piano
          </Button>
          <p className="mt-2 text-xs text-text-muted">
            Disponibile presto
          </p>
        </div>
      </Card>
    </div>
  );
}
