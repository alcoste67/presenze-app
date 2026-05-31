import type { NextRequest } from "next/server";

import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import { COMMESSA_TESTI } from "@/constants/commessa";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadCantiereBackoffice } from "@/services/cantieri/loadCantiereBackoffice";
import { loadDashboardCommessa } from "@/services/commessa/loadDashboardCommessa";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import { buildCommessaWorkbook } from "@/app/api/report/commessa-excel/xlsx";
import type { CantiereBackoffice } from "@/types/cantieri";
import type { CostoMacchinarioCommessa } from "@/types/costiMacchinari";
import type { DashboardCommessaData } from "@/services/commessa/loadDashboardCommessa";
import {
  LABEL_STATI_RAPPORTO_INTERVENTO,
} from "@/constants/rapportiIntervento";
import { SAL_STATI } from "@/constants/sal";

export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonErrore(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: NO_STORE_HEADERS }
  );
}

function formattaData(value: string) {
  return new Intl.DateTimeFormat("it-IT").format(
    new Date(`${value}T00:00:00`)
  );
}

function formattaOre(minutiTotali: number) {
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;

  return `${ore}h ${minuti}m`;
}

function formattaOreDecimali(valore: number) {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 2,
  }).format(valore);
}

function formattaEuro(valore: number | null) {
  if (valore === null) {
    return "";
  }

  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(valore);
}

function getNomeFile(cantiere: CantiereBackoffice) {
  const cantiereFile = cantiere.nome
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return `${COMMESSA_TESTI.TITOLO.toLowerCase()}_${cantiereFile || "cantiere"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

function getStatoLavorazioneLabel(stato: string) {
  if (stato === SAL_STATI.COMPLETATA) {
    return COMMESSA_TESTI.COMPLETATA;
  }

  if (stato === SAL_STATI.IN_CORSO) {
    return COMMESSA_TESTI.IN_CORSO;
  }

  return COMMESSA_TESTI.NON_INIZIATA;
}

function getStatoRapportoLabel(stato: string) {
  return LABEL_STATI_RAPPORTO_INTERVENTO[
    stato as keyof typeof LABEL_STATI_RAPPORTO_INTERVENTO
  ] || stato;
}

function buildRiepilogoSheet({
  cantiere,
  dashboard,
  mostraCosti,
}: {
  cantiere: CantiereBackoffice;
  dashboard: DashboardCommessaData;
  mostraCosti: boolean;
}) {
  const totalOreMacchinari = dashboard.costiMacchinari.reduce(
    (somma, costo) => somma + costo.ore_utilizzo,
    0
  );
  const lavorazioni = dashboard.sal.lavorazioni;

  const rows: Array<Array<string | number>> = [
    ["Cantiere", cantiere.nome],
    ["Indirizzo", cantiere.indirizzo],
    ["Avanzamento %", dashboard.sal.avanzamentoTotale],
    [
      "Ore uomo totali",
      formattaOre(dashboard.sal.oreUomoTotaliMinuti),
    ],
    [
      "Lavorazioni completate",
      lavorazioni.filter(
        (lavorazione) =>
          lavorazione.stato === SAL_STATI.COMPLETATA
      ).length,
    ],
    [
      "Lavorazioni in corso",
      lavorazioni.filter(
        (lavorazione) =>
          lavorazione.stato === SAL_STATI.IN_CORSO
      ).length,
    ],
    ["Rapporti intervento", dashboard.numeroRapportiIntervento],
    ["Foto SAL", dashboard.numeroFotoSal],
    ["Ore macchinari", formattaOreDecimali(totalOreMacchinari)],
    ["Costi visibili", mostraCosti ? "Sì" : "No"],
  ];

  return rows;
}

function buildLavorazioniSheet({
  dashboard,
}: {
  dashboard: DashboardCommessaData;
}) {
  const rows: Array<Array<string | number>> = [
    ["Nome", "Percentuale", "Ore uomo", "Stato"],
  ];

  dashboard.sal.lavorazioni.forEach((lavorazione) => {
    rows.push([
      lavorazione.nome,
      lavorazione.percentuale_completamento,
      formattaOre(lavorazione.oreUomoMinuti),
      getStatoLavorazioneLabel(lavorazione.stato),
    ]);
  });

  return rows;
}

function buildOreUomoSheet({
  dashboard,
}: {
  dashboard: DashboardCommessaData;
}) {
  const rows: Array<Array<string | number>> = [
    ["Nome", "Ore uomo", "Percentuale", "Stato"],
  ];

  dashboard.sal.lavorazioni
    .filter((lavorazione) => lavorazione.oreUomoMinuti > 0)
    .sort((a, b) => b.oreUomoMinuti - a.oreUomoMinuti)
    .forEach((lavorazione) => {
      rows.push([
        lavorazione.nome,
        formattaOre(lavorazione.oreUomoMinuti),
        lavorazione.percentuale_completamento,
        getStatoLavorazioneLabel(lavorazione.stato),
      ]);
    });

  return rows;
}

function buildMacchinariSheet({
  dashboard,
  mostraCosti,
}: {
  dashboard: DashboardCommessaData;
  mostraCosti: boolean;
}) {
  const rows: Array<Array<string | number>> = mostraCosti
    ? [
        [
          "Macchinario",
          "Tipo",
          "Data utilizzo",
          "Ore utilizzo",
          "Tariffa oraria",
          "Costo totale",
          "Note",
        ],
      ]
    : [
        [
          "Macchinario",
          "Tipo",
          "Data utilizzo",
          "Ore utilizzo",
          "Note",
        ],
      ];

  const macchinariById = new Map(
    dashboard.macchinariPubblici.map((macchinario) => [
      macchinario.id,
      macchinario,
    ])
  );

  dashboard.costiMacchinari.forEach((costo) => {
    const nomeMacchinario =
      (costo.macchinario_id &&
        macchinariById.get(costo.macchinario_id)?.nome) ||
      costo.tipo_macchinario;

    if (mostraCosti) {
      const costoAdmin =
        costo as CostoMacchinarioCommessa;

      rows.push([
        nomeMacchinario,
        costo.tipo_macchinario,
        formattaData(costo.data_utilizzo),
        formattaOreDecimali(costo.ore_utilizzo),
        formattaEuro(costoAdmin.tariffa_oraria),
        formattaEuro(costoAdmin.costo_totale),
        costo.note,
      ]);
      return;
    }

    rows.push([
      nomeMacchinario,
      costo.tipo_macchinario,
      formattaData(costo.data_utilizzo),
      formattaOreDecimali(costo.ore_utilizzo),
      costo.note,
    ]);
  });

  return rows;
}

function buildRapportiSheet({
  dashboard,
}: {
  dashboard: DashboardCommessaData;
}) {
  const rows: Array<Array<string | number>> = [
    [
      "Data intervento",
      "Cliente committente",
      "Responsabile",
      "Ore uomo reali",
      "Viaggio",
      "Fatturabile",
      "Stato",
      "Note",
    ],
  ];

  dashboard.rapportiRecenti.forEach((rapporto) => {
    rows.push([
      formattaData(rapporto.data_intervento),
      rapporto.cliente_committente,
      rapporto.responsabile_nome,
      formattaOre(rapporto.ore_uomo_reali_minuti),
      formattaOre(rapporto.viaggio_minuti),
      formattaOre(rapporto.ore_fatturabili_minuti),
      getStatoRapportoLabel(rapporto.stato),
      rapporto.note,
    ]);
  });

  return rows;
}

export async function GET(request: NextRequest) {
  const cantiereId =
    request.nextUrl.searchParams.get(
      "cantiereId"
    ) || "";

  try {
    if (!cantiereId) {
      return jsonErrore(
        COMMESSA_TESTI.ERRORI.CANTIERE_OBBLIGATORIO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const accessToken = estraiBearerToken(request);

    if (!accessToken) {
      return jsonErrore(
        COMMESSA_TESTI.ERRORI.TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(
        COMMESSA_TESTI.ERRORI.TOKEN_NON_VALIDO,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const utenteAdmin = await isAdmin(
      user.email,
      supabaseAdmin
    );
    const utenteResponsabile = utenteAdmin
      ? false
      : await isResponsabile(user.email, supabaseAdmin);

    if (!utenteAdmin && !utenteResponsabile) {
      return jsonErrore(
        COMMESSA_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const [cantiere, dashboard] = await Promise.all([
      loadCantiereBackoffice(cantiereId, supabaseAdmin),
      loadDashboardCommessa({
        cantiereId,
        includeCosti: utenteAdmin,
        supabaseClient: supabaseAdmin,
      }),
    ]);

    if (!cantiere) {
      return jsonErrore(
        COMMESSA_TESTI.ERRORI.CANTIERE_NON_TROVATO,
        HTTP_STATUS.NOT_FOUND
      );
    }

    const workbook = buildCommessaWorkbook([
      {
        name: "Riepilogo",
        rows: buildRiepilogoSheet({
          cantiere,
          dashboard,
          mostraCosti: utenteAdmin,
        }),
      },
      {
        name: "Lavorazioni",
        rows: buildLavorazioniSheet({ dashboard }),
      },
      {
        name: "Ore uomo",
        rows: buildOreUomoSheet({ dashboard }),
      },
      {
        name: "Macchinari",
        rows: buildMacchinariSheet({
          dashboard,
          mostraCosti: utenteAdmin,
        }),
      },
      {
        name: "Rapporti intervento",
        rows: buildRapportiSheet({ dashboard }),
      },
    ]);

    const fileName = getNomeFile(cantiere);

    return new Response(workbook, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("Errore generazione Excel commessa", {
      cantiereId,
      message:
        error instanceof Error
          ? error.message
          : String(error),
      stack:
        error instanceof Error
          ? error.stack
          : undefined,
      error,
    });

    return jsonErrore(
      COMMESSA_TESTI.ERRORI.EXCEL_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
