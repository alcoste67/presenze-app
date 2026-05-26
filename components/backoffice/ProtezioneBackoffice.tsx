"use client";

import {
  usePathname,
  useRouter,
} from "next/navigation";
import type { ReactNode } from "react";
import {
  useEffect,
  useState,
} from "react";

import { APP_ROUTES } from "@/constants/routes";
import { loadUtenteAuth } from "@/services/auth/loadUtenteAuth";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import { isDipendenteAttivo } from "@/services/dipendenti/isDipendenteAttivo";

type Props = {
  children: ReactNode;
};

export function ProtezioneBackoffice({
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const [autorizzato, setAutorizzato] =
    useState(false);

  useEffect(() => {
    let attivo = true;
    const accessoOperativoRapporti =
      pathname ===
      APP_ROUTES.BACKOFFICE_RAPPORTI_INTERVENTO;
    const accessoCostiMacchinari =
      pathname ===
      APP_ROUTES.BACKOFFICE_COSTI_MACCHINARI;
    const accessoFreezeSal =
      pathname ===
      APP_ROUTES.BACKOFFICE_SAL_FREEZE;
    const accessoCommessa =
      pathname ===
      APP_ROUTES.BACKOFFICE_COMMESSA;
    const accessoMacchinariAdmin =
      pathname ===
      APP_ROUTES.BACKOFFICE_MACCHINARI;
    const accessoHubBackoffice =
      pathname === APP_ROUTES.BACKOFFICE;

    const verificaAccesso = async () => {
      setAutorizzato(false);

      try {
        const user = await loadUtenteAuth();

        if (!attivo) {
          return;
        }

        if (!user?.email) {
          router.replace(APP_ROUTES.HOME);

          return;
        }

        const utenteAdmin = await isAdmin(
          user.email
        );

        if (!attivo) {
          return;
        }

        if (utenteAdmin) {
          setAutorizzato(true);

          return;
        }

        if (accessoMacchinariAdmin) {
          router.replace(APP_ROUTES.HOME);

          return;
        }

        if (
          accessoHubBackoffice ||
          accessoCostiMacchinari ||
          accessoFreezeSal ||
          accessoCommessa
        ) {
          const utenteResponsabile =
            await isResponsabile(user.email);

          if (!attivo) {
            return;
          }

          if (!utenteResponsabile) {
            router.replace(APP_ROUTES.HOME);

            return;
          }

          setAutorizzato(true);

          return;
        }

        if (!accessoOperativoRapporti) {
          router.replace(APP_ROUTES.HOME);

          return;
        }

        const dipendenteAttivo =
          await isDipendenteAttivo(user.email);

        if (!attivo) {
          return;
        }

        if (!dipendenteAttivo) {
          router.replace(APP_ROUTES.HOME);

          return;
        }

        setAutorizzato(true);
      } catch (error: unknown) {
        console.error(
          "Errore verifica accesso back-office",
          error
        );

        if (attivo) {
          router.replace(APP_ROUTES.HOME);
        }
      }
    };

    void verificaAccesso();

    return () => {
      attivo = false;
    };
  }, [pathname, router]);

  if (!autorizzato) {
    return (
      <div className="backoffice-ui">
        <main className="min-h-screen bg-gradient-to-br from-industrial-bg to-industrial-bg-soft p-6 text-industrial-text">
          <div className="text-industrial-muted">
            Caricamento...
          </div>
        </main>
      </div>
    );
  }

  return <div className="backoffice-ui">{children}</div>;
}
