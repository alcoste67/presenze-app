"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

import {
  StatoLavoratore,
  Timbratura,
  TipoTimbratura,
} from "@/types/timbrature";

import { calcolaStatoDaUltimaTimbratura } from "@/services/timbrature/calcolaStato";

import { creaTimbratura } from "@/services/timbrature/creaTimbratura";

import { loadCantieri } from "@/services/cantieri/loadCantieri";

import { loadUltimaTimbratura } from "@/services/timbrature/loadUltimaTimbratura";

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

  const [loading, setLoading] =
    useState(false);

  const [
    ultimaTimbratura,
    setUltimaTimbratura,
  ] = useState<Timbratura | null>(null);

  const [inizializzato, setInizializzato] =
    useState(false);

  // =========================
  // STATO DERIVATO
  // =========================

  const statoAttuale: StatoLavoratore =
    calcolaStatoDaUltimaTimbratura(
      ultimaTimbratura?.tipo
    );

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
          const ultima =
            await loadUltimaTimbratura(
              user.id
            );

          setUltimaTimbratura(ultima);
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

        if (currentUser) {
          const ultima =
            await loadUltimaTimbratura(
              currentUser.id
            );

          setUltimaTimbratura(ultima);
        } else {
          setUltimaTimbratura(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // =========================
  // HANDLE TIMBRATURA
  // =========================

  const handleTimbratura = async (
    tipo: TipoTimbratura
  ) => {
    if (!user) {
      alert("Utente non autenticato");

      return;
    }

    if (!cantiereId) {
      alert("Seleziona un cantiere");

      return;
    }

    try {
      setLoading(true);

      await creaTimbratura({
        userId: user.id,
        cantiereId,
        tipo,
      });

      const ultima =
        await loadUltimaTimbratura(
          user.id
        );

      setUltimaTimbratura(ultima);

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
          loading={loading}
          onTimbratura={handleTimbratura}
        />
      </div>
    </main>
  );
}
