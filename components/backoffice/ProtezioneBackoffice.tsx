"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  useEffect,
  useState,
} from "react";

import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { isAdmin } from "@/services/dipendenti/isAdmin";

type Props = {
  children: ReactNode;
};

export function ProtezioneBackoffice({
  children,
}: Props) {
  const router = useRouter();

  const [autorizzato, setAutorizzato] =
    useState(false);

  useEffect(() => {
    let attivo = true;

    const verificaAccesso = async () => {
      try {
        const user = await loadUtenteAuth();

        if (!attivo) {
          return;
        }

        if (!user?.email) {
          router.replace("/");

          return;
        }

        const utenteAdmin = await isAdmin(
          user.email
        );

        if (!attivo) {
          return;
        }

        if (!utenteAdmin) {
          router.replace("/");

          return;
        }

        setAutorizzato(true);
      } catch (error: unknown) {
        console.error(
          "Errore verifica accesso back-office",
          error
        );

        if (attivo) {
          router.replace("/");
        }
      }
    };

    void verificaAccesso();

    return () => {
      attivo = false;
    };
  }, [router]);

  if (!autorizzato) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
        <div className="text-industrial-muted">
          Caricamento...
        </div>
      </main>
    );
  }

  return children;
}
