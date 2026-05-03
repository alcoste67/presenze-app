"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

import { TipoTimbratura } from "@/types/timbrature";

import { loadCantieri } from "@/services/cantieri/loadCantieri";

import { useTimbrature } from "@/hooks/useTimbrature";

import { StatoBadge } from "@/components/timbrature/StatoBadge";
import { PulsantiTimbratura } from "@/components/timbrature/PulsantiTimbratura";
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

  const [inizializzato, setInizializzato] =
    useState(false);

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
    const init = async () => {
      try {
        // =========================
        // USER
        // =========================

        const {
          data: { user },
        } = await supabase.auth.getUser();

        setUser(user);

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
    try {
      await handleTimbratura({
        cantiereId,
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
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // LOADING INIT
  // =========================

  if (!inizializzato) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-100">
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
      <main className="min-h-screen flex items-center justify-center p-6 bg-gray-100">
        <div className="bg-white border rounded-2xl shadow p-6 w-full max-w-md">
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
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow p-6">
        {/* HEADER */}

        <h1 className="text-3xl font-bold mb-2">
          PRESENZE APP
        </h1>

        <p className="text-sm text-gray-500 mb-6">
          Utente: {user.email}
        </p>

        {/* CANTIERE */}

        <SelectCantiere
          cantieri={cantieri}
          cantiereId={cantiereId}
          onChange={setCantiereId}
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
