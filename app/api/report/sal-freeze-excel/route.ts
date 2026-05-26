import type { NextRequest } from "next/server";

import { API_HEADERS } from "@/constants/api";
import {
  SAL_FREEZE_EXPORT,
  SAL_FREEZE_TESTI,
} from "@/constants/salFreeze";
import { buildCommessaWorkbook } from "@/app/api/report/commessa-excel/xlsx";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import { loadSalFreezeExportCommittente } from "@/services/salFreeze/loadSalFreezeExportCommittente";
import type { SalFreezeExportCommittente } from "@/types/salFreeze";

export const runtime = "nodejs";

const SAL_FREEZE_PDF = SAL_FREEZE_TESTI.PDF;
const SAL_FREEZE_EXCEL_EXPORT = SAL_FREEZE_EXPORT.EXCEL;
const SAL_FREEZE_QUERY = SAL_FREEZE_EXPORT.QUERY;

const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
} as const;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function jsonErrore(error: string, status: number) {
  return Response.json(
    {
      error,
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  );
}

function estraiBearerToken(request: NextRequest) {
  const authorization = request.headers.get(
    API_HEADERS.AUTHORIZATION
  );

  if (
    !authorization?.startsWith(
      API_HEADERS.BEARER_PREFIX
    )
  ) {
    return null;
  }

  const token = authorization
    .slice(API_HEADERS.BEARER_PREFIX.length)
    .trim();

  return token || null;
}

function getQueryValue(
  request: NextRequest,
  key: string
) {
  const value = request.nextUrl.searchParams.get(key);
  const trimmed = value?.trim();

  return trimmed || null;
}

function formattaData(value: string) {
  return new Intl.DateTimeFormat("it-IT").format(
    new Date(`${value}T00:00:00`)
  );
}

function formattaDataOra(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formattaDelta(value: number) {
  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(0)}%`;
}

function getNomeFile({
  cantiereNome,
  freeze,
}: {
  cantiereNome: string;
  freeze: SalFreezeExportCommittente["freeze"];
}) {
  const cantiereFile = cantiereNome
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return `${SAL_FREEZE_EXCEL_EXPORT.FILE_PREFIX}_${cantiereFile || "cantiere"}_${freeze.period_start}_${freeze.period_end}.xlsx`;
}

function buildSalSheet({
  freezeExport,
  cantiereNome,
}: {
  freezeExport: SalFreezeExportCommittente;
  cantiereNome: string;
}) {
  const rows: Array<Array<string | number>> = [
    ["Cantiere", cantiereNome],
    [
      "Periodo",
      `${formattaData(freezeExport.freeze.period_start)} - ${formattaData(freezeExport.freeze.period_end)}`,
    ],
    ["Data freeze", formattaDataOra(freezeExport.freeze.freeze_at)],
    [],
    [
      SAL_FREEZE_PDF.LAVORAZIONE,
      SAL_FREEZE_PDF.PERCENTUALE_PRECEDENTE,
      SAL_FREEZE_PDF.PERCENTUALE_ATTUALE,
      SAL_FREEZE_PDF.DELTA_PERIODO,
    ],
  ];

  freezeExport.lavorazioni.forEach((lavorazione) => {
    rows.push([
      lavorazione.lavorazione_nome_snapshot,
      lavorazione.percentuale_precedente,
      lavorazione.percentuale_attuale,
      formattaDelta(lavorazione.delta_percentuale),
    ]);
  });

  return rows;
}

function buildFotoSheet({
  freezeExport,
}: {
  freezeExport: SalFreezeExportCommittente;
}) {
  const rows: Array<Array<string | number>> = [
    ["ID foto SAL", "Descrizione", "Data riferimento", "Storage path"],
  ];

  freezeExport.foto.slice(0, 6).forEach((foto) => {
    rows.push([
      foto.sal_foto_id,
      foto.descrizione,
      formattaData(foto.data_riferimento),
      foto.storage_path_snapshot,
    ]);
  });

  return rows;
}

export async function GET(
  request: NextRequest
): Promise<Response> {
  const accessToken = estraiBearerToken(request);

  if (!accessToken) {
    return jsonErrore(
      SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO,
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabaseAdmin.auth.getUser(accessToken);

  if (authError || !user?.email) {
    return jsonErrore(
      SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO,
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
      SAL_FREEZE_TESTI.ERRORI.ACCESSO_NEGATO,
      HTTP_STATUS.FORBIDDEN
    );
  }

  const freezeId = getQueryValue(
    request,
    SAL_FREEZE_QUERY.FREEZE_ID
  );
  const cantiereNome =
    getQueryValue(request, SAL_FREEZE_QUERY.CANTIERE_NOME) || "";

  if (!freezeId) {
    return jsonErrore(
      SAL_FREEZE_TESTI.ERRORI.INPUT_NON_VALIDO,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  try {
    const freezeExport =
      await loadSalFreezeExportCommittente({
        freezeId,
      });

    if (!freezeExport) {
      return jsonErrore(
        SAL_FREEZE_TESTI.ERRORI.FREEZE_NON_TROVATO,
        HTTP_STATUS.NOT_FOUND
      );
    }

    const workbook = buildCommessaWorkbook([
      {
        name: SAL_FREEZE_TESTI.EXCEL.FOGLIO_SAL,
        rows: buildSalSheet({
          freezeExport,
          cantiereNome:
            cantiereNome || freezeExport.freeze.cantiere_id,
        }),
      },
      {
        name: SAL_FREEZE_TESTI.EXCEL.FOGLIO_FOTO,
        rows: buildFotoSheet({
          freezeExport,
        }),
      },
    ]);

    return new Response(Buffer.from(workbook), {
      status: 200,
      headers: {
        "Content-Type": SAL_FREEZE_EXCEL_EXPORT.MIME_TYPE,
        "Content-Disposition": `attachment; filename="${getNomeFile({
          cantiereNome:
            cantiereNome || freezeExport.freeze.cantiere_id,
          freeze: freezeExport.freeze,
        })}"`,
        ...NO_STORE_HEADERS,
      },
    });
  } catch (error: unknown) {
    console.error("Errore export Excel freeze SAL", error);
    return jsonErrore(
      SAL_FREEZE_TESTI.ERRORI.GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
