import type { NextRequest } from "next/server";
import {
  PDFDocument,
  type PDFImage,
  type PDFFont,
  type PDFPage,
  type RGB,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { API_HEADERS } from "@/constants/api";
import {
  SAL_FREEZE_EXPORT,
  SAL_FREEZE_TESTI,
} from "@/constants/salFreeze";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import { loadSalFreezeExportCommittente } from "@/services/salFreeze/loadSalFreezeExportCommittente";
import type { SalFreezeExportCommittente } from "@/types/salFreeze";

export const runtime = "nodejs";

const SAL_FREEZE_PDF = SAL_FREEZE_TESTI.PDF;
const SAL_FREEZE_PDF_EXPORT = SAL_FREEZE_EXPORT.PDF;
const SAL_FREEZE_QUERY = SAL_FREEZE_EXPORT.QUERY;

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const TOP_Y = 792;
const FOOTER_Y = 28;

const COLORS = {
  text: rgb(0.141, 0.149, 0.169),
  muted: rgb(0.435, 0.416, 0.38),
  surface: rgb(1, 0.992, 0.976),
  border: rgb(0.91, 0.878, 0.839),
  white: rgb(1, 1, 1),
  orange: rgb(0.91, 0.361, 0.094),
  orangeSoft: rgb(0.984, 0.882, 0.824),
  success: rgb(0.184, 0.42, 0.247),
  successSoft: rgb(0.929, 0.969, 0.937),
  gray: rgb(0.435, 0.416, 0.38),
  graySoft: rgb(0.969, 0.953, 0.925),
  danger: rgb(0.745, 0.204, 0.204),
  dangerSoft: rgb(0.973, 0.91, 0.91),
} as const;

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

function normalizzaTestoPdf(value: string) {
  return value
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("’", "'")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "");
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

  const periodoFile = `${freeze.period_start}_${freeze.period_end}`;

  return `${SAL_FREEZE_PDF_EXPORT.FILE_PREFIX}_${cantiereFile || "cantiere"}_${periodoFile}.pdf`;
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
  const words = normalizzaTestoPdf(text).split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine
      ? `${currentLine} ${word}`
      : word;

    if (
      font.widthOfTextAtSize(nextLine, size) <= maxWidth
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

function drawCenteredImage({
  page,
  image,
  x,
  y,
  boxWidth,
  boxHeight,
}: {
  page: PDFPage;
  image: PDFImage;
  x: number;
  y: number;
  boxWidth: number;
  boxHeight: number;
}) {
  const scaled = image.scaleToFit(boxWidth, boxHeight);
  const drawX = x + (boxWidth - scaled.width) / 2;
  const drawY = y + (boxHeight - scaled.height) / 2;

  page.drawImage(image, {
    x: drawX,
    y: drawY,
    width: scaled.width,
    height: scaled.height,
  });
}

function drawFooter({
  page,
  pageNumber,
  totalPages,
  fonts,
}: {
  page: PDFPage;
  pageNumber: number;
  totalPages: number;
  fonts: { regular: PDFFont };
}) {
  page.drawLine({
    start: { x: MARGIN_X, y: FOOTER_Y + 10 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: FOOTER_Y + 10 },
    thickness: 1,
    color: COLORS.border,
  });

  drawText(page, `${SAL_FREEZE_PDF.PAGINA} ${pageNumber} ${SAL_FREEZE_PDF.DI} ${totalPages}`, {
    x: PAGE_WIDTH - MARGIN_X - 84,
    y: FOOTER_Y,
    size: 8,
    font: fonts.regular,
    color: COLORS.muted,
  });
}

function drawHeader({
  page,
  fonts,
  cantiereNome,
  freeze,
}: {
  page: PDFPage;
  fonts: { regular: PDFFont; bold: PDFFont };
  cantiereNome: string;
  freeze: SalFreezeExportCommittente["freeze"];
}) {
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 70,
    width: PAGE_WIDTH,
    height: 70,
    color: COLORS.surface,
  });

  drawText(page, SAL_FREEZE_PDF.TITOLO, {
    x: MARGIN_X,
    y: TOP_Y,
    size: 20,
    font: fonts.bold,
    color: COLORS.text,
  });

  drawText(page, SAL_FREEZE_PDF.SOTTOTITOLO, {
    x: MARGIN_X,
    y: TOP_Y - 18,
    size: 10,
    font: fonts.regular,
    color: COLORS.muted,
  });

  drawText(page, `${SAL_FREEZE_PDF.CANTIERE}:`, {
    x: MARGIN_X,
    y: TOP_Y - 48,
    size: 9,
    font: fonts.bold,
    color: COLORS.muted,
  });

  drawWrappedText({
    page,
    text: cantiereNome,
    x: MARGIN_X + 58,
    y: TOP_Y - 48,
    maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 58,
    size: 11,
    font: fonts.bold,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 12,
  });

  drawText(page, `${SAL_FREEZE_PDF.PERIODO}: ${formattaData(freeze.period_start)} - ${formattaData(freeze.period_end)}`, {
    x: MARGIN_X,
    y: 686,
    size: 9,
    font: fonts.regular,
    color: COLORS.muted,
  });

  drawText(page, `${SAL_FREEZE_PDF.DATA_FREEZE}: ${formattaDataOra(freeze.freeze_at)}`, {
    x: MARGIN_X,
    y: 672,
    size: 9,
    font: fonts.regular,
    color: COLORS.muted,
  });

  page.drawLine({
    start: { x: MARGIN_X, y: 660 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 660 },
    thickness: 2,
    color: COLORS.orange,
  });
}

function drawInfoBox({
  page,
  fonts,
  x,
  y,
  width,
  label,
  value,
}: {
  page: PDFPage;
  fonts: { regular: PDFFont; bold: PDFFont };
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
    height: 56,
    color: COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  drawText(page, label, {
    x: x + 10,
    y: y + 35,
    size: 8,
    font: fonts.bold,
    color: COLORS.muted,
  });

  drawWrappedText({
    page,
    text: value,
    x: x + 10,
    y: y + 22,
    maxWidth: width - 20,
    size: 10,
    font: fonts.bold,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 11,
  });
}

function getDeltaColor(delta: number) {
  if (delta > 0) {
    return {
      background: COLORS.successSoft,
      text: COLORS.success,
    };
  }

  if (delta < 0) {
    return {
      background: COLORS.dangerSoft,
      text: COLORS.danger,
    };
  }

  return {
    background: COLORS.graySoft,
    text: COLORS.gray,
  };
}

function formattaDelta(delta: number) {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(0)}%`;
}

function drawCenteredText({
  page,
  text,
  x,
  y,
  width,
  size,
  font,
  color,
}: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
  font: PDFFont;
  color: RGB;
}) {
  const normalizedText = normalizzaTestoPdf(text);
  const textWidth = font.widthOfTextAtSize(
    normalizedText,
    size
  );
  const textX = x + Math.max(0, (width - textWidth) / 2);

  drawText(page, normalizedText, {
    x: textX,
    y,
    size,
    font,
    color,
  });
}

async function embedImageFromUrl(
  pdfDoc: PDFDocument,
  url: string
): Promise<PDFImage | null> {
  try {
    const dataUrlMatch =
      /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(
        url
      );

    if (dataUrlMatch) {
      const [, mime, encoded] = dataUrlMatch;
      const bytes = Buffer.from(encoded, "base64");

      if (mime.toLowerCase() === "png") {
        return pdfDoc.embedPng(bytes);
      }

      if (mime.toLowerCase() === "webp") {
        return null;
      }

      return pdfDoc.embedJpg(bytes);
    }

    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const contentType =
      response.headers.get("content-type") || "";
    const bytes = Buffer.from(
      await response.arrayBuffer()
    );

    if (contentType.includes("png")) {
      return pdfDoc.embedPng(bytes);
    }

    if (
      contentType.includes("jpeg") ||
      contentType.includes("jpg")
    ) {
      return pdfDoc.embedJpg(bytes);
    }

    return null;
  } catch {
    return null;
  }
}

function getQueryValue(
  request: NextRequest,
  key: string
) {
  const value = request.nextUrl.searchParams.get(key);
  const trimmed = value?.trim();

  return trimmed || null;
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
  const cantiereNomeQuery =
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

    const cantiereNome =
      cantiereNomeQuery || freezeExport.freeze.cantiere_id;

    const pdfDoc = await PDFDocument.create();
    const fonts = {
      regular: await pdfDoc.embedFont(
        StandardFonts.Helvetica
      ),
      bold: await pdfDoc.embedFont(
        StandardFonts.HelveticaBold
      ),
    };

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    drawHeader({
      page,
      fonts,
      cantiereNome,
      freeze: freezeExport.freeze,
    });

    drawInfoBox({
      page,
      fonts,
      x: MARGIN_X,
      y: 590,
      width: 150,
      label: SAL_FREEZE_PDF.CANTIERE,
      value: cantiereNome,
    });

    drawInfoBox({
      page,
      fonts,
      x: MARGIN_X + 164,
      y: 590,
      width: 138,
      label: SAL_FREEZE_PDF.PERIODO,
      value: `${formattaData(freezeExport.freeze.period_start)} - ${formattaData(freezeExport.freeze.period_end)}`,
    });

    drawInfoBox({
      page,
      fonts,
      x: MARGIN_X + 316,
      y: 590,
      width: 113,
      label: SAL_FREEZE_PDF.DATA_FREEZE,
      value: formattaDataOra(freezeExport.freeze.freeze_at),
    });

    drawInfoBox({
      page,
      fonts,
      x: MARGIN_X + 443,
      y: 590,
      width: 110,
      label: SAL_FREEZE_PDF.FOTO_SELEZIONATE,
      value: String(freezeExport.foto.length),
    });

    drawText(page, SAL_FREEZE_PDF.LAVORAZIONI, {
      x: MARGIN_X,
      y: 556,
      size: 12,
      font: fonts.bold,
      color: COLORS.text,
    });

    page.drawRectangle({
      x: MARGIN_X,
      y: 528,
      width: PAGE_WIDTH - MARGIN_X * 2,
      height: 22,
      color: COLORS.orangeSoft,
    });

    const headers = [
      { label: SAL_FREEZE_PDF.LAVORAZIONE, width: 240 },
      { label: SAL_FREEZE_PDF.PERCENTUALE_PRECEDENTE, width: 90 },
      { label: SAL_FREEZE_PDF.PERCENTUALE_ATTUALE, width: 90 },
      { label: SAL_FREEZE_PDF.DELTA_PERIODO, width: 90 },
    ];
    let cursorX = MARGIN_X + 8;

    headers.forEach((header) => {
      drawText(page, header.label, {
        x: cursorX,
        y: 535,
        size: 8,
        font: fonts.bold,
        color: COLORS.muted,
      });
      cursorX += header.width;
    });

    let cursorY = 512;
    const rowHeight = 30;

    freezeExport.lavorazioni.forEach(
      (lavorazione, index) => {
      if (cursorY < 110) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        drawHeader({
          page,
          fonts,
          cantiereNome,
          freeze: freezeExport.freeze,
        });
        page.drawRectangle({
          x: MARGIN_X,
          y: 528,
          width: PAGE_WIDTH - MARGIN_X * 2,
          height: 22,
          color: COLORS.orangeSoft,
        });

        cursorX = MARGIN_X + 8;
        headers.forEach((header) => {
          drawText(page, header.label, {
            x: cursorX,
            y: 535,
            size: 8,
            font: fonts.bold,
            color: COLORS.muted,
          });
          cursorX += header.width;
        });

        cursorY = 512;
      }

      page.drawRectangle({
        x: MARGIN_X,
        y: cursorY - rowHeight + 4,
        width: PAGE_WIDTH - MARGIN_X * 2,
        height: rowHeight,
        color:
          index % 2 === 0
            ? COLORS.white
            : COLORS.surface,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });

      drawWrappedText({
        page,
        text: lavorazione.lavorazione_nome_snapshot,
        x: MARGIN_X + 8,
        y: cursorY - 10,
        maxWidth: 228,
        size: 9,
        font: fonts.bold,
        color: COLORS.text,
        maxLines: 2,
        lineHeight: 10,
      });

      drawText(page, `${lavorazione.percentuale_precedente}%`, {
        x: MARGIN_X + 248,
        y: cursorY - 10,
        size: 9,
        font: fonts.regular,
        color: COLORS.text,
      });

      drawText(page, `${lavorazione.percentuale_attuale}%`, {
        x: MARGIN_X + 338,
        y: cursorY - 10,
        size: 9,
        font: fonts.regular,
        color: COLORS.text,
      });

      const deltaColor = getDeltaColor(
        lavorazione.delta_percentuale
      );
      page.drawRectangle({
        x: MARGIN_X + 428,
        y: cursorY - 16,
        width: 70,
        height: 18,
        color: deltaColor.background,
      });
      drawText(page, formattaDelta(lavorazione.delta_percentuale), {
        x: MARGIN_X + 439,
        y: cursorY - 10,
        size: 9,
        font: fonts.bold,
        color: deltaColor.text,
      });

      cursorY -= rowHeight;
    });

    const foto = freezeExport.foto.slice(
      0,
      SAL_FREEZE_EXPORT.PDF.MAX_FOTO
    );
    if (foto.length > 0) {
      const fotoPage = pdfDoc.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);
      drawHeader({
        page: fotoPage,
        fonts,
        cantiereNome,
        freeze: freezeExport.freeze,
      });

      drawText(fotoPage, SAL_FREEZE_PDF.FOTO_SELEZIONATE, {
        x: MARGIN_X,
        y: 556,
        size: 12,
        font: fonts.bold,
        color: COLORS.text,
      });

      drawText(fotoPage, SAL_FREEZE_PDF.MASSIMO_FOTO, {
        x: MARGIN_X,
        y: 542,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted,
      });

      const photoWidth = 240;
      const photoHeight = 160;
      const captionHeight = 26;
      const gapX = 14;
      const gapY = 14;
      const startX = MARGIN_X;
      const startY = 500;

      const embeddedPhotos = await Promise.all(
        foto.map(async (item) => {
          if (!item.preview_url) {
            return null;
          }

          return embedImageFromUrl(
            pdfDoc,
            item.preview_url
          );
        })
      );

      embeddedPhotos.forEach((image, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const x = startX + col * (photoWidth + gapX);
        const topY =
          startY - row * (photoHeight + captionHeight + gapY);
        const imageBottomY = topY - photoHeight;
        const captionText =
          `${formattaData(foto[index].data_riferimento)}${foto[index].descrizione?.trim() ? ` • ${foto[index].descrizione.trim()}` : ""}`;

        fotoPage.drawRectangle({
          x,
          y: imageBottomY - captionHeight,
          width: photoWidth,
          height: photoHeight + captionHeight,
          color: COLORS.white,
          borderColor: COLORS.border,
          borderWidth: 1,
        });

        if (image) {
          drawCenteredImage({
            page: fotoPage,
            image,
            x: x + 1,
            y: imageBottomY + 1,
            boxWidth: photoWidth - 2,
            boxHeight: photoHeight - 2,
          });
        } else {
          fotoPage.drawRectangle({
            x: x + 1,
            y: imageBottomY + 1,
            width: photoWidth - 2,
            height: photoHeight - 2,
            color: COLORS.graySoft,
          });

          drawCenteredText({
            page: fotoPage,
            text: SAL_FREEZE_PDF.FOTO_NON_DISPONIBILE,
            x: x + 1,
            y: imageBottomY + Math.floor(photoHeight / 2) - 4,
            width: photoWidth - 2,
            size: 9,
            font: fonts.bold,
            color: COLORS.gray,
          });
        }

        drawWrappedText({
          page: fotoPage,
          text: captionText,
          x: x + 8,
          y: imageBottomY - 14,
          maxWidth: photoWidth - 16,
          size: 7,
          font: fonts.bold,
          color: COLORS.text,
          maxLines: 1,
          lineHeight: 8,
        });
      });

    }

    const allPages = pdfDoc.getPages();
    allPages.forEach((currentPage, index) => {
      drawFooter({
        page: currentPage,
        pageNumber: index + 1,
        totalPages: allPages.length,
        fonts,
      });
    });

    const pdfBytes = await pdfDoc.save();

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": SAL_FREEZE_PDF_EXPORT.MIME_TYPE,
        "Content-Disposition": `attachment; filename="${getNomeFile({ cantiereNome, freeze: freezeExport.freeze })}"`,
        ...NO_STORE_HEADERS,
      },
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : SAL_FREEZE_TESTI.ERRORI.GENERICO;

    console.error("[sal-period-pdf-export-error]", {
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
