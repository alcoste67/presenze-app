"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

const TIPI = {
  ENTRATA: "entrata",
  PAUSA_INIZIO: "pausa_inizio",
  PAUSA_FINE: "pausa_fine",
  USCITA: "uscita",
};

type Timbratura = {
  id: string;
  tipo: string;
  created_at: string;
};

export default function StoricoPage() {

  const [timbrature, setTimbrature] =
    useState<Timbratura[]>([]);

  const [loading, setLoading] =
    useState(true);
    

  async function caricaStorico() {

    setLoading(true);

    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);

    const domani = new Date(oggi);
    domani.setDate(domani.getDate() + 1);

    const { data, error } = await supabase
      .from("timbrature")
      .select("*")
      .eq("operatore", "Alessandro")
      .gte("created_at", oggi.toISOString())
      .lt("created_at", domani.toISOString())
      .order("created_at", {
        ascending: true,
      });

    console.log("STORICO:", data);
    console.log("ERRORE:", error);

    if (error) {
      alert("Errore caricamento storico");
      setLoading(false);
      return;
    }

    setTimbrature(data || []);
    setLoading(false);
  }

  useEffect(() => {
    Promise.resolve().then(() => {
      caricaStorico();
    });
  }, []);

  function formattaOra(data: string) {

    return new Date(data)
      .toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      });
  }

  function formattaTipo(tipo: string) {

    switch (tipo) {

      case TIPI.ENTRATA:
        return "Entrata";

      case TIPI.PAUSA_INIZIO:
        return "Inizio pausa";

      case TIPI.PAUSA_FINE:
        return "Fine pausa";

      case TIPI.USCITA:
        return "Uscita";

      default:
        return tipo;
    }
  }

  function coloreEvento(tipo: string) {

    switch (tipo) {

      case TIPI.ENTRATA:
        return "#16a34a";

      case TIPI.PAUSA_INIZIO:
        return "#f59e0b";

      case TIPI.PAUSA_FINE:
        return "#2563eb";

      case TIPI.USCITA:
        return "#dc2626";

      default:
        return "#6b7280";
    }
  }

  function calcolaOreLavorate() {

    let totaleMillisecondi = 0;

    let inizioLavoro: Date | null = null;

    for (const evento of timbrature) {

      if (
        evento.tipo === TIPI.ENTRATA ||
        evento.tipo === TIPI.PAUSA_FINE
      ) {
        inizioLavoro =
          new Date(evento.created_at);
      }

      if (
        (
          evento.tipo === TIPI.PAUSA_INIZIO ||
          evento.tipo === TIPI.USCITA
        ) &&
        inizioLavoro
      ) {

        const fine =
          new Date(evento.created_at);

        totaleMillisecondi +=
          fine.getTime() -
          inizioLavoro.getTime();

        inizioLavoro = null;
      }
    }

    const ore =
      Math.floor(
        totaleMillisecondi / 1000 / 60 / 60
      );

    const minuti =
      Math.floor(
        (totaleMillisecondi / 1000 / 60) % 60
      );

    return `${ore}h ${minuti}m`;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "600px",
          margin: "0 auto",
          background: "white",
          borderRadius: "24px",
          padding: "24px",
          boxShadow:
            "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >

        <h1
          style={{
            fontSize: "36px",
            fontWeight: "bold",
            marginBottom: "12px",
          }}
        >
          Storico Giornaliero
        </h1>

        <Link
          href="/"
          style={{
            display: "inline-block",
            marginBottom: "24px",
            fontWeight: "bold",
            textDecoration: "none",
            color: "#2563eb"
          }}
        >
          ← Torna alla timbratura
        </Link>

        <div
          style={{
            background: "#f9fafb",
            padding: "16px",
            borderRadius: "16px",
            marginBottom: "24px",
          }}
        >
          <p
            style={{
              fontSize: "20px",
              fontWeight: "bold",
            }}
          >
            Ore lavorate:{" "}
            {calcolaOreLavorate()}
          </p>
        </div>

        {loading && (
          <p>Caricamento...</p>
        )}

        {!loading &&
          timbrature.length === 0 && (
            <p>
              Nessuna timbratura oggi
            </p>
          )}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >

          {timbrature.map((evento) => (

            <div
              key={evento.id}
              style={{
                border:
                  "1px solid #e5e7eb",
                borderLeft:
                  `8px solid ${coloreEvento(evento.tipo)}`,
                borderRadius: "14px",
                padding: "16px",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
              }}
            >

              <div>
                <p
                  style={{
                    fontWeight: "bold",
                    fontSize: "18px",
                  }}
                >
                  {formattaTipo(evento.tipo)}
                </p>
              </div>

              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                }}
              >
                {formattaOra(
                  evento.created_at
                )}
              </div>

            </div>

          ))}

        </div>

      </div>
    </main>
  );
}
