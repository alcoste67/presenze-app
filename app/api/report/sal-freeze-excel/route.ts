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

function jsonErrore(
  step: string,
  errorMessage: string,
  status: number
) {
  return Response.json(
    {
      success: false,
      step,
      errorMessage,
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

function sanitizeExcelText(value: unknown) {
  const testo =
    typeof value === "string"
      ? value
      : value == null
        ? ""
        : String(value);

  return testo
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32767);
}

function sanitizeFotoValue(value: unknown) {
  const testo = sanitizeExcelText(value);

  if (!testo) {
    return "Foto non disponibile";
  }

  if (/^data:image\/(png|jpe?g|webp);base64,/i.test(testo)) {
    return "Foto incorporata / data URL";
  }

  if (/^https?:\/\//i.test(testo)) {
    return testo;
  }

  if (/^sal-freeze\//i.test(testo)) {
    const segmenti = testo.split("/");
    return segmenti.slice(-3).join("/");
  }

  return testo;
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
    ["Cantiere", sanitizeExcelText(cantiereNome)],
    [
      "Periodo",
      sanitizeExcelText(`${formattaData(freezeExport.freeze.period_start)} - ${formattaData(freezeExport.freeze.period_end)}`),
    ],
    ["Data freeze", sanitizeExcelText(formattaDataOra(freezeExport.freeze.freeze_at))],
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
      sanitizeExcelText(lavorazione.lavorazione_nome_snapshot),
      lavorazione.percentuale_precedente,
      lavorazione.percentuale_attuale,
      sanitizeExcelText(formattaDelta(lavorazione.delta_percentuale)),
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
      sanitizeExcelText(foto.sal_foto_id || foto.id),
      sanitizeExcelText(foto.descrizione) || "Foto non disponibile",
      sanitizeExcelText(formattaData(foto.data_riferimento)),
      sanitizeFotoValue(foto.storage_path_snapshot),
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
      "auth",
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
      "auth",
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
      "admin_check",
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
      "input",
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
        "freeze_not_found",
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
    const errorMessage =
      error instanceof Error
        ? error.message
        : SAL_FREEZE_TESTI.ERRORI.GENERICO;

    console.error("[sal-period-excel-export-error]", {
      freezeId,
      errorMessage,
    });

    return jsonErrore(
      "unexpected",
      errorMessage,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
