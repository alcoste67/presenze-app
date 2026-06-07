"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { APP_ROUTES } from "@/constants/routes";
import { API_HEADERS } from "@/constants/api";
import { supabase } from "@/lib/supabase";
import { getMessaggioErrore } from "@/lib/errors";
import { useToast } from "@/components/ui/Toast";

type DatiAzienda = {
  nome: string;
  partita_iva: string | null;
  codice_fiscale: string | null;
  indirizzo: string | null;
  email: string | null;
  telefono: string | null;
  sito_web: string | null;
};

function CampoInfo({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm font-medium text-text-primary">
        {value || <span className="text-text-muted font-normal italic">Non compilato</span>}
      </p>
    </div>
  );
}

export default function DatiAziendaPage() {
  const toast = useToast();
  const [dati, setDati] = useState<DatiAzienda | null>(null);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    const carica = async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) return;

        const res = await fetch("/api/azienda/impostazioni", {
          headers: { [API_HEADERS.AUTHORIZATION]: `${API_HEADERS.BEARER_PREFIX}${token}` },
        });
        if (!res.ok) throw new Error("Errore caricamento dati azienda");

        const json = (await res.json()) as DatiAzienda;
        setDati(json);
      } catch (error: unknown) {
        toast.error(getMessaggioErrore(error, "Errore caricamento dati azienda"));
      } finally {
        setCaricamento(false);
      }
    };

    void carica();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-xl font-medium text-text-primary">
          Dati azienda
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Riepilogo delle informazioni aziendali registrate.
        </p>
      </div>

      <Card className="p-6">
        {caricamento ? (
          <p className="text-sm text-text-muted">Caricamento...</p>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <CampoInfo label="Nome azienda" value={dati?.nome} />
            <CampoInfo label="Partita IVA" value={dati?.partita_iva} />
            <CampoInfo label="Codice fiscale" value={dati?.codice_fiscale} />
            <CampoInfo label="Indirizzo" value={dati?.indirizzo} />
            <CampoInfo label="Email" value={dati?.email} />
            <CampoInfo label="Telefono" value={dati?.telefono} />
            <CampoInfo label="Sito web" value={dati?.sito_web} />
          </div>
        )}

        <div className="mt-6 border-t border-border pt-5">
          <Link href={APP_ROUTES.IMPOSTAZIONI}>
            <Button variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>
              Modifica in Impostazioni
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
