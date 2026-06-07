"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { APP_ROUTES } from "@/constants/routes";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { isAdmin } from "@/services/dipendenti/isAdmin";

type Props = { children: ReactNode };

export function ProtezioneAdmin({ children }: Props) {
  const router = useRouter();
  const [autorizzato, setAutorizzato] = useState(false);

  useEffect(() => {
    let attivo = true;

    const verificaAccesso = async () => {
      setAutorizzato(false);
      try {
        const user = await loadUtenteAuth();
        if (!attivo) return;

        if (!user?.email) {
          router.replace(APP_ROUTES.HOME);
          return;
        }

        const ok = await isAdmin(user.email);
        if (!attivo) return;

        if (!ok) {
          router.replace(APP_ROUTES.HOME);
          return;
        }

        setAutorizzato(true);
      } catch {
        if (attivo) router.replace(APP_ROUTES.HOME);
      }
    };

    void verificaAccesso();
    return () => { attivo = false; };
  }, [router]);

  if (!autorizzato) {
    return (
      <div className="min-h-dvh bg-bg-base flex items-center justify-center">
        <p className="text-sm text-text-muted">Caricamento...</p>
      </div>
    );
  }

  return <>{children}</>;
}
