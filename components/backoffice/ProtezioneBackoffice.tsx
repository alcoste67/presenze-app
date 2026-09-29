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
import { checkAccessoWallbox } from "@/services/checklistWallbox/checkAccessoWallbox";

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
    // Pagine operative aperte a qualsiasi dipendente attivo (non solo
    // admin/responsabile): stesso livello di accesso di rapporti-intervento.
    const pagineOperativeQualsiasiDipendente = [
      APP_ROUTES.BACKOFFICE_RAPPORTI_INTERVENTO,
      APP_ROUTES.BACKOFFICE_CALENDARIO,
    ];
    const accessoOperativoRapporti = pagineOperativeQualsiasiDipendente.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`)
    );
    // Checklist wallbox: oggi attiva solo per aziende abilitate (vedi
    // lib/wallboxAccess.ts), a prescindere dal ruolo — va controllata PRIMA
    // del bypass admin qui sotto, altrimenti qualsiasi admin di qualsiasi
    // azienda vi accederebbe comunque.
    const accessoWallbox =
      pathname === APP_ROUTES.BACKOFFICE_CHECKLIST_WALLBOX ||
      pathname.startsWith(`${APP_ROUTES.BACKOFFICE_CHECKLIST_WALLBOX}/`);
    const accessoCostiMacchinari =
      pathname ===
      APP_ROUTES.BACKOFFICE_COSTI_MACCHINARI;
    const accessoMacchinariAdmin =
      pathname ===
      APP_ROUTES.BACKOFFICE_MACCHINARI;
    const accessoControlloCosti =
      pathname ===
      APP_ROUTES.BACKOFFICE_CONTROLLO_COSTI;
    const accessoCollaborazioni =
      pathname ===
      APP_ROUTES.BACKOFFICE_COLLABORAZIONI;
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

        if (accessoWallbox) {
          const wallboxAbilitata = await checkAccessoWallbox(user.id);

          if (!attivo) {
            return;
          }

          if (!wallboxAbilitata) {
            router.replace(APP_ROUTES.HOME);

            return;
          }

          setAutorizzato(true);

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

        if (accessoMacchinariAdmin || accessoControlloCosti || accessoCollaborazioni) {
          router.replace(APP_ROUTES.HOME);

          return;
        }

        if (
          accessoHubBackoffice ||
          accessoCostiMacchinari
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
