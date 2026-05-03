"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

import {
  StatoLavoratore,
  Timbratura,
  TipoTimbratura,
} from "@/types/timbrature";

import { TIMBRATURE } from "@/constants/stati";

import { calcolaStatoDaUltimaTimbratura } from "@/services/timbrature/calcolaStato";

import { creaTimbratura } from "@/services/timbrature/creaTimbratura";

import { loadCantieri } from "@/services/cantieri/loadCantieri";

import { loadUltimaTimbratura } from "@/services/timbrature/loadUltimaTimbratura";

import { StatoBadge } from "@/components/timbrature/StatoBadge";

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

        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Cantiere
          </label>

          <select
            value={cantiereId}
            onChange={(e) =>
              setCantiereId(
                e.target.value
              )
            }
            className="w-full border rounded-lg p-3"
          >
            <option value="">
              Seleziona cantiere
            </option>

            {cantieri.map(
              (cantiere) => (
                <option
                  key={cantiere.id}
                  value={cantiere.id}
                >
                  {cantiere.nome}
                </option>
              )
            )}
          </select>
        </div>

        {/* STATO */}

        <StatoBadge
          stato={statoAttuale}
          ultimaTimbratura={
            ultimaTimbratura
          }
        />

        {/* BOTTONI */}

        <div className="flex flex-col gap-3">
          {statoAttuale ===
            "FUORI" && (
            <button
              onClick={() =>
                handleTimbratura(
                  TIMBRATURE.ENTRATA
                )
              }
              disabled={loading}
              className="bg-green-600 text-white rounded-lg p-4 font-semibold"
            >
              {loading
                ? "Salvataggio..."
                : "TIMBRA ENTRATA"}
            </button>
          )}

          {statoAttuale ===
            "DENTRO" && (
            <>
              <button
                onClick={() =>
                  handleTimbratura(
                    TIMBRATURE.PAUSA
                  )
                }
                disabled={loading}
                className="bg-yellow-500 text-white rounded-lg p-4 font-semibold"
              >
                {loading
                  ? "Salvataggio..."
                  : "INIZIA PAUSA"}
              </button>

              <button
                onClick={() =>
                  handleTimbratura(
                    TIMBRATURE.USCITA
                  )
                }
                disabled={loading}
                className="bg-red-600 text-white rounded-lg p-4 font-semibold"
              >
                {loading
                  ? "Salvataggio..."
                  : "TIMBRA USCITA"}
              </button>
            </>
          )}

          {statoAttuale ===
            "IN_PAUSA" && (
            <button
              onClick={() =>
                handleTimbratura(
                  TIMBRATURE.RIENTRO
                )
              }
              disabled={loading}
              className="bg-blue-600 text-white rounded-lg p-4 font-semibold"
            >
              {loading
                ? "Salvataggio..."
                : "FINE PAUSA"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
