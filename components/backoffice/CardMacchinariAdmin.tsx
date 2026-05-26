"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import { APP_ROUTES } from "@/constants/routes";
import { MACCHINARI_TESTI } from "@/constants/macchinari";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { isAdmin } from "@/services/dipendenti/isAdmin";

export function CardMacchinariAdmin() {
  const [visibile, setVisibile] =
    useState(false);

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
      className="rounded-xl border border-industrial-border-soft bg-industrial-surface p-5 text-industrial-text shadow-[0_12px_28px_rgb(36_38_43/0.08)] transition-colors duration-200 ease-out hover:border-industrial-orange hover:text-industrial-orange"
    >
      <h2 className="text-xl font-semibold">
        {MACCHINARI_TESTI.ANAGRAFICA_TITOLO}
      </h2>
      <p className="mt-2 text-sm text-industrial-muted">
        {MACCHINARI_TESTI.ANAGRAFICA_CARD_DESCRIZIONE}
      </p>
    </Link>
  );
}
