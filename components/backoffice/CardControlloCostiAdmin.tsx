"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { isAdmin } from "@/services/dipendenti/isAdmin";

export function CardControlloCostiAdmin() {
  const [visibile, setVisibile] = useState(false);

  useEffect(() => {
    let attivo = true;
    const verificaAdmin = async () => {
      try {
        const user = await loadUtenteAuth();
        if (!attivo || !user?.email) return;
        const admin = await isAdmin(user.email);
        if (!attivo) return;
        setVisibile(admin);
      } catch {
        if (attivo) setVisibile(false);
      }
    };
    void verificaAdmin();
    return () => { attivo = false; };
  }, []);

  if (!visibile) return null;

  return (
    <Link
      href={APP_ROUTES.BACKOFFICE_CONTROLLO_COSTI}
      className="group flex flex-col gap-3 p-4 bg-bg-card border border-border rounded-lg transition-all duration-150 hover:border-border-strong hover:bg-bg-base hover:-translate-y-px"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-50 text-brand-500">
        <TrendingUp className="h-5 w-5" />
      </div>
      <div>
        <p className="font-heading text-[15px] font-medium text-text-primary">Controllo Costi</p>
        <p className="mt-0.5 text-xs text-text-muted">P&amp;L per cantiere: ricavi, costi e margini</p>
      </div>
    </Link>
  );
}
