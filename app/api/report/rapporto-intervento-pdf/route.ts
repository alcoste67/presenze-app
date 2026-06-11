import { readFile } from "node:fs/promises";
import path from "node:path";

import type { NextRequest } from "next/server";
import {
  PDFDocument,
  PDFImage,
  PDFPage,
  PDFFont,
  RGB,
  StandardFonts,
  rgb,
} from "pdf-lib";

import { HTTP_STATUS } from "@/constants/api";
import { estraiBearerToken } from "@/lib/auth";
import {
  LABEL_REGOLE_FATTURAZIONE_INTERVENTO,
  RAPPORTI_INTERVENTO_PDF,
  RAPPORTI_INTERVENTO_TESTI,
} from "@/constants/rapportiIntervento";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isDipendenteAttivoSupabase } from "@/services/dipendenti/isDipendenteAttivoSupabase";
import { loadRapportoIntervento } from "@/services/rapportiIntervento/loadRapportoIntervento";
import { formatMinutiOre } from "@/services/rapportiIntervento/oreMinuti";
import type {
  RapportoInterventoCompleto,
  RapportoInterventoLavorazione,
  RapportoInterventoExtra,
  RapportoInterventoMateriale,
  RapportoInterventoOperatore,
} from "@/types/rapportiIntervento";

export const runtime = "nodejs";

type FontSet = {
  regular: PDFFont;
  bold: PDFFont;
};

type FirmaPdf = {
  image: PDFImage | null;
  nome: string | null;
  firmataAt: string | null;
};

type FotoPdf = {
  image: PDFImage | null;
  descrizione: string;
};

type OpzioniPdf = {
  mostraFatturazione: boolean;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const FOOTER_Y = 28;
const TABLE_BOTTOM_Y = 220;
const ROW_HEIGHT = 36;
const HEADER_ROW_HEIGHT = 28;

const COLORS = {
  text: rgb(0.141, 0.149, 0.169),
  muted: rgb(0.435, 0.416, 0.38),
  surface: rgb(1, 0.992, 0.976),
  border: rgb(0.91, 0.878, 0.839),
  dark: rgb(0.141, 0.149, 0.169),
  white: rgb(1, 1, 1),
  orange: rgb(0.91, 0.361, 0.094),
  orangeSoft: rgb(0.984, 0.882, 0.824),
} as const;


const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

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

function jsonErrore(
  error: string,
  status: number
) {
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

function formattaData(data: string) {
  return new Intl.DateTimeFormat(
    RAPPORTI_INTERVENTO_PDF.LOCALE
  ).format(new Date(`${data}T00:00:00`));
}

function formattaDataOra(
  data: string | null
) {
  if (!data) {
    return "";
  }

  return new Intl.DateTimeFormat(
    RAPPORTI_INTERVENTO_PDF.LOCALE,
    {
      dateStyle: "short",
      timeStyle: "short",
    }
  ).format(new Date(data));
}

function formattaDataFile(data: string) {
  return data.replaceAll("-", "");
}

function formattaQuantita(
  quantita: number
) {
  return new Intl.NumberFormat(
    RAPPORTI_INTERVENTO_PDF.LOCALE,
    {
      maximumFractionDigits: 2,
    }
  ).format(quantita);
}

function getNomeFile(
  rapporto: RapportoInterventoCompleto
) {
  const cantiereFile =
    rapporto.cantiere_nome_snapshot
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);

  return `${RAPPORTI_INTERVENTO_PDF.FILE_PREFIX}_${cantiereFile || "cantiere"}_${formattaDataFile(rapporto.data_intervento)}.pdf`;
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

function drawInfo({
  page,
  fonts,
  label,
  value,
  x,
  y,
  width,
}: {
  page: PDFPage;
  fonts: FontSet;
  label: string;
  value: string;
  x: number;
  y: number;
  width: number;
}) {
  drawText(page, label, {
    x,
    y,
    size: 8,
    font: fonts.bold,
    color: COLORS.muted,
  });

  drawWrappedText({
    page,
    text: value,
    x,
    y: y - 16,
    maxWidth: width,
    size: 10,
    font: fonts.bold,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 12,
  });
}

async function embedLogo(
  pdfDoc: PDFDocument
) {
  const logoBytes = await readFile(
    path.join(
      process.cwd(),
      RAPPORTI_INTERVENTO_PDF.LOGO_PATH
    )
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

async function embedFirma(
  pdfDoc: PDFDocument,
  dataUrl: string | null
) {
  if (!dataUrl) {
    return null;
  }

  const match =
    /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(
      dataUrl
    );

  if (!match) {
    return null;
  }

  const mime = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], "base64");

  if (mime === "png") {
    return pdfDoc.embedPng(bytes);
  }

  return pdfDoc.embedJpg(bytes);
}

async function embedImmagineDataUrl(
  pdfDoc: PDFDocument,
  dataUrl: string
) {
  const match =
    /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(
      dataUrl
    );

  if (!match) {
    return null;
  }

  const mime = match[1].toLowerCase();
  const bytes = Buffer.from(match[2], "base64");

  if (mime === "png") {
    return pdfDoc.embedPng(bytes);
  }

  return pdfDoc.embedJpg(bytes);
}

function drawHeader({
  page,
  fonts,
  logo,
  rapporto,
}: {
  page: PDFPage;
  fonts: FontSet;
  logo: {
    draw: (page: PDFPage) => void;
  };
  rapporto: RapportoInterventoCompleto;
}) {
  logo.draw(page);

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.TITOLO,
    {
      x: 170,
      y: 776,
      size: 20,
      font: fonts.bold,
      color: COLORS.text,
    }
  );

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.SOTTOTITOLO,
    {
      x: 170,
      y: 754,
      size: 10,
      font: fonts.regular,
      color: COLORS.muted,
    }
  );

  drawText(
    page,
    `${RAPPORTI_INTERVENTO_TESTI.PDF.DATA_INTERVENTO}: ${formattaData(rapporto.data_intervento)}`,
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
}

function drawDettagli({
  page,
  fonts,
  rapporto,
}: {
  page: PDFPage;
  fonts: FontSet;
  rapporto: RapportoInterventoCompleto;
}) {
  const colWidth =
    (PAGE_WIDTH - MARGIN_X * 2 - 18) / 2;

  drawInfo({
    page,
    fonts,
    label:
      RAPPORTI_INTERVENTO_TESTI.PDF.CANTIERE,
    value: rapporto.cantiere_nome_snapshot,
    x: MARGIN_X,
    y: 676,
    width: colWidth,
  });

  drawInfo({
    page,
    fonts,
    label:
      RAPPORTI_INTERVENTO_TESTI.PDF.INDIRIZZO,
    value:
      rapporto.cantiere_indirizzo_snapshot,
    x: MARGIN_X + colWidth + 18,
    y: 676,
    width: colWidth,
  });

  drawInfo({
    page,
    fonts,
    label:
      RAPPORTI_INTERVENTO_TESTI.PDF.CLIENTE_COMMITTENTE,
    value: rapporto.cliente_committente,
    x: MARGIN_X,
    y: 626,
    width: colWidth,
  });

  drawInfo({
    page,
    fonts,
    label:
      RAPPORTI_INTERVENTO_TESTI.PDF.RESPONSABILE,
    value: rapporto.responsabile_nome,
    x: MARGIN_X + colWidth + 18,
    y: 626,
    width: colWidth,
  });
}

function drawKpi({
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
    height: 58,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  page.drawRectangle({
    x,
    y: y + 54,
    width,
    height: 4,
    color: COLORS.orange,
  });

  drawWrappedText({
    page,
    text: label,
    x: x + 10,
    y: y + 38,
    maxWidth: width - 20,
    size: 8,
    font: fonts.bold,
    color: COLORS.muted,
    maxLines: 2,
    lineHeight: 9,
  });

  drawText(page, value, {
    x: x + 10,
    y: y + 12,
    size: 13,
    font: fonts.bold,
    color: COLORS.text,
  });
}

function drawKpis({
  page,
  fonts,
  rapporto,
  mostraFatturazione,
}: {
  page: PDFPage;
  fonts: FontSet;
  rapporto: RapportoInterventoCompleto;
  mostraFatturazione: boolean;
}) {
  const gap = 10;
  const numeroKpi = mostraFatturazione
    ? 4
    : 3;
  const width =
    (PAGE_WIDTH -
      MARGIN_X * 2 -
      gap * (numeroKpi - 1)) /
    numeroKpi;
  const y = 536;

  drawKpi({
    page,
    fonts,
    x: MARGIN_X,
    y,
    width,
    label:
      RAPPORTI_INTERVENTO_TESTI.PDF.ORE_UOMO,
    value: formatMinutiOre(
      rapporto.ore_uomo_reali_minuti
    ),
  });

  drawKpi({
    page,
    fonts,
    x: MARGIN_X + width + gap,
    y,
    width,
    label:
      RAPPORTI_INTERVENTO_TESTI.PDF.VIAGGIO,
    value: formatMinutiOre(
      rapporto.viaggio_minuti
    ),
  });

  drawKpi({
    page,
    fonts,
    x: MARGIN_X + (width + gap) * 2,
    y,
    width,
    label:
      RAPPORTI_INTERVENTO_TESTI.PDF.DIRITTO_USCITA,
    value: rapporto.diritto_uscita
      ? RAPPORTI_INTERVENTO_TESTI.SI
      : RAPPORTI_INTERVENTO_TESTI.NO,
  });

  if (mostraFatturazione) {
    drawKpi({
      page,
      fonts,
      x: MARGIN_X + (width + gap) * 3,
      y,
      width,
      label:
        RAPPORTI_INTERVENTO_TESTI.PDF.ORE_FATTURABILI,
      value: formatMinutiOre(
        rapporto.ore_fatturabili_minuti
      ),
    });

    drawText(
      page,
      LABEL_REGOLE_FATTURAZIONE_INTERVENTO[
        rapporto.regola_fatturazione
      ],
      {
        x: MARGIN_X,
        y: 520,
        size: 9,
        font: fonts.regular,
        color: COLORS.muted,
      }
    );
  }
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

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.LAVORAZIONE,
    {
      x: MARGIN_X + 12,
      y: y - 18,
      size: 8,
      font: fonts.bold,
      color: COLORS.white,
    }
  );

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.ORE_UOMO,
    {
      x: PAGE_WIDTH - MARGIN_X - 98,
      y: y - 18,
      size: 8,
      font: fonts.bold,
      color: COLORS.white,
    }
  );
}

function drawLavorazioneRow({
  page,
  fonts,
  lavorazione,
  y,
}: {
  page: PDFPage;
  fonts: FontSet;
  lavorazione: RapportoInterventoLavorazione;
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

  drawWrappedText({
    page,
    text: lavorazione.descrizione_snapshot,
    x: MARGIN_X + 12,
    y: y - 14,
    maxWidth: 360,
    size: 9,
    font: fonts.bold,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 10,
  });

  drawText(
    page,
    formatMinutiOre(lavorazione.ore_uomo_minuti),
    {
      x: PAGE_WIDTH - MARGIN_X - 98,
      y: y - 22,
      size: 10,
      font: fonts.bold,
      color: COLORS.text,
    }
  );
}

function drawOperatoriHeader({
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

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.OPERATORE,
    {
      x: MARGIN_X + 12,
      y: y - 18,
      size: 8,
      font: fonts.bold,
      color: COLORS.white,
    }
  );

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.ORE_UOMO,
    {
      x: PAGE_WIDTH - MARGIN_X - 98,
      y: y - 18,
      size: 8,
      font: fonts.bold,
      color: COLORS.white,
    }
  );
}

function drawOperatoreRow({
  page,
  fonts,
  operatore,
  y,
}: {
  page: PDFPage;
  fonts: FontSet;
  operatore: RapportoInterventoOperatore;
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

  drawWrappedText({
    page,
    text: operatore.nome_snapshot,
    x: MARGIN_X + 12,
    y: y - 14,
    maxWidth: 360,
    size: 9,
    font: fonts.bold,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 10,
  });

  drawText(
    page,
    formatMinutiOre(operatore.ore_minuti),
    {
      x: PAGE_WIDTH - MARGIN_X - 98,
      y: y - 22,
      size: 10,
      font: fonts.bold,
      color: COLORS.text,
    }
  );
}

function drawTotaleOperatori({
  page,
  fonts,
  totaleMinuti,
  y,
}: {
  page: PDFPage;
  fonts: FontSet;
  totaleMinuti: number;
  y: number;
}) {
  page.drawRectangle({
    x: MARGIN_X,
    y: y - ROW_HEIGHT,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: ROW_HEIGHT,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 0.8,
  });

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.TOTALE_ORE_UOMO,
    {
      x: MARGIN_X + 12,
      y: y - 22,
      size: 10,
      font: fonts.bold,
      color: COLORS.text,
    }
  );

  drawText(
    page,
    formatMinutiOre(totaleMinuti),
    {
      x: PAGE_WIDTH - MARGIN_X - 98,
      y: y - 22,
      size: 10,
      font: fonts.bold,
      color: COLORS.text,
    }
  );
}

function drawMaterialiHeader({
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

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.MATERIALE,
    {
      x: MARGIN_X + 12,
      y: y - 18,
      size: 8,
      font: fonts.bold,
      color: COLORS.white,
    }
  );

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.QUANTITA,
    {
      x: PAGE_WIDTH - MARGIN_X - 126,
      y: y - 18,
      size: 8,
      font: fonts.bold,
      color: COLORS.white,
    }
  );
}

function drawMaterialeRow({
  page,
  fonts,
  materiale,
  y,
}: {
  page: PDFPage;
  fonts: FontSet;
  materiale: RapportoInterventoMateriale;
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

  drawWrappedText({
    page,
    text: materiale.descrizione,
    x: MARGIN_X + 12,
    y: y - 14,
    maxWidth: 340,
    size: 9,
    font: fonts.bold,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 10,
  });

  drawText(
    page,
    `${formattaQuantita(Number(materiale.quantita))} ${materiale.unita_misura}`,
    {
      x: PAGE_WIDTH - MARGIN_X - 126,
      y: y - 22,
      size: 10,
      font: fonts.bold,
      color: COLORS.text,
    }
  );
}

function drawExtraHeader({
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

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.LAVORO_EXTRA,
    {
      x: MARGIN_X + 12,
      y: y - 18,
      size: 8,
      font: fonts.bold,
      color: COLORS.white,
    }
  );

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.ORE_EXTRA,
    {
      x: PAGE_WIDTH - MARGIN_X - 126,
      y: y - 18,
      size: 8,
      font: fonts.bold,
      color: COLORS.white,
    }
  );
}

function drawExtraRow({
  page,
  fonts,
  lavoroExtra,
  y,
}: {
  page: PDFPage;
  fonts: FontSet;
  lavoroExtra: RapportoInterventoExtra;
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

  drawWrappedText({
    page,
    text: lavoroExtra.note
      ? `${lavoroExtra.descrizione} — ${lavoroExtra.note}`
      : lavoroExtra.descrizione,
    x: MARGIN_X + 12,
    y: y - 14,
    maxWidth: 340,
    size: 9,
    font: fonts.bold,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 10,
  });

  drawText(
    page,
    formatMinutiOre(lavoroExtra.ore_minuti),
    {
      x: PAGE_WIDTH - MARGIN_X - 126,
      y: y - 22,
      size: 10,
      font: fonts.bold,
      color: COLORS.text,
    }
  );
}

function drawFotoBox({
  page,
  fonts,
  foto,
  x,
  y,
  width,
  height,
}: {
  page: PDFPage;
  fonts: FontSet;
  foto: FotoPdf;
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  if (foto.image) {
    const imageMaxWidth = width - 18;
    const imageMaxHeight = height - 42;
    const scale = Math.min(
      imageMaxWidth / foto.image.width,
      imageMaxHeight / foto.image.height
    );
    const imageWidth = foto.image.width * scale;
    const imageHeight =
      foto.image.height * scale;

    page.drawImage(foto.image, {
      x: x + (width - imageWidth) / 2,
      y: y + height - imageHeight - 12,
      width: imageWidth,
      height: imageHeight,
    });
  }

  drawWrappedText({
    page,
    text: foto.descrizione,
    x: x + 9,
    y: y + 18,
    maxWidth: width - 18,
    size: 8,
    font: fonts.regular,
    color: COLORS.muted,
    maxLines: 2,
    lineHeight: 9,
  });
}

function drawNote({
  page,
  fonts,
  rapporto,
  y,
}: {
  page: PDFPage;
  fonts: FontSet;
  rapporto: RapportoInterventoCompleto;
  y: number;
}) {
  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.NOTE,
    {
      x: MARGIN_X,
      y,
      size: 10,
      font: fonts.bold,
      color: COLORS.muted,
    }
  );

  page.drawRectangle({
    x: MARGIN_X,
    y: y - 74,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 58,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  drawWrappedText({
    page,
    text: rapporto.note || "",
    x: MARGIN_X + 12,
    y: y - 32,
    maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 24,
    size: 9,
    font: fonts.regular,
    color: COLORS.text,
    maxLines: 4,
    lineHeight: 11,
  });
}

function drawFirmaBox({
  page,
  fonts,
  firma,
  label,
  x,
  y,
  width,
}: {
  page: PDFPage;
  fonts: FontSet;
  firma: FirmaPdf;
  label: string;
  x: number;
  y: number;
  width: number;
}) {
  page.drawRectangle({
    x,
    y,
    width,
    height: 120,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  drawText(page, label, {
    x: x + 12,
    y: y + 96,
    size: 9,
    font: fonts.bold,
    color: COLORS.muted,
  });

  if (firma.image) {
    const maxWidth = width - 24;
    const maxHeight = 54;
    const scale = Math.min(
      maxWidth / firma.image.width,
      maxHeight / firma.image.height
    );
    const imageWidth =
      firma.image.width * scale;
    const imageHeight =
      firma.image.height * scale;

    page.drawImage(firma.image, {
      x: x + 12,
      y: y + 38,
      width: imageWidth,
      height: imageHeight,
    });
  }

  drawText(page, firma.nome || "", {
    x: x + 12,
    y: y + 22,
    size: 9,
    font: fonts.bold,
    color: COLORS.text,
  });

  if (firma.firmataAt) {
    drawText(
      page,
      `${RAPPORTI_INTERVENTO_TESTI.PDF.DATA_FIRMA}: ${formattaDataOra(firma.firmataAt)}`,
      {
        x: x + 12,
        y: y + 9,
        size: 7,
        font: fonts.regular,
        color: COLORS.muted,
      }
    );
  }
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
    `${RAPPORTI_INTERVENTO_TESTI.PDF.PAGINA} ${pageNumber} ${RAPPORTI_INTERVENTO_TESTI.PDF.DI} ${totalPages}`,
    {
      x: PAGE_WIDTH - MARGIN_X - 72,
      y: FOOTER_Y,
      size: 8,
      font: fonts.regular,
      color: COLORS.muted,
    }
  );
}

async function generaRapportoInterventoPdf(
  rapporto: RapportoInterventoCompleto,
  { mostraFatturazione }: OpzioniPdf
) {
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
  const firmaResponsabile = {
    image: await embedFirma(
      pdfDoc,
      rapporto.firma_responsabile_data_url
    ),
    nome: rapporto.firma_responsabile_nome,
    firmataAt:
      rapporto.firma_responsabile_at,
  };
  const firmaCliente = {
    image: await embedFirma(
      pdfDoc,
      rapporto.firma_cliente_data_url
    ),
    nome: rapporto.firma_cliente_nome,
    firmataAt: rapporto.firma_cliente_at,
  };
  const fotoPdf = await Promise.all(
    rapporto.foto.map(async (foto) => ({
      image: await embedImmagineDataUrl(
        pdfDoc,
        foto.immagine_data_url
      ),
      descrizione:
        foto.descrizione ||
        RAPPORTI_INTERVENTO_TESTI.PDF.FOTO_DESCRIZIONE,
    }))
  );

  let page = pdfDoc.addPage([
    PAGE_WIDTH,
    PAGE_HEIGHT,
  ]);

  drawHeader({
    page,
    fonts,
    logo,
    rapporto,
  });
  drawDettagli({
    page,
    fonts,
    rapporto,
  });
  drawKpis({
    page,
    fonts,
    rapporto,
    mostraFatturazione,
  });

  let tableY = 476;
  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.OPERATORI,
    {
      x: MARGIN_X,
      y: 490,
      size: 13,
      font: fonts.bold,
      color: COLORS.text,
    }
  );

  drawOperatoriHeader({
    page,
    fonts,
    y: tableY,
  });
  tableY -= HEADER_ROW_HEIGHT;

  rapporto.operatori.forEach((operatore) => {
    if (tableY - ROW_HEIGHT < TABLE_BOTTOM_Y) {
      page = pdfDoc.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);
      tableY = PAGE_HEIGHT - 80;
      drawOperatoriHeader({
        page,
        fonts,
        y: tableY,
      });
      tableY -= HEADER_ROW_HEIGHT;
    }

    drawOperatoreRow({
      page,
      fonts,
      operatore,
      y: tableY,
    });
    tableY -= ROW_HEIGHT;
  });

  if (tableY - ROW_HEIGHT < TABLE_BOTTOM_Y) {
    page = pdfDoc.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);
    tableY = PAGE_HEIGHT - 80;
  }

  drawTotaleOperatori({
    page,
    fonts,
    totaleMinuti:
      rapporto.ore_uomo_reali_minuti,
    y: tableY,
  });
  tableY -= ROW_HEIGHT;

  if (tableY - 58 < TABLE_BOTTOM_Y) {
    page = pdfDoc.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);
    tableY = PAGE_HEIGHT - 80;
  } else {
    tableY -= 26;
  }

  drawText(
    page,
    RAPPORTI_INTERVENTO_TESTI.PDF.LAVORAZIONI,
    {
      x: MARGIN_X,
      y: tableY,
      size: 13,
      font: fonts.bold,
      color: COLORS.text,
    }
  );

  tableY -= 14;
  drawTableHeader({
    page,
    fonts,
    y: tableY,
  });
  tableY -= HEADER_ROW_HEIGHT;

  rapporto.lavorazioni.forEach(
    (lavorazione) => {
      if (tableY - ROW_HEIGHT < TABLE_BOTTOM_Y) {
        page = pdfDoc.addPage([
          PAGE_WIDTH,
          PAGE_HEIGHT,
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
    }
  );

  if (rapporto.materiali.length > 0) {
    if (tableY - 88 < TABLE_BOTTOM_Y) {
      page = pdfDoc.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);
      tableY = PAGE_HEIGHT - 80;
    } else {
      tableY -= 26;
    }

    drawText(
      page,
      RAPPORTI_INTERVENTO_TESTI.PDF.MATERIALI,
      {
        x: MARGIN_X,
        y: tableY,
        size: 13,
        font: fonts.bold,
        color: COLORS.text,
      }
    );

    tableY -= 14;
    drawMaterialiHeader({
      page,
      fonts,
      y: tableY,
    });
    tableY -= HEADER_ROW_HEIGHT;

    rapporto.materiali.forEach((materiale) => {
      if (tableY - ROW_HEIGHT < TABLE_BOTTOM_Y) {
        page = pdfDoc.addPage([
          PAGE_WIDTH,
          PAGE_HEIGHT,
        ]);
        tableY = PAGE_HEIGHT - 80;
        drawMaterialiHeader({
          page,
          fonts,
          y: tableY,
        });
        tableY -= HEADER_ROW_HEIGHT;
      }

      drawMaterialeRow({
        page,
        fonts,
        materiale,
        y: tableY,
      });
      tableY -= ROW_HEIGHT;
    });
  }

  if (rapporto.extra.length > 0) {
    if (tableY - 88 < TABLE_BOTTOM_Y) {
      page = pdfDoc.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT,
      ]);
      tableY = PAGE_HEIGHT - 80;
    } else {
      tableY -= 26;
    }

    drawText(
      page,
      RAPPORTI_INTERVENTO_TESTI.PDF.LAVORI_EXTRA,
      {
        x: MARGIN_X,
        y: tableY,
        size: 13,
        font: fonts.bold,
        color: COLORS.text,
      }
    );

    tableY -= 14;
    drawExtraHeader({
      page,
      fonts,
      y: tableY,
    });
    tableY -= HEADER_ROW_HEIGHT;

    rapporto.extra.forEach((lavoroExtra) => {
      if (tableY - ROW_HEIGHT < TABLE_BOTTOM_Y) {
        page = pdfDoc.addPage([
          PAGE_WIDTH,
          PAGE_HEIGHT,
        ]);
        tableY = PAGE_HEIGHT - 80;
        drawExtraHeader({
          page,
          fonts,
          y: tableY,
        });
        tableY -= HEADER_ROW_HEIGHT;
      }

      drawExtraRow({
        page,
        fonts,
        lavoroExtra,
        y: tableY,
      });
      tableY -= ROW_HEIGHT;
    });
  }

  if (fotoPdf.length > 0) {
    page = pdfDoc.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);
    drawText(
      page,
      RAPPORTI_INTERVENTO_TESTI.PDF.FOTO,
      {
        x: MARGIN_X,
        y: PAGE_HEIGHT - 80,
        size: 13,
        font: fonts.bold,
        color: COLORS.text,
      }
    );

    const fotoGap = 14;
    const fotoWidth =
      (PAGE_WIDTH - MARGIN_X * 2 - fotoGap) /
      2;
    const fotoHeight = 190;
    let fotoX = MARGIN_X;
    let fotoY = PAGE_HEIGHT - 290;

    fotoPdf.forEach((foto, index) => {
      if (fotoY < 92) {
        page = pdfDoc.addPage([
          PAGE_WIDTH,
          PAGE_HEIGHT,
        ]);
        drawText(
          page,
          RAPPORTI_INTERVENTO_TESTI.PDF.FOTO,
          {
            x: MARGIN_X,
            y: PAGE_HEIGHT - 80,
            size: 13,
            font: fonts.bold,
            color: COLORS.text,
          }
        );
        fotoX = MARGIN_X;
        fotoY = PAGE_HEIGHT - 290;
      }

      drawFotoBox({
        page,
        fonts,
        foto,
        x: fotoX,
        y: fotoY,
        width: fotoWidth,
        height: fotoHeight,
      });

      if (index % 2 === 0) {
        fotoX = MARGIN_X + fotoWidth + fotoGap;
      } else {
        fotoX = MARGIN_X;
        fotoY -= fotoHeight + fotoGap;
      }
    });

    page = pdfDoc.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);
    tableY = PAGE_HEIGHT - 80;
  }

  if (tableY < 360) {
    page = pdfDoc.addPage([
      PAGE_WIDTH,
      PAGE_HEIGHT,
    ]);
    tableY = PAGE_HEIGHT - 80;
  }

  drawNote({
    page,
    fonts,
    rapporto,
    y: tableY - 18,
  });

  const firmaY = tableY - 218;
  const firmaWidth =
    (PAGE_WIDTH - MARGIN_X * 2 - 18) / 2;

  drawFirmaBox({
    page,
    fonts,
    firma: firmaResponsabile,
    label:
      RAPPORTI_INTERVENTO_TESTI.PDF.FIRMA_RESPONSABILE,
    x: MARGIN_X,
    y: firmaY,
    width: firmaWidth,
  });

  drawFirmaBox({
    page,
    fonts,
    firma: firmaCliente,
    label:
      RAPPORTI_INTERVENTO_TESTI.PDF.FIRMA_CLIENTE,
    x: MARGIN_X + firmaWidth + 18,
    y: firmaY,
    width: firmaWidth,
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
  const rapportoInterventoId =
    request.nextUrl.searchParams.get(
      "rapportoInterventoId"
    ) || "";

  try {
    if (!rapportoInterventoId) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .RAPPORTO_NON_TROVATO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const accessToken =
      estraiBearerToken(request);

    if (!accessToken) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (authError || !user?.email) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .TOKEN_NON_VALIDO,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const utenteAdmin = await isAdmin(
      user.email,
      supabaseAdmin
    );

    const dipendenteAttivo = utenteAdmin
      ? true
      : await isDipendenteAttivoSupabase(
          user.email,
          supabaseAdmin
        );

    if (!utenteAdmin && !dipendenteAttivo) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const rapporto =
      await loadRapportoIntervento(
        rapportoInterventoId,
        supabaseAdmin
      );

    if (!rapporto) {
      return jsonErrore(
        RAPPORTI_INTERVENTO_TESTI.ERRORI
          .RAPPORTO_NON_TROVATO,
        HTTP_STATUS.NOT_FOUND
      );
    }

    const pdfBytes =
      await generaRapportoInterventoPdf(
        rapporto,
        {
          mostraFatturazione: utenteAdmin,
        }
      );
    const fileName = getNomeFile(rapporto);
    const pdfBuffer = new ArrayBuffer(
      pdfBytes.byteLength
    );
    const pdfView = new Uint8Array(pdfBuffer);

    pdfView.set(pdfBytes);

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type":
          RAPPORTI_INTERVENTO_PDF.CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error(
      "Errore generazione PDF rapporto intervento",
      {
        rapportoInterventoId,
        message:
          error instanceof Error
            ? error.message
            : String(error),
        stack:
          error instanceof Error
            ? error.stack
            : undefined,
        error,
      }
    );

    return jsonErrore(
      RAPPORTI_INTERVENTO_TESTI.ERRORI
        .PDF_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
