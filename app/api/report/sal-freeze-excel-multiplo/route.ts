import type { NextRequest } from "next/server";

import { buildCommessaWorkbook } from "@/app/api/report/commessa-excel/xlsx";
import { API_HEADERS } from "@/constants/api";
import {
  SAL_FREEZE_EXPORT,
  SAL_FREEZE_TESTI,
} from "@/constants/salFreeze";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import { loadSalFreezeExportCommittente } from "@/services/salFreeze/loadSalFreezeExportCommittente";
import type { SalFreezeLavorazione, SalFreezeMensile } from "@/types/salFreeze";

export const runtime = "nodejs";

const SAL_FREEZE_PDF = SAL_FREEZE_TESTI.PDF;
const SAL_FREEZE_EXCEL_EXPORT = SAL_FREEZE_EXPORT.EXCEL_MULTIPLO;

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

type ExportSheet = {
  name: string;
  rows: Array<Array<string | number>>;
};

type ExportSelectionBody = {
  periodStart: string;
  periodEnd: string;
  cantiereIds: string[];
};

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

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseBody(value: unknown): ExportSelectionBody | null {
  if (!isRecord(value)) {
    return null;
  }

  const periodStart =
    typeof value.periodStart === "string"
      ? value.periodStart.trim()
      : "";
  const periodEnd =
    typeof value.periodEnd === "string"
      ? value.periodEnd.trim()
      : "";
  const cantiereIds = Array.isArray(value.cantiereIds)
    ? value.cantiereIds
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  if (!periodStart || !periodEnd || cantiereIds.length === 0) {
    return null;
  }

  return {
    periodStart,
    periodEnd,
    cantiereIds: Array.from(new Set(cantiereIds)),
  };
}

function parseIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : null;
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
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 32767);
}

function sanitizeSheetName(value: string) {
  return value
    .replace(/[\[\]\:\*\?\/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "Foglio";
}

function getUniqueSheetName(
  baseName: string,
  usedNames: Set<string>
) {
  const sanitize = (name: string) => sanitizeSheetName(name);
  const base = sanitize(baseName);
  let candidate = base;
  let counter = 2;

  while (usedNames.has(candidate)) {
    const suffix = `_${counter}`;
    const maxBaseLength = 31 - suffix.length;
    candidate = `${base.slice(0, maxBaseLength)}${suffix}`;
    counter += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

function getPeriodLabel(periodStart: string, periodEnd: string) {
  return `${formattaData(periodStart)} - ${formattaData(periodEnd)}`;
}

function buildSalSheet({
  freezeExport,
  cantiereNome,
  periodStart,
  periodEnd,
  freezeAtLabel,
}: {
  freezeExport: {
    freeze: SalFreezeMensile;
    lavorazioni: SalFreezeLavorazione[];
  };
  cantiereNome: string;
  periodStart: string;
  periodEnd: string;
  freezeAtLabel: string;
}): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ["Cantiere", sanitizeExcelText(cantiereNome)],
    ["Periodo", sanitizeExcelText(getPeriodLabel(periodStart, periodEnd))],
    ["Data freeze", sanitizeExcelText(freezeAtLabel)],
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

  if (freezeExport.lavorazioni.length === 0) {
    rows.push(["Mancante", "Nessun SAL periodo disponibile"]);
  }

  return rows;
}

function buildMissingSheet({
  cantiereNome,
  periodStart,
  periodEnd,
}: {
  cantiereNome: string;
  periodStart: string;
  periodEnd: string;
}) {
  return [
    ["Cantiere", sanitizeExcelText(cantiereNome)],
    ["Periodo", sanitizeExcelText(getPeriodLabel(periodStart, periodEnd))],
    [],
    ["Mancante", "Nessun SAL periodo disponibile"],
  ];
}

function getNomeFile({
  periodStart,
  periodEnd,
}: {
  periodStart: string;
  periodEnd: string;
}) {
  return `${SAL_FREEZE_EXCEL_EXPORT.FILE_PREFIX}_${periodStart}_${periodEnd}.xlsx`;
}

async function buildSheetsForCantieri({
  periodStart,
  periodEnd,
  selectedCantieri,
}: {
  periodStart: string;
  periodEnd: string;
  selectedCantieri: Array<{ id: string; nome: string }>;
}) {
  const sheets: ExportSheet[] = [];
  const usedNames = new Set<string>();

  for (const cantiere of selectedCantieri) {
    const { data: freeze, error: freezeError } =
      await supabaseAdmin
      .from("sal_freeze_mensili")
      .select(
        "id, cantiere_id, period_start, period_end, freeze_at, created_by, note, metadata, annullato_at, annullato_by"
      )
      .eq("cantiere_id", cantiere.id)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .is("annullato_at", null)
      .order("freeze_at", { ascending: false })
      .maybeSingle();

    if (freezeError) {
      throw new Error(
        `Errore lettura SAL periodo per ${cantiere.id}: ${freezeError.message}`
      );
    }

    if (!freeze?.id) {
      sheets.push({
        name: getUniqueSheetName(
          cantiere.nome || cantiere.id,
          usedNames
        ),
        rows: buildMissingSheet({
          cantiereNome: cantiere.nome || cantiere.id,
          periodStart,
          periodEnd,
        }),
      });
      continue;
    }

    const freezeExport = await loadSalFreezeExportCommittente({
      freezeId: freeze.id,
      includeFoto: false,
    });

    if (!freezeExport) {
      sheets.push({
        name: getUniqueSheetName(
          cantiere.nome || cantiere.id,
          usedNames
        ),
        rows: buildMissingSheet({
          cantiereNome: cantiere.nome || cantiere.id,
          periodStart,
          periodEnd,
        }),
      });
      continue;
    }

    sheets.push({
      name: getUniqueSheetName(
        cantiere.nome || cantiere.id,
        usedNames
      ),
      rows: buildSalSheet({
        freezeExport,
        cantiereNome: cantiere.nome || cantiere.id,
        periodStart,
        periodEnd,
        freezeAtLabel: formattaDataOra(freezeExport.freeze.freeze_at),
      }),
    });
  }

  return sheets;
}

export async function POST(
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

  let payload: unknown = null;

  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const body = parseBody(payload);

  if (!body) {
    return jsonErrore(
      "input",
      SAL_FREEZE_TESTI.ERRORI.INPUT_NON_VALIDO,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  const parsedStart = parseIsoDate(body.periodStart);
  const parsedEnd = parseIsoDate(body.periodEnd);

  if (
    !parsedStart ||
    !parsedEnd ||
    parsedStart.getTime() > parsedEnd.getTime()
  ) {
    return jsonErrore(
      "input",
      SAL_FREEZE_TESTI.ERRORI.INPUT_NON_VALIDO,
      HTTP_STATUS.BAD_REQUEST
    );
  }

  try {
    const { data: cantieri, error: cantieriError } =
      await supabaseAdmin
        .from("cantieri")
        .select("id, nome")
        .in("id", body.cantiereIds);

    if (cantieriError) {
      return jsonErrore(
        "cantieri",
        cantieriError.message,
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }

    const cantieriById = new Map(
      (cantieri || []).map((cantiere) => [
        cantiere.id as string,
        {
          id: cantiere.id as string,
          nome: (cantiere.nome as string) || cantiere.id,
        },
      ])
    );

    const selectedCantieri = body.cantiereIds.map(
      (cantiereId) =>
        cantieriById.get(cantiereId) || {
          id: cantiereId,
          nome: cantiereId,
        }
    );

    const sheets = await buildSheetsForCantieri({
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      selectedCantieri,
    });

    const workbook = buildCommessaWorkbook(sheets);

    return new Response(Buffer.from(workbook), {
      status: 200,
      headers: {
        "Content-Type": SAL_FREEZE_EXCEL_EXPORT.MIME_TYPE,
        "Content-Disposition": `attachment; filename="${getNomeFile({
          periodStart: body.periodStart,
          periodEnd: body.periodEnd,
        })}"`,
        ...NO_STORE_HEADERS,
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : SAL_FREEZE_TESTI.ERRORI.GENERICO;

    console.error("[sal-period-excel-multiplo-error]", {
      errorMessage,
      periodStart: body?.periodStart || null,
      periodEnd: body?.periodEnd || null,
    });

    return jsonErrore(
      "unexpected",
      errorMessage,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
