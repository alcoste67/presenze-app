import { readFile } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  RGB,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { API_HEADERS } from "@/constants/api";
import {
  SAL_PDF,
  SAL_STATI,
  SAL_TESTI,
} from "@/constants/sal";
import { supabase } from "@/lib/supabase";
import { loadCantiereBackoffice } from "@/services/cantieri/loadCantiereBackoffice";
import { loadSalCantiere } from "@/services/lavorazioni/loadSalCantiere";
import type {
  SalCantiere,
  SalLavorazione,
  StatoSalLavorazione,
} from "@/types/sal";

export const runtime = "nodejs";

type FontSet = {
  regular: PDFFont;
  bold: PDFFont;
};

type Layout = {
  marginX: number;
  pageWidth: number;
  pageHeight: number;
};

type SalPdfParams = {
  cantiereNome: string;
  dataGenerazione: Date;
  sal: SalCantiere;
};

type SupabaseConAccessToken = typeof supabase & {
  accessToken?: () => Promise<string | null>;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const FOOTER_Y = 28;
const TABLE_BOTTOM_Y = 70;
const TABLE_TOP_Y = 520;
const ROW_HEIGHT = 42;
const HEADER_ROW_HEIGHT = 36;

const COLORS = {
  text: rgb(0.141, 0.149, 0.169),
  muted: rgb(0.435, 0.416, 0.38),
  surface: rgb(1, 0.992, 0.976),
  border: rgb(0.91, 0.878, 0.839),
  dark: rgb(0.141, 0.149, 0.169),
  white: rgb(1, 1, 1),
  orange: rgb(0.91, 0.361, 0.094),
  orangeSoft: rgb(0.984, 0.882, 0.824),
  success: rgb(0.184, 0.42, 0.247),
  successSoft: rgb(0.929, 0.969, 0.937),
  gray: rgb(0.435, 0.416, 0.38),
  graySoft: rgb(0.969, 0.953, 0.925),
};

const SUPABASE_AUTH_COOKIE_PREFIX = "sb-";
const SUPABASE_AUTH_COOKIE_SUFFIX =
  "-auth-token";
const SUPABASE_AUTH_COOKIE_BASE64_PREFIX =
  "base64-";

function normalizzaTestoPdf(value: string) {
  return value
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("’", "'")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "");
}

function estraiBearerToken(
  request: NextRequest
) {
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

function parseAuthCookieValue(value: string) {
  try {
    const decodedValue = decodeURIComponent(value);
    const jsonValue =
      decodedValue.startsWith(
        SUPABASE_AUTH_COOKIE_BASE64_PREFIX
      )
        ? Buffer.from(
            decodedValue.slice(
              SUPABASE_AUTH_COOKIE_BASE64_PREFIX.length
            ),
            "base64"
          ).toString("utf8")
        : decodedValue;
    const payload = JSON.parse(jsonValue) as
      | { access_token?: unknown }
      | unknown[];

    if (
      !Array.isArray(payload) &&
      typeof payload.access_token === "string"
    ) {
      return payload.access_token;
    }

    if (
      Array.isArray(payload) &&
      typeof payload[0] === "string"
    ) {
      return payload[0];
    }
  } catch {
    return null;
  }

  return null;
}

function estraiSupabaseCookieToken(
  request: NextRequest
) {
  const authCookie = request.cookies
    .getAll()
    .find(
      (cookie) =>
        cookie.name.startsWith(
          SUPABASE_AUTH_COOKIE_PREFIX
        ) &&
        cookie.name.endsWith(
          SUPABASE_AUTH_COOKIE_SUFFIX
        )
    );

  return authCookie
    ? parseAuthCookieValue(authCookie.value)
    : null;
}

function getAccessTokenDatiSal(
  request: NextRequest
) {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    estraiBearerToken(request) ||
    estraiSupabaseCookieToken(request)
  );
}

async function withSupabaseAccessToken<T>(
  accessToken: string | null,
  callback: () => Promise<T>
) {
  const supabaseConAccessToken =
    supabase as SupabaseConAccessToken;
  const previousAccessToken =
    supabaseConAccessToken.accessToken;

  if (accessToken) {
    supabaseConAccessToken.accessToken =
      async () => accessToken;
  }

  try {
    return await callback();
  } finally {
    if (previousAccessToken) {
      supabaseConAccessToken.accessToken =
        previousAccessToken;
    } else {
      delete supabaseConAccessToken.accessToken;
    }
  }
}

function drawText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color: RGB;
  }
) {
  page.drawText(normalizzaTestoPdf(text), options);
}

function formattaOreUomo(minutiTotali: number) {
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;

  return `${ore}${SAL_TESTI.UNITA_ORA} ${minuti}${SAL_TESTI.UNITA_MINUTO}`;
}

function formattaData(data: Date) {
  return new Intl.DateTimeFormat(
    SAL_PDF.LOCALE
  ).format(data);
}

function formattaDataFile(data: Date) {
  const year = data.getFullYear();
  const month = String(
    data.getMonth() + 1
  ).padStart(2, "0");
  const day = String(data.getDate()).padStart(
    2,
    "0"
  );

  return `${year}-${month}-${day}`;
}

function getStatoLabel(
  stato: StatoSalLavorazione
) {
  if (stato === SAL_STATI.COMPLETATA) {
    return SAL_TESTI.STATI.COMPLETATA;
  }

  if (stato === SAL_STATI.IN_CORSO) {
    return SAL_TESTI.STATI.IN_CORSO;
  }

  return SAL_TESTI.STATI.NON_INIZIATA;
}

function getStatoColori(
  stato: StatoSalLavorazione
) {
  if (stato === SAL_STATI.COMPLETATA) {
    return {
      background: COLORS.successSoft,
      text: COLORS.success,
    };
  }

  if (stato === SAL_STATI.IN_CORSO) {
    return {
      background: COLORS.orangeSoft,
      text: COLORS.orange,
    };
  }

  return {
    background: COLORS.graySoft,
    text: COLORS.gray,
  };
}

function getNomeFile(
  cantiereNome: string,
  dataGenerazione: Date
) {
  const cantiereFile = cantiereNome
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return `${SAL_PDF.FILE_PREFIX}_${cantiereFile || "cantiere"}_${formattaDataFile(dataGenerazione)}.pdf`;
}

function wrapText({
  text,
  font,
  size,
  maxWidth,
}: {
  text: string;
  font: PDFFont;
  size: number;
  maxWidth: number;
}) {
  const words = normalizzaTestoPdf(text).split(
    /\s+/
  );
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine
      ? `${currentLine} ${word}`
      : word;

    if (
      font.widthOfTextAtSize(nextLine, size) <=
      maxWidth
    ) {
      currentLine = nextLine;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}

function drawWrappedText({
  page,
  text,
  x,
  y,
  maxWidth,
  size,
  font,
  color,
  maxLines,
  lineHeight,
}: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  size: number;
  font: PDFFont;
  color: RGB;
  maxLines: number;
  lineHeight: number;
}) {
  const lines = wrapText({
    text,
    font,
    size,
    maxWidth,
  }).slice(0, maxLines);

  lines.forEach((line, index) => {
    drawText(page, line, {
      x,
      y: y - index * lineHeight,
      size,
      font,
      color,
    });
  });
}

function drawHeader({
  page,
  fonts,
  logo,
  cantiereNome,
  dataGenerazione,
}: {
  page: PDFPage;
  fonts: FontSet;
  logo: {
    draw: (page: PDFPage) => void;
  };
  cantiereNome: string;
  dataGenerazione: Date;
}) {
  logo.draw(page);

  drawText(page, SAL_PDF.TESTI.TITOLO, {
    x: 170,
    y: 776,
    size: 20,
    font: fonts.bold,
    color: COLORS.text,
  });

  drawText(page, SAL_PDF.TESTI.SOTTOTITOLO, {
    x: 170,
    y: 754,
    size: 10,
    font: fonts.regular,
    color: COLORS.muted,
  });

  drawText(
    page,
    `${SAL_PDF.TESTI.DATA_GENERAZIONE}: ${formattaData(dataGenerazione)}`,
    {
      x: 170,
      y: 737,
      size: 9,
      font: fonts.regular,
      color: COLORS.muted,
    }
  );

  page.drawLine({
    start: { x: MARGIN_X, y: 708 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 708 },
    thickness: 2,
    color: COLORS.orange,
  });

  drawText(page, SAL_PDF.TESTI.CANTIERE, {
    x: MARGIN_X,
    y: 680,
    size: 9,
    font: fonts.bold,
    color: COLORS.muted,
  });

  drawWrappedText({
    page,
    text: cantiereNome,
    x: MARGIN_X,
    y: 658,
    maxWidth: PAGE_WIDTH - MARGIN_X * 2,
    size: 24,
    font: fonts.bold,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 26,
  });
}

function drawKpiCard({
  page,
  fonts,
  x,
  y,
  width,
  label,
  value,
}: {
  page: PDFPage;
  fonts: FontSet;
  x: number;
  y: number;
  width: number;
  label: string;
  value: string;
}) {
  page.drawRectangle({
    x,
    y,
    width,
    height: 82,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  page.drawRectangle({
    x,
    y: y + 78,
    width,
    height: 4,
    color: COLORS.orange,
  });

  drawText(page, label, {
    x: x + 16,
    y: y + 52,
    size: 10,
    font: fonts.bold,
    color: COLORS.muted,
  });

  drawText(page, value, {
    x: x + 16,
    y: y + 20,
    size: 24,
    font: fonts.bold,
    color: COLORS.text,
  });
}

function drawTableHeader({
  page,
  fonts,
  y,
}: {
  page: PDFPage;
  fonts: FontSet;
  y: number;
}) {
  page.drawRectangle({
    x: MARGIN_X,
    y: y - HEADER_ROW_HEIGHT,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: HEADER_ROW_HEIGHT,
    color: COLORS.dark,
  });

  const headers = [
    {
      label: SAL_PDF.TESTI.LAVORAZIONE,
      x: MARGIN_X + 12,
      width: 210,
    },
    {
      label: SAL_PDF.TESTI.PERCENTUALE,
      x: MARGIN_X + 248,
      width: 82,
    },
    {
      label: SAL_PDF.TESTI.STATO,
      x: MARGIN_X + 340,
      width: 78,
    },
    {
      label: SAL_PDF.TESTI.ORE_UOMO,
      x: MARGIN_X + 440,
      width: 70,
    },
  ];

  headers.forEach((header) => {
    drawWrappedText({
      page,
      text: header.label,
      x: header.x,
      y: y - 14,
      maxWidth: header.width,
      size: 7,
      font: fonts.bold,
      color: COLORS.white,
      maxLines: 2,
      lineHeight: 8,
    });
  });
}

function drawLavorazioneRow({
  page,
  fonts,
  lavorazione,
  y,
}: {
  page: PDFPage;
  fonts: FontSet;
  lavorazione: SalLavorazione;
  y: number;
}) {
  page.drawRectangle({
    x: MARGIN_X,
    y: y - ROW_HEIGHT,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: ROW_HEIGHT,
    color:
      lavorazione.stato === SAL_STATI.COMPLETATA
        ? COLORS.successSoft
        : COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 0.6,
  });

  drawWrappedText({
    page,
    text: lavorazione.nome,
    x: MARGIN_X + 12,
    y: y - 16,
    maxWidth: 214,
    size: 9,
    font: fonts.bold,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 10,
  });

  drawText(
    page,
    `${lavorazione.percentuale_completamento}%`,
    {
      x: MARGIN_X + 248,
      y: y - 24,
      size: 10,
      font: fonts.bold,
      color: COLORS.text,
    }
  );

  const statoColori = getStatoColori(
    lavorazione.stato
  );

  page.drawRectangle({
    x: MARGIN_X + 338,
    y: y - 30,
    width: 82,
    height: 18,
    color: statoColori.background,
  });

  drawText(
    page,
    getStatoLabel(lavorazione.stato),
    {
      x: MARGIN_X + 346,
      y: y - 24,
      size: 8,
      font: fonts.bold,
      color: statoColori.text,
    }
  );

  drawText(
    page,
    formattaOreUomo(
      lavorazione.oreUomoMinuti
    ),
    {
      x: MARGIN_X + 440,
      y: y - 24,
      size: 10,
      font: fonts.bold,
      color: COLORS.text,
    }
  );
}

function drawEmptyTableRow({
  page,
  fonts,
  y,
}: {
  page: PDFPage;
  fonts: FontSet;
  y: number;
}) {
  page.drawRectangle({
    x: MARGIN_X,
    y: y - ROW_HEIGHT,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: ROW_HEIGHT,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 0.6,
  });

  drawText(page, SAL_TESTI.NESSUNA_LAVORAZIONE, {
    x: MARGIN_X + 12,
    y: y - 25,
    size: 9,
    font: fonts.regular,
    color: COLORS.muted,
  });
}

function drawFooter({
  page,
  fonts,
  pageNumber,
  totalPages,
}: {
  page: PDFPage;
  fonts: FontSet;
  pageNumber: number;
  totalPages: number;
}) {
  page.drawLine({
    start: { x: MARGIN_X, y: FOOTER_Y + 18 },
    end: {
      x: PAGE_WIDTH - MARGIN_X,
      y: FOOTER_Y + 18,
    },
    thickness: 0.5,
    color: COLORS.border,
  });

  drawText(
    page,
    `${SAL_PDF.TESTI.PAGINA} ${pageNumber} ${SAL_PDF.TESTI.DI} ${totalPages}`,
    {
      x: PAGE_WIDTH - MARGIN_X - 72,
      y: FOOTER_Y,
      size: 8,
      font: fonts.regular,
      color: COLORS.muted,
    }
  );
}

async function embedLogo(
  pdfDoc: PDFDocument
) {
  const logoBytes = await readFile(
    path.join(process.cwd(), SAL_PDF.LOGO_PATH)
  );
  const logo = await pdfDoc.embedJpg(logoBytes);
  const logoWidth = 92;
  const logoHeight =
    (logo.height / logo.width) * logoWidth;

  return {
    draw: (page: PDFPage) => {
      page.drawImage(logo, {
        x: MARGIN_X,
        y: 746,
        width: logoWidth,
        height: logoHeight,
      });
    },
  };
}

async function generaSalPdf({
  cantiereNome,
  dataGenerazione,
  sal,
}: SalPdfParams) {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(
      StandardFonts.Helvetica
    ),
    bold: await pdfDoc.embedFont(
      StandardFonts.HelveticaBold
    ),
  };
  const logo = await embedLogo(pdfDoc);
  const layout: Layout = {
    marginX: MARGIN_X,
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
  };

  let page = pdfDoc.addPage([
    layout.pageWidth,
    layout.pageHeight,
  ]);

  drawHeader({
    page,
    fonts,
    logo,
    cantiereNome,
    dataGenerazione,
  });

  const cardWidth =
    (layout.pageWidth - layout.marginX * 2 - 18) /
    2;

  drawKpiCard({
    page,
    fonts,
    x: layout.marginX,
    y: 560,
    width: cardWidth,
    label: SAL_PDF.TESTI.AVANZAMENTO_TOTALE,
    value: `${sal.avanzamentoTotale}%`,
  });

  drawKpiCard({
    page,
    fonts,
    x: layout.marginX + cardWidth + 18,
    y: 560,
    width: cardWidth,
    label: SAL_PDF.TESTI.ORE_UOMO_TOTALI,
    value: formattaOreUomo(
      sal.oreUomoTotaliMinuti
    ),
  });

  drawText(page, SAL_PDF.TESTI.LAVORAZIONI, {
    x: layout.marginX,
    y: 532,
    size: 13,
    font: fonts.bold,
    color: COLORS.text,
  });

  let tableY = TABLE_TOP_Y;
  drawTableHeader({
    page,
    fonts,
    y: tableY,
  });
  tableY -= HEADER_ROW_HEIGHT;

  if (sal.lavorazioni.length === 0) {
    drawEmptyTableRow({
      page,
      fonts,
      y: tableY,
    });
  }

  sal.lavorazioni.forEach((lavorazione) => {
    if (tableY - ROW_HEIGHT < TABLE_BOTTOM_Y) {
      page = pdfDoc.addPage([
        layout.pageWidth,
        layout.pageHeight,
      ]);
      tableY = PAGE_HEIGHT - 80;
      drawTableHeader({
        page,
        fonts,
        y: tableY,
      });
      tableY -= HEADER_ROW_HEIGHT;
    }

    drawLavorazioneRow({
      page,
      fonts,
      lavorazione,
      y: tableY,
    });
    tableY -= ROW_HEIGHT;
  });

  const pages = pdfDoc.getPages();

  pages.forEach((pdfPage, index) => {
    drawFooter({
      page: pdfPage,
      fonts,
      pageNumber: index + 1,
      totalPages: pages.length,
    });
  });

  return pdfDoc.save();
}

export async function GET(request: NextRequest) {
  try {
    const cantiereId =
      request.nextUrl.searchParams.get(
        "cantiereId"
      ) || "";

    if (!cantiereId) {
      return Response.json(
        {
          error:
            SAL_PDF.ERRORI.CANTIERE_OBBLIGATORIO,
        },
        { status: 400 }
      );
    }

    const accessTokenDatiSal =
      getAccessTokenDatiSal(request);
    const [cantiere, sal] =
      await withSupabaseAccessToken(
        accessTokenDatiSal,
        () =>
          Promise.all([
            loadCantiereBackoffice(cantiereId),
            loadSalCantiere(cantiereId),
          ])
      );

    if (!cantiere) {
      return Response.json(
        {
          error:
            SAL_PDF.ERRORI.CANTIERE_NON_TROVATO,
        },
        { status: 404 }
      );
    }

    const dataGenerazione = new Date();
    const pdfBytes = await generaSalPdf({
      cantiereNome: cantiere.nome,
      dataGenerazione,
      sal,
    });
    const fileName = getNomeFile(
      cantiere.nome,
      dataGenerazione
    );
    const pdfBuffer = new ArrayBuffer(
      pdfBytes.byteLength
    );
    const pdfView = new Uint8Array(pdfBuffer);

    pdfView.set(pdfBytes);

    return new Response(
      pdfBuffer,
      {
        headers: {
          "Content-Type": SAL_PDF.CONTENT_TYPE,
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: unknown) {
    console.error(error);

    return Response.json(
      {
        error: SAL_PDF.ERRORI.GENERICO,
      },
      { status: 500 }
    );
  }
}
