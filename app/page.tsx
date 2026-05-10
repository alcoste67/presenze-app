"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

import { TIMBRATURE } from "@/constants/stati";
import { TipoAttivita } from "@/types/attivita";
import { TipoTimbratura } from "@/types/timbrature";

import { loadCantieri } from "@/services/cantieri/loadCantieri";
import { isAdmin } from "@/services/dipendenti/isAdmin";

import { useTimbrature } from "@/hooks/useTimbrature";

import { StatoBadge } from "@/components/timbrature/StatoBadge";
import { PulsantiTimbratura } from "@/components/timbrature/PulsantiTimbratura";
import { SelectAttivita } from "@/components/attivita/SelectAttivita";
import { SelectCantiere } from "@/components/cantieri/SelectCantiere";

type Cantiere = {
  id: string;
  nome: string;
};

export default function HomePage() {
  // =========================
  // STATE
  // =========================

  const [user, setUser] = useState<User | null>(null);

  const [cantieri, setCantieri] = useState<
    Cantiere[]
  >([]);

  const [cantiereId, setCantiereId] =
    useState("");

  const [
    attivitaTipo,
    setAttivitaTipo,
  ] = useState<TipoAttivita | "">("");

  const [inizializzato, setInizializzato] =
    useState(false);

  const [
    mostraBackoffice,
    setMostraBackoffice,
  ] = useState(false);

  // =========================
  // TIMBRATURE
  // =========================

  const {
    ultimaTimbratura,
    statoAttuale,
    loadingTimbratura,
    refreshUltimaTimbratura,
    handleTimbratura,
  } = useTimbrature({
    userId: user?.id || null,
  });

  // =========================
  // INIT
  // =========================

  useEffect(() => {
    const refreshMostraBackoffice = async (
      currentUser: User | null
    ) => {
      if (!currentUser?.email) {
        setMostraBackoffice(false);

        return;
      }

      try {
        const utenteAdmin = await isAdmin(
          currentUser.email
        );

        setMostraBackoffice(utenteAdmin);
      } catch (error) {
        console.error(error);
        setMostraBackoffice(false);
      }
    };

    const init = async () => {
      try {
        // =========================
        // USER
        // =========================

        const {
          data: { user },
        } = await supabase.auth.getUser();

        setUser(user);
        await refreshMostraBackoffice(user);

        // =========================
        // CANTIERI
        // =========================

        const cantieriData =
          await loadCantieri();

        setCantieri(cantieriData);

        // =========================
        // ULTIMA TIMBRATURA
        // =========================

        if (user) {
          await refreshUltimaTimbratura(
            user.id
          );
        }
      } catch (error) {
        console.error(error);
      } finally {
        setInizializzato(true);
      }
    };

    init();

    // =========================
    // AUTH LISTENER
    // =========================

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser =
          session?.user || null;

        setUser(currentUser);
        await refreshMostraBackoffice(
          currentUser
        );

        await refreshUltimaTimbratura(
          currentUser?.id || null
        );
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUltimaTimbratura]);

  // =========================
  // HANDLE TIMBRATURA
  // =========================

  const handleTimbraturaPage = async (
    tipo: TipoTimbratura
  ) => {
    if (tipo === TIMBRATURE.ENTRATA) {
      if (!cantiereId && !attivitaTipo) {
        alert(
          "Seleziona un cantiere oppure un'attività"
        );

        return;
      }

      if (cantiereId && attivitaTipo) {
        alert(
          "Seleziona solo un cantiere oppure solo un'attività"
        );

        return;
      }
    }

    try {
      await handleTimbratura({
        cantiereId: cantiereId || null,
        attivitaTipo: attivitaTipo || null,
        tipo,
      });

      alert(
        `Timbratura ${tipo} registrata`
      );
    } catch (error: unknown) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Errore timbratura"
      );
    }
  };

  const handleCantiereChange = (
    nextCantiereId: string
  ) => {
    setCantiereId(nextCantiereId);

    if (nextCantiereId) {
      setAttivitaTipo("");
    }
  };

  const handleAttivitaChange = (
    nextAttivitaTipo: TipoAttivita | ""
  ) => {
    setAttivitaTipo(nextAttivitaTipo);

    if (nextAttivitaTipo) {
      setCantiereId("");
    }
  };

  // =========================
  // LOADING INIT
  // =========================

  if (!inizializzato) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-900">
        <div className="text-gray-500">
          Caricamento...
        </div>
      </main>
    );
  }

  // =========================
  // LOGIN
  // =========================

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-100 text-gray-900">
        <div className="bg-white border rounded-2xl shadow p-6 w-full max-w-md text-gray-900">
          <h1 className="text-3xl font-bold mb-6">
            PRESENZE APP
          </h1>

          <button
            onClick={async () => {
              const email =
                prompt("Inserisci email");

              if (!email) {
                return;
              }

              const { error } =
                await supabase.auth.signInWithOtp(
                  {
                    email,
                  }
                );

              if (error) {
                alert(error.message);

                return;
              }

              alert(
                "Controlla la mail per il login"
              );
            }}
            className="w-full bg-black text-white rounded-lg p-4 font-semibold"
          >
            LOGIN
          </button>
        </div>
      </main>
    );
  }

  // =========================
  // UI
  // =========================

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6 text-gray-900">
        {/* HEADER */}

        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold mb-2">
            PRESENZE APP
          </h1>

          <button
            onClick={async () => {
              const { error } =
                await supabase.auth.signOut();

              if (error) {
                alert(error.message);
              }
            }}
            className="text-sm font-semibold text-gray-500"
          >
            Logout
          </button>
        </div>

        <div className="mb-4 flex gap-4 text-sm font-semibold">
          <Link
            href="/storico"
            className="text-blue-600"
          >
            Storico
          </Link>

          {mostraBackoffice && (
            <Link
              href="/backoffice"
              className="text-blue-600"
            >
              Back-office
            </Link>
          )}
        </div>

        <p className="text-sm text-gray-500 mb-6">
          Utente: {user.email}
        </p>

        {/* CANTIERE */}

        <SelectCantiere
          cantieri={cantieri}
          cantiereId={cantiereId}
          onChange={handleCantiereChange}
        />

        <SelectAttivita
          attivitaTipo={attivitaTipo}
          onChange={handleAttivitaChange}
        />

        {/* STATO */}

        <StatoBadge
          stato={statoAttuale}
          ultimaTimbratura={
            ultimaTimbratura
          }
        />

        {/* BOTTONI */}

        <PulsantiTimbratura
          statoAttuale={statoAttuale}
          loading={loadingTimbratura}
          onTimbratura={
            handleTimbraturaPage
          }
        />
      </div>
    </main>
  );
}
