"use client";

import { useSyncExternalStore, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "cantivo_cookie_consent";

const subscribe = () => () => {};
const getSnapshot = () => localStorage.getItem(CONSENT_KEY) === "true";
const getServerSnapshot = () => true;

export function CookieBanner() {
  const [nascosto, setNascosto] = useState(false);
  const consentito = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const accetta = () => {
    localStorage.setItem(CONSENT_KEY, "true");
    setNascosto(true);
  };

  if (consentito || nascosto) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#1e2d4a] px-4 py-3 shadow-lg">
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/80">
          Cantivo usa cookie tecnici necessari al funzionamento del servizio. Nessun cookie di profilazione o tracking.
        </p>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/privacy"
            className="rounded-md px-3 py-1.5 text-sm text-white/60 transition-colors hover:text-white"
          >
            Scopri di più
          </Link>
          <button
            type="button"
            onClick={accetta}
            className="rounded-md bg-[#e95624] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#d44d1f]"
          >
            Accetta
          </button>
        </div>
      </div>
    </div>
  );
}
