"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { APP_ROUTES } from "@/constants/routes";
import { supabase } from "@/lib/supabase";
import {
  checkRestrizioneWallboxA2C,
  type RestrizioneWallboxA2C,
} from "@/services/checklistWallbox/checkSoloWallboxA2C";

const ROUTE_WALLBOX = APP_ROUTES.BACKOFFICE_CHECKLIST_WALLBOX;

// Un operaio (non admin) in azienda ristretta può raggiungere solo la
// checklist Wallbox: viene sempre riportato lì.
const ROUTE_CONSENTITE_OPERAIO = [ROUTE_WALLBOX];

// L'admin di un'azienda ristretta gestisce anche gli utenti ("dipendenti")
// e ha Home come pagina di partenza (bottone verso dipendenti).
const ROUTE_CONSENTITE_ADMIN = [
  APP_ROUTES.HOME,
  ROUTE_WALLBOX,
  APP_ROUTES.BACKOFFICE_DIPENDENTI,
];

// Route raggiungibili da chiunque, anche in azienda ristretta: login/logout
// e le pagine pubbliche/di sistema che non passano mai da qui come
// dipendente (es. firma remota, vista dal cliente finale).
const ROUTE_ESENTI = [
  "/login",
  "/landing",
  "/registrati",
  "/privacy",
  "/termini",
  "/firma-remota",
  "/checklist-wallbox/firma-remota",
  "/conferma-correzione",
];

function matchaRoute(pathname: string, route: string): boolean {
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}

function isRouteConsentita(pathname: string, isAdmin: boolean): boolean {
  const consentite = isAdmin ? ROUTE_CONSENTITE_ADMIN : ROUTE_CONSENTITE_OPERAIO;
  if (consentite.some((route) => matchaRoute(pathname, route))) return true;
  return ROUTE_ESENTI.some((route) => matchaRoute(pathname, route));
}

function routeDiAtterraggio(isAdmin: boolean): string {
  return isAdmin ? APP_ROUTES.HOME : ROUTE_WALLBOX;
}

/**
 * Per le aziende con aziende.solo_checklist_wallbox_a2c=true: un operaio
 * viene sempre riportato alla compilazione checklist Wallbox, un admin
 * solo a Home e "dipendenti" (oltre alla checklist). Controllo di sola
 * VISIBILITÀ lato client (stesso principio del resto dei gate in questo
 * repo, es. ProtezioneBackoffice): i dati restano comunque isolati per
 * azienda_id via RLS. Il flag viene letto una sola volta per sessione
 * (non ad ogni cambio pagina) per non appesantire la navigazione di
 * tutte le altre aziende, per cui è sempre non ristretto.
 */
export function RestrizioneSoloWallboxA2C() {
  const pathname = usePathname();
  const router = useRouter();
  const restrizioneRef = useRef<RestrizioneWallboxA2C | null>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let attivo = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id || null;

      if (userId === userIdRef.current) {
        return;
      }
      userIdRef.current = userId;
      restrizioneRef.current = null;

      if (!userId) {
        return;
      }

      checkRestrizioneWallboxA2C(userId)
        .then((restrizione) => {
          if (!attivo || userIdRef.current !== userId) return;
          restrizioneRef.current = restrizione;
          if (
            restrizione.ristretto &&
            !isRouteConsentita(window.location.pathname, restrizione.isAdmin)
          ) {
            router.replace(routeDiAtterraggio(restrizione.isAdmin));
          }
        })
        .catch(() => {
          restrizioneRef.current = { ristretto: false, isAdmin: false };
        });
    });

    return () => {
      attivo = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const restrizione = restrizioneRef.current;
    if (restrizione?.ristretto && !isRouteConsentita(pathname, restrizione.isAdmin)) {
      router.replace(routeDiAtterraggio(restrizione.isAdmin));
    }
  }, [pathname, router]);

  return null;
}
