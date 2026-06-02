"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Truck } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { MACCHINARI_TESTI } from "@/constants/macchinari";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { isAdmin } from "@/services/dipendenti/isAdmin";

export function CardMacchinariAdmin() {
  const [visibile, setVisibile] = useState(false);

  useEffect(() => {
    let attivo = true;

    const verificaAdmin = async () => {
      try {
        const user = await loadUtenteAuth();

        if (!attivo || !user?.email) {
          return;
        }

        const admin = await isAdmin(user.email);

        if (!attivo) {
          return;
        }

        setVisibile(admin);
      } catch {
        if (attivo) {
          setVisibile(false);
        }
      }
    };

    void verificaAdmin();

    return () => {
      attivo = false;
    };
  }, []);

  if (!visibile) {
    return null;
  }

  return (
    <Link
      href={APP_ROUTES.BACKOFFICE_MACCHINARI}
      className="group flex flex-col gap-3 p-4 bg-bg-card border border-border rounded-lg transition-all duration-150 hover:border-border-strong hover:bg-bg-base hover:-translate-y-px"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-500">
        <Truck className="h-5 w-5" />
      </div>
      <div>
        <p className="font-heading text-[15px] font-medium text-text-primary">
          {MACCHINARI_TESTI.ANAGRAFICA_TITOLO}
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {MACCHINARI_TESTI.ANAGRAFICA_CARD_DESCRIZIONE}
        </p>
      </div>
    </Link>
  );
}
