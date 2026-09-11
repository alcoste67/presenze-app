// Generatore PDF della checklist wallbox su carta intestata A2C (in
// alternativa alla copia esatta del modulo Edison): condiviso tra il
// download e l'invio email. Il PDF inviato e' archiviato e' la copia
// legale: generato una volta, mai rigenerato (stesso principio di
// generaPdfRapporto.ts, di cui riusa il logo).
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  RGB,
  StandardFonts,
  rgb,
} from "pdf-lib";

import {
  CHECKLIST_WALLBOX_PDF,
  CHECKLIST_WALLBOX_TESTI,
} from "@/constants/checklistWallbox";
import type { ChecklistWallbox } from "@/types/checklistWallbox";

type FontSet = {
  regular: PDFFont;
  bold: PDFFont;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const FOOTER_Y = 28;

const COLORS = {
  text: rgb(0.141, 0.149, 0.169),
  muted: rgb(0.435, 0.416, 0.38),
  surface: rgb(0.965, 0.98, 0.968),
  border: rgb(0.85, 0.87, 0.85),
  white: rgb(1, 1, 1),
  green: rgb(0.106, 0.612, 0.325),
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
  options: { x: number; y: number; size: number; font: PDFFont; color: RGB }
) {
  page.drawText(normalizzaTestoPdf(text), options);
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
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (font.widthOfTextAtSize(nextLine, size) <= maxWidth) {
      currentLine = nextLine;
      return;
    }
    if (currentLine) lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) lines.push(currentLine);
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
  const lines = wrapText({ text, font, size, maxWidth }).slice(0, maxLines);
  lines.forEach((line, index) => {
    drawText(page, line, { x, y: y - index * lineHeight, size, font, color });
  });
  return lines.length;
}

function formattaData(data: string | null) {
  if (!data) return "";
  return new Intl.DateTimeFormat(CHECKLIST_WALLBOX_PDF.LOCALE).format(
    new Date(`${data}T00:00:00`)
  );
}

function formattaDataOra(data: string | null) {
  if (!data) return "";
  return new Intl.DateTimeFormat(CHECKLIST_WALLBOX_PDF.LOCALE, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

function slugPercorso(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Nome file "città-nomecliente": utile sia come allegato email sia come
 * suggerimento quando il tecnico salva il PDF su Files (la cartella con
 * lo stesso nome resta comunque da creare/scegliere a mano su iPhone). */
export function getNomeFileChecklistWallboxA2C(checklist: ChecklistWallbox) {
  const cliente =
    checklist.ragione_sociale.trim() ||
    `${checklist.nome} ${checklist.cognome}`.trim() ||
    "cliente";
  const comune = checklist.comune.trim() || "citta";

  return `${slugPercorso(comune)}-${slugPercorso(cliente)}-a2c.pdf`;
}

async function embedLogoA2C(pdfDoc: PDFDocument) {
  const logoBytes = await readFile(
    path.join(process.cwd(), "public/a2c-logo.png")
  );
  const logo = await pdfDoc.embedJpg(logoBytes);
  const logoWidth = 92;
  const logoHeight = (logo.height / logo.width) * logoWidth;

  return {
    draw: (page: PDFPage) => {
      page.drawImage(logo, { x: MARGIN_X, y: 782, width: logoWidth, height: logoHeight });
    },
  };
}

function drawHeader(
  page: PDFPage,
  fonts: FontSet,
  logo: { draw: (page: PDFPage) => void }
) {
  logo.draw(page);

  drawText(page, CHECKLIST_WALLBOX_TESTI.PDF.TITOLO, {
    x: MARGIN_X + 110,
    y: 796,
    size: 15,
    font: fonts.bold,
    color: COLORS.text,
  });

  page.drawLine({
    start: { x: MARGIN_X, y: 776 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 776 },
    thickness: 2,
    color: COLORS.green,
  });
}

function drawCampo({
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
    text: value || "-",
    x,
    y: y - 14,
    maxWidth: width,
    size: 10,
    font: fonts.regular,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 12,
  });
}

function drawDomanda({
  page,
  fonts,
  domanda,
  risposta,
  y,
}: {
  page: PDFPage;
  fonts: FontSet;
  domanda: string;
  risposta: boolean | null;
  y: number;
}) {
  const righe = drawWrappedText({
    page,
    text: domanda,
    x: MARGIN_X,
    y,
    maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 90,
    size: 9,
    font: fonts.regular,
    color: COLORS.text,
    maxLines: 2,
    lineHeight: 11,
  });

  const risultato =
    risposta === true
      ? CHECKLIST_WALLBOX_TESTI.SI
      : risposta === false
        ? CHECKLIST_WALLBOX_TESTI.NO
        : "-";

  drawText(page, risultato, {
    x: PAGE_WIDTH - MARGIN_X - 40,
    y,
    size: 10,
    font: fonts.bold,
    color: COLORS.text,
  });

  return y - (righe > 1 ? 26 : 20);
}

function drawFirmaBox({
  page,
  fonts,
  label,
  nome,
  firmataAt,
  image,
  x,
  y,
  width,
}: {
  page: PDFPage;
  fonts: FontSet;
  label: string;
  nome: string | null;
  firmataAt: string | null;
  image: PDFImage | null;
  x: number;
  y: number;
  width: number;
}) {
  page.drawRectangle({
    x,
    y,
    width,
    height: 110,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  drawText(page, label, {
    x: x + 12,
    y: y + 88,
    size: 9,
    font: fonts.bold,
    color: COLORS.muted,
  });

  if (image) {
    const maxWidth = width - 24;
    const maxHeight = 50;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
    page.drawImage(image, {
      x: x + 12,
      y: y + 34,
      width: image.width * scale,
      height: image.height * scale,
    });
  }

  drawText(page, nome || "", {
    x: x + 12,
    y: y + 20,
    size: 9,
    font: fonts.bold,
    color: COLORS.text,
  });

  if (firmataAt) {
    drawText(
      page,
      `${CHECKLIST_WALLBOX_TESTI.PDF.DATA_FIRMA}: ${formattaDataOra(firmataAt)}`,
      { x: x + 12, y: y + 8, size: 7, font: fonts.regular, color: COLORS.muted }
    );
  }
}

function drawFooter(page: PDFPage, fonts: FontSet, pagina: number, totale: number) {
  page.drawLine({
    start: { x: MARGIN_X, y: FOOTER_Y + 14 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: FOOTER_Y + 14 },
    thickness: 0.5,
    color: COLORS.border,
  });

  drawText(
    page,
    `${CHECKLIST_WALLBOX_TESTI.PDF.PAGINA} ${pagina} ${CHECKLIST_WALLBOX_TESTI.PDF.DI} ${totale}`,
    {
      x: PAGE_WIDTH - MARGIN_X - 72,
      y: FOOTER_Y,
      size: 8,
      font: fonts.regular,
      color: COLORS.muted,
    }
  );
}

async function embedFirma(pdfDoc: PDFDocument, dataUrl: string | null) {
  if (!dataUrl) return null;
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  return match[1].toLowerCase() === "png"
    ? pdfDoc.embedPng(bytes)
    : pdfDoc.embedJpg(bytes);
}

export async function generaPdfChecklistWallboxA2C(
  checklist: ChecklistWallbox
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts: FontSet = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await embedLogoA2C(pdfDoc);

  const firmaTecnicoImg = await embedFirma(
    pdfDoc,
    checklist.firma_tecnico_data_url
  );
  const firmaClienteImg = await embedFirma(
    pdfDoc,
    checklist.firma_cliente_data_url
  );

  // ── Pagina 1: dati cliente, immobile, verifiche ──
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeader(page, fonts, logo);

  const colWidth = (PAGE_WIDTH - MARGIN_X * 2 - 18) / 2;
  let y = 748;

  drawCampo({
    page,
    fonts,
    label: CHECKLIST_WALLBOX_TESTI.RAGIONE_SOCIALE,
    value: checklist.ragione_sociale,
    x: MARGIN_X,
    y,
    width: colWidth,
  });
  drawCampo({
    page,
    fonts,
    label: CHECKLIST_WALLBOX_TESTI.PIVA,
    value: checklist.piva,
    x: MARGIN_X + colWidth + 18,
    y,
    width: colWidth,
  });

  y -= 40;
  drawCampo({
    page,
    fonts,
    label: `${CHECKLIST_WALLBOX_TESTI.NOME} / ${CHECKLIST_WALLBOX_TESTI.COGNOME}`,
    value: `${checklist.nome} ${checklist.cognome}`.trim(),
    x: MARGIN_X,
    y,
    width: colWidth,
  });
  drawCampo({
    page,
    fonts,
    label: CHECKLIST_WALLBOX_TESTI.TELEFONO,
    value: checklist.telefono,
    x: MARGIN_X + colWidth + 18,
    y,
    width: colWidth,
  });

  y -= 40;
  drawCampo({
    page,
    fonts,
    label: CHECKLIST_WALLBOX_TESTI.VIA,
    value: checklist.via,
    x: MARGIN_X,
    y,
    width: colWidth,
  });
  drawCampo({
    page,
    fonts,
    label: `${CHECKLIST_WALLBOX_TESTI.COMUNE} (${CHECKLIST_WALLBOX_TESTI.PROVINCIA}) ${CHECKLIST_WALLBOX_TESTI.CAP}`,
    value: `${checklist.comune} (${checklist.provincia}) ${checklist.cap}`.trim(),
    x: MARGIN_X + colWidth + 18,
    y,
    width: colWidth,
  });

  y -= 40;
  drawCampo({
    page,
    fonts,
    label: CHECKLIST_WALLBOX_TESTI.POSIZIONAMENTO,
    value: checklist.posizionamento,
    x: MARGIN_X,
    y,
    width: colWidth,
  });
  drawCampo({
    page,
    fonts,
    label: CHECKLIST_WALLBOX_TESTI.MODALITA_POSA,
    value:
      checklist.modalita_posa === "PARETE"
        ? CHECKLIST_WALLBOX_TESTI.MODALITA_POSA_PARETE
        : checklist.modalita_posa === "TERRA"
          ? CHECKLIST_WALLBOX_TESTI.MODALITA_POSA_TERRA
          : "-",
    x: MARGIN_X + colWidth + 18,
    y,
    width: colWidth,
  });

  y -= 40;
  drawCampo({
    page,
    fonts,
    label: CHECKLIST_WALLBOX_TESTI.POTENZA_CONTATORE,
    value: checklist.potenza_contatore_kw,
    x: MARGIN_X,
    y,
    width: colWidth,
  });

  y -= 40;
  page.drawLine({
    start: { x: MARGIN_X, y },
    end: { x: PAGE_WIDTH - MARGIN_X, y },
    thickness: 1,
    color: COLORS.border,
  });
  y -= 20;

  drawText(page, CHECKLIST_WALLBOX_TESTI.DOMANDE_TITOLO, {
    x: MARGIN_X,
    y,
    size: 12,
    font: fonts.bold,
    color: COLORS.text,
  });
  y -= 22;

  const domande: [string, boolean | null][] = [
    [CHECKLIST_WALLBOX_TESTI.QUADRO_CONFORME, checklist.quadro_conforme],
    [CHECKLIST_WALLBOX_TESTI.IMPIANTO_A_NORMA, checklist.impianto_a_norma],
    [
      CHECKLIST_WALLBOX_TESTI.DICHIARAZIONE_CONFORMITA,
      checklist.dichiarazione_conformita,
    ],
    [
      CHECKLIST_WALLBOX_TESTI.AUTORIZZAZIONI_NECESSARIE,
      checklist.autorizzazioni_necessarie,
    ],
    [CHECKLIST_WALLBOX_TESTI.MESSA_A_TERRA, checklist.messa_a_terra],
    [
      CHECKLIST_WALLBOX_TESTI.INSTALLAZIONE_POSSIBILE,
      checklist.installazione_possibile,
    ],
    [
      CHECKLIST_WALLBOX_TESTI.OPERE_ADEGUAMENTO_NECESSARIE,
      checklist.opere_adeguamento_necessarie,
    ],
  ];

  domande.forEach(([domanda, risposta]) => {
    y = drawDomanda({ page, fonts, domanda, risposta, y });
  });

  y -= 10;
  drawText(page, CHECKLIST_WALLBOX_TESTI.NOTE, {
    x: MARGIN_X,
    y,
    size: 10,
    font: fonts.bold,
    color: COLORS.muted,
  });
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
    text: checklist.note || "",
    x: MARGIN_X + 12,
    y: y - 32,
    maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 24,
    size: 9,
    font: fonts.regular,
    color: COLORS.text,
    maxLines: 4,
    lineHeight: 11,
  });

  // ── Pagina 2: materiali + firme ──
  page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let tableY = PAGE_HEIGHT - 70;

  drawText(page, CHECKLIST_WALLBOX_TESTI.MATERIALI_TITOLO, {
    x: MARGIN_X,
    y: tableY,
    size: 12,
    font: fonts.bold,
    color: COLORS.text,
  });
  tableY -= 22;

  page.drawRectangle({
    x: MARGIN_X,
    y: tableY - 20,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 20,
    color: COLORS.green,
  });
  drawText(page, "Materiale", {
    x: MARGIN_X + 10,
    y: tableY - 14,
    size: 8,
    font: fonts.bold,
    color: COLORS.white,
  });
  drawText(page, CHECKLIST_WALLBOX_TESTI.QUANTITA, {
    x: PAGE_WIDTH - MARGIN_X - 90,
    y: tableY - 14,
    size: 8,
    font: fonts.bold,
    color: COLORS.white,
  });
  tableY -= 20;

  const rowHeight = 22;
  const materialiConQuantita = checklist.materiali.filter(
    (m) => m.descrizione.trim() && m.quantita.trim()
  );

  if (materialiConQuantita.length === 0) {
    tableY -= rowHeight;
    drawText(page, "Nessun materiale indicato", {
      x: MARGIN_X + 10,
      y: tableY + 6,
      size: 9,
      font: fonts.regular,
      color: COLORS.muted,
    });
  } else {
    materialiConQuantita.forEach((materiale) => {
      if (tableY - rowHeight < 260) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        tableY = PAGE_HEIGHT - 70;
      }

      page.drawRectangle({
        x: MARGIN_X,
        y: tableY - rowHeight,
        width: PAGE_WIDTH - MARGIN_X * 2,
        height: rowHeight,
        color: COLORS.white,
        borderColor: COLORS.border,
        borderWidth: 0.6,
      });

      drawWrappedText({
        page,
        text: materiale.descrizione,
        x: MARGIN_X + 10,
        y: tableY - 14,
        maxWidth: PAGE_WIDTH - MARGIN_X * 2 - 110,
        size: 9,
        font: fonts.regular,
        color: COLORS.text,
        maxLines: 1,
        lineHeight: 10,
      });

      drawText(page, materiale.quantita, {
        x: PAGE_WIDTH - MARGIN_X - 90,
        y: tableY - 14,
        size: 9,
        font: fonts.bold,
        color: COLORS.text,
      });

      tableY -= rowHeight;
    });
  }

  tableY -= 30;
  if (tableY < 180) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    tableY = PAGE_HEIGHT - 70;
  }

  drawCampo({
    page,
    fonts,
    label: CHECKLIST_WALLBOX_TESTI.LUOGO,
    value: checklist.luogo,
    x: MARGIN_X,
    y: tableY,
    width: colWidth,
  });
  drawCampo({
    page,
    fonts,
    label: CHECKLIST_WALLBOX_TESTI.DATA_SOPRALLUOGO,
    value: formattaData(checklist.data_sopralluogo),
    x: MARGIN_X + colWidth + 18,
    y: tableY,
    width: colWidth,
  });

  const firmaY = tableY - 150;
  const firmaWidth = (PAGE_WIDTH - MARGIN_X * 2 - 18) / 2;

  drawFirmaBox({
    page,
    fonts,
    label: CHECKLIST_WALLBOX_TESTI.FIRMA_TECNICO,
    nome: checklist.firma_tecnico_nome,
    firmataAt: checklist.firma_tecnico_at,
    image: firmaTecnicoImg,
    x: MARGIN_X,
    y: firmaY,
    width: firmaWidth,
  });

  drawFirmaBox({
    page,
    fonts,
    label: CHECKLIST_WALLBOX_TESTI.FIRMA_CLIENTE,
    nome: checklist.firma_cliente_nome,
    firmataAt: checklist.firma_cliente_at,
    image: firmaClienteImg,
    x: MARGIN_X + firmaWidth + 18,
    y: firmaY,
    width: firmaWidth,
  });

  const pages = pdfDoc.getPages();
  pages.forEach((pdfPage, index) => {
    drawFooter(pdfPage, fonts, index + 1, pages.length);
  });

  return pdfDoc.save();
}
