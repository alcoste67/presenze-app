// Generatore PDF del report presenze: pagina orizzontale per stare le
// 8 colonne, tabella paginata automaticamente come sal-pdf.ts.
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PDFDocument,
  PDFFont,
  PDFPage,
  RGB,
  StandardFonts,
  rgb,
} from "pdf-lib";

import {
  REPORT_PRESENZE_COLONNE,
  REPORT_PRESENZE_PDF,
} from "@/constants/reportPresenze";
import type { PresenzeReportRiga } from "@/types/reportPresenze";

type FontSet = {
  regular: PDFFont;
  bold: PDFFont;
};

type FiltriPdf = {
  dataInizio: string;
  dataFine: string;
  dipendenteLabel: string;
  cantiereLabel: string;
};

export type PresenzeReportPdfParams = {
  righe: PresenzeReportRiga[];
  limiteRaggiunto: boolean;
  filtri: FiltriPdf;
  dataGenerazione: Date;
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN_X = 42;
const FOOTER_Y = 22;
const TABLE_TOP_Y = 470;
const TABLE_BOTTOM_Y = 46;
const ROW_HEIGHT = 20;
const HEADER_ROW_HEIGHT = 22;

const COLORS = {
  text: rgb(0.141, 0.149, 0.169),
  muted: rgb(0.435, 0.416, 0.38),
  border: rgb(0.91, 0.878, 0.839),
  dark: rgb(0.141, 0.149, 0.169),
  white: rgb(1, 1, 1),
  orange: rgb(0.91, 0.361, 0.094),
  rowAlt: rgb(0.984, 0.976, 0.965),
} as const;

const COLONNE = [
  { label: REPORT_PRESENZE_COLONNE[0], width: 55 },
  { label: REPORT_PRESENZE_COLONNE[1], width: 38 },
  { label: REPORT_PRESENZE_COLONNE[2], width: 108 },
  { label: REPORT_PRESENZE_COLONNE[3], width: 148 },
  { label: REPORT_PRESENZE_COLONNE[4], width: 58 },
  { label: REPORT_PRESENZE_COLONNE[5], width: 90 },
  { label: REPORT_PRESENZE_COLONNE[6], width: 115 },
  { label: REPORT_PRESENZE_COLONNE[7], width: 146 },
] as const;

function getValoriRiga(riga: PresenzeReportRiga) {
  return [
    riga.data,
    riga.ora,
    riga.dipendente,
    riga.email,
    riga.tipoLabel,
    riga.destinazione,
    riga.cantiere,
    riga.attivita,
  ] as const;
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

function troncaTesto({
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
  const testoNormalizzato = normalizzaTestoPdf(text);

  if (font.widthOfTextAtSize(testoNormalizzato, size) <= maxWidth) {
    return testoNormalizzato;
  }

  const ellissi = "...";
  let troncato = testoNormalizzato;

  while (
    troncato.length > 0 &&
    font.widthOfTextAtSize(troncato + ellissi, size) > maxWidth
  ) {
    troncato = troncato.slice(0, -1);
  }

  return troncato ? `${troncato}${ellissi}` : "";
}

function formattaData(data: string) {
  return new Intl.DateTimeFormat(REPORT_PRESENZE_PDF.LOCALE).format(
    new Date(`${data}T00:00:00`)
  );
}

function formattaDataOraGenerazione(data: Date) {
  return new Intl.DateTimeFormat(REPORT_PRESENZE_PDF.LOCALE, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(data);
}

function formattaDataFile(data: Date) {
  const year = data.getFullYear();
  const month = String(data.getMonth() + 1).padStart(2, "0");
  const day = String(data.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

export function getNomeFilePresenzePdf(dataGenerazione: Date) {
  return `${REPORT_PRESENZE_PDF.FILE_PREFIX}_${formattaDataFile(dataGenerazione)}.pdf`;
}

async function embedLogo(pdfDoc: PDFDocument) {
  const logoBytes = await readFile(
    path.join(process.cwd(), REPORT_PRESENZE_PDF.LOGO_PATH)
  );
  const logo = await pdfDoc.embedJpg(logoBytes);
  const logoWidth = 68;
  const logoHeight = (logo.height / logo.width) * logoWidth;

  return {
    height: logoHeight,
    draw: (page: PDFPage, y: number) => {
      page.drawImage(logo, {
        x: MARGIN_X,
        y: y - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
    },
  };
}

function drawHeader({
  page,
  fonts,
  logo,
  filtri,
  dataGenerazione,
  totaleRighe,
}: {
  page: PDFPage;
  fonts: FontSet;
  logo: {
    height: number;
    draw: (page: PDFPage, y: number) => void;
  };
  filtri: FiltriPdf;
  dataGenerazione: Date;
  totaleRighe: number;
}) {
  const topY = 553;

  logo.draw(page, topY);

  const testoX = MARGIN_X + 82;

  drawText(page, REPORT_PRESENZE_PDF.TESTI.TITOLO, {
    x: testoX,
    y: topY - 14,
    size: 17,
    font: fonts.bold,
    color: COLORS.text,
  });

  drawText(page, REPORT_PRESENZE_PDF.TESTI.SOTTOTITOLO, {
    x: testoX,
    y: topY - 30,
    size: 9,
    font: fonts.regular,
    color: COLORS.muted,
  });

  drawText(
    page,
    `${REPORT_PRESENZE_PDF.TESTI.DATA_GENERAZIONE}: ${formattaDataOraGenerazione(dataGenerazione)}`,
    {
      x: testoX,
      y: topY - 44,
      size: 8,
      font: fonts.regular,
      color: COLORS.muted,
    }
  );

  page.drawLine({
    start: { x: MARGIN_X, y: topY - 58 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: topY - 58 },
    thickness: 1.5,
    color: COLORS.orange,
  });

  const rigaFiltriY = topY - 76;

  drawText(
    page,
    `${REPORT_PRESENZE_PDF.TESTI.PERIODO}: ${formattaData(filtri.dataInizio)} - ${formattaData(filtri.dataFine)}`,
    {
      x: MARGIN_X,
      y: rigaFiltriY,
      size: 9,
      font: fonts.bold,
      color: COLORS.text,
    }
  );

  drawText(
    page,
    `${REPORT_PRESENZE_PDF.TESTI.DIPENDENTE}: ${filtri.dipendenteLabel}`,
    {
      x: MARGIN_X + 220,
      y: rigaFiltriY,
      size: 9,
      font: fonts.regular,
      color: COLORS.text,
    }
  );

  drawText(
    page,
    `${REPORT_PRESENZE_PDF.TESTI.CANTIERE}: ${filtri.cantiereLabel}`,
    {
      x: MARGIN_X + 470,
      y: rigaFiltriY,
      size: 9,
      font: fonts.regular,
      color: COLORS.text,
    }
  );

  drawText(
    page,
    `${REPORT_PRESENZE_PDF.TESTI.RIGHE_TOTALI}: ${totaleRighe}`,
    {
      x: PAGE_WIDTH - MARGIN_X - 70,
      y: rigaFiltriY,
      size: 9,
      font: fonts.regular,
      color: COLORS.text,
    }
  );
}

function getColonnaX(indice: number) {
  let x = MARGIN_X + 8;

  for (let i = 0; i < indice; i += 1) {
    x += COLONNE[i].width;
  }

  return x;
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

  COLONNE.forEach((colonna, indice) => {
    drawText(page, colonna.label, {
      x: getColonnaX(indice),
      y: y - 15,
      size: 8,
      font: fonts.bold,
      color: COLORS.white,
    });
  });
}

function drawRigaTabella({
  page,
  fonts,
  riga,
  y,
  alternata,
}: {
  page: PDFPage;
  fonts: FontSet;
  riga: PresenzeReportRiga;
  y: number;
  alternata: boolean;
}) {
  page.drawRectangle({
    x: MARGIN_X,
    y: y - ROW_HEIGHT,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: ROW_HEIGHT,
    color: alternata ? COLORS.rowAlt : COLORS.white,
    borderColor: COLORS.border,
    borderWidth: 0.5,
  });

  const valori = getValoriRiga(riga);

  valori.forEach((valore, indice) => {
    const colonna = COLONNE[indice];

    drawText(
      page,
      troncaTesto({
        text: valore,
        font: fonts.regular,
        size: 7.5,
        maxWidth: colonna.width - 10,
      }),
      {
        x: getColonnaX(indice),
        y: y - 14,
        size: 7.5,
        font: fonts.regular,
        color: COLORS.text,
      }
    );
  });
}

function drawRigaVuota({
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
    borderWidth: 0.5,
  });

  drawText(page, REPORT_PRESENZE_PDF.TESTI.NESSUN_RISULTATO, {
    x: getColonnaX(0),
    y: y - 14,
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
  limiteRaggiunto,
}: {
  page: PDFPage;
  fonts: FontSet;
  pageNumber: number;
  totalPages: number;
  limiteRaggiunto: boolean;
}) {
  page.drawLine({
    start: { x: MARGIN_X, y: FOOTER_Y + 14 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: FOOTER_Y + 14 },
    thickness: 0.5,
    color: COLORS.border,
  });

  if (limiteRaggiunto) {
    drawText(page, REPORT_PRESENZE_PDF.TESTI.LIMITE_RAGGIUNTO_NOTA, {
      x: MARGIN_X,
      y: FOOTER_Y,
      size: 7.5,
      font: fonts.regular,
      color: COLORS.muted,
    });
  }

  drawText(
    page,
    `${REPORT_PRESENZE_PDF.TESTI.PAGINA} ${pageNumber} ${REPORT_PRESENZE_PDF.TESTI.DI} ${totalPages}`,
    {
      x: PAGE_WIDTH - MARGIN_X - 70,
      y: FOOTER_Y,
      size: 7.5,
      font: fonts.regular,
      color: COLORS.muted,
    }
  );
}

export async function generaPresenzeReportPdf({
  righe,
  limiteRaggiunto,
  filtri,
  dataGenerazione,
}: PresenzeReportPdfParams) {
  const pdfDoc = await PDFDocument.create();
  const fonts: FontSet = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await embedLogo(pdfDoc);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  drawHeader({
    page,
    fonts,
    logo,
    filtri,
    dataGenerazione,
    totaleRighe: righe.length,
  });

  let tableY = TABLE_TOP_Y;

  drawTableHeader({ page, fonts, y: tableY });
  tableY -= HEADER_ROW_HEIGHT;

  if (righe.length === 0) {
    drawRigaVuota({ page, fonts, y: tableY });
    tableY -= ROW_HEIGHT;
  }

  righe.forEach((riga, indice) => {
    if (tableY - ROW_HEIGHT < TABLE_BOTTOM_Y) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      tableY = PAGE_HEIGHT - 50;
      drawTableHeader({ page, fonts, y: tableY });
      tableY -= HEADER_ROW_HEIGHT;
    }

    drawRigaTabella({
      page,
      fonts,
      riga,
      y: tableY,
      alternata: indice % 2 === 1,
    });
    tableY -= ROW_HEIGHT;
  });

  const pages = pdfDoc.getPages();

  pages.forEach((pdfPage, indice) => {
    drawFooter({
      page: pdfPage,
      fonts,
      pageNumber: indice + 1,
      totalPages: pages.length,
      limiteRaggiunto,
    });
  });

  return pdfDoc.save();
}
