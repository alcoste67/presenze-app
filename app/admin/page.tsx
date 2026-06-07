"use client";

import { useEffect, useState } from "react";
import { BarChart2, CalendarDays, CreditCard, Zap } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabase";

type AziendaInfo = { nome: string } | null;

const MOCK = {
  piano: "Starter",
  scadenza: "31 agosto 2025",
  tokenUsati: 750,
  tokenTotali: 1000,
  statoPagamento: "Attivo",
} as const;

function SummaryCard({
  icon,
  label,
  value,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-500">
          {icon}
        </div>
        {badge}
      </div>
      <p className="mt-4 text-2xl font-semibold text-text-primary">{value}</p>
      <p className="mt-0.5 text-xs text-text-muted">{label}</p>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [azienda, setAzienda] = useState<AziendaInfo>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id;
      if (!userId) return;
      supabase
        .from("dipendenti")
        .select("aziende(nome)")
        .eq("auth_user_id", userId)
        .eq("attivo", true)
        .maybeSingle()
        .then(({ data: row }) => {
          if (row?.aziende) {
            setAzienda(row.aziende as unknown as { nome: string });
          }
        });
    });
  }, []);

  const tokenPercent = Math.round(
    (MOCK.tokenUsati / MOCK.tokenTotali) * 100
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome */}
      <Card className="p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Portale admin
        </p>
        <h1 className="mt-1 font-heading text-2xl font-medium text-text-primary">
          {azienda?.nome ? `Benvenuto, ${azienda.nome}` : "Benvenuto"}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Gestisci abbonamento, consumi AI e fatturazione dalla barra laterale.
        </p>
      </Card>

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          icon={<CreditCard className="h-5 w-5" />}
          label="Piano attivo"
          value={MOCK.piano}
          badge={<Badge variant="brand">{MOCK.piano}</Badge>}
        />
        <SummaryCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Scadenza abbonamento"
          value={MOCK.scadenza}
        />
        <SummaryCard
          icon={<Zap className="h-5 w-5" />}
          label="Token AI usati"
          value={`${MOCK.tokenUsati} / ${MOCK.tokenTotali}`}
          badge={
            <Badge variant={tokenPercent >= 90 ? "error" : tokenPercent >= 70 ? "warning" : "success"}>
              {tokenPercent}%
            </Badge>
          }
        />
        <SummaryCard
          icon={<BarChart2 className="h-5 w-5" />}
          label="Stato pagamento"
          value={MOCK.statoPagamento}
          badge={<Badge variant="success">{MOCK.statoPagamento}</Badge>}
        />
      </div>
    </div>
  );
}
