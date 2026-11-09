// Generatore PDF "una pagina per dipendente" di note spese + rimborso km
// del mese, per il consulente del lavoro. Pagina verticale, stesso stile
// delle altre intestazioni con marchio azienda (vedi
// generaPdfChecklistFotovoltaico.ts, di cui riusa il tipo AziendaBranding
// e il pattern logo/colore). Ogni dipendente parte sempre su una pagina
// nuova: se le sue note spese sono tante da non entrare, continua sulla
// pagina successiva (niente due dipendenti sulla stessa pagina, ma un
// dipendente può occupare più pagine).
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, PDFFont, PDFImage, PDFPage, RGB, StandardFonts, rgb } from "pdf-lib";

import { REPORT_NOTE_SPESE_RIMBORSI_PDF } from "@/constants/reportNoteSpeseRimborsi";
import { LABEL_TIPO_SPESA } from "@/constants/noteSpese";
import type { AziendaBranding } from "@/services/checklistFotovoltaico/pdf/generaPdfChecklistFotovoltaico";
import type { DipendenteReportSpeseRimborsi } from "@/types/reportNoteSpeseRimborsi";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 42;
const MARGIN_TOP = 812;
const MARGIN_BOTTOM = 56;

const COLORS = {
  text: rgb(0.141, 0.149, 0.169),
  muted: rgb(0.435, 0.416, 0.38),
  surface: rgb(0.965, 0.98, 0.968),
  border: rgb(0.85, 0.87, 0.85),
  white: rgb(1, 1, 1),
} as const;

const ACCENTO_DEFAULT = rgb(0.914, 0.337, 0.141); // #e95624, brand Cantivo

type FontSet = {
  regular: PDFFont;
  bold: PDFFont;
};

function hexToRgb(hex: string | null): RGB | null {
  if (!hex) return null;
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
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

function drawText(page: PDFPage, text: string, options: { x: number; y: number; size: number; font: PDFFont; color: RGB }) {
  if (!text) return;
  page.drawText(normalizzaTestoPdf(text), options);
}

function formattaData(data: string) {
  return new Intl.DateTimeFormat(REPORT_NOTE_SPESE_RIMBORSI_PDF.LOCALE).format(new Date(`${data}T12:00:00Z`));
}

function formattaImporto(importo: number) {
  return new Intl.NumberFormat(REPORT_NOTE_SPESE_RIMBORSI_PDF.LOCALE, { style: "currency", currency: "EUR" }).format(
    importo
  );
}

function getNomeMese(anno: number, mese: number) {
  return new Intl.DateTimeFormat(REPORT_NOTE_SPESE_RIMBORSI_PDF.LOCALE, { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(anno, mese - 1, 1))
  );
}

async function embedLogoCantivo(pdfDoc: PDFDocument) {
  const logoBytes = await readFile(path.join(process.cwd(), "public/cantivo-logo.png"));
  const logo = await pdfDoc.embedPng(logoBytes);
  const logoWidth = 32;
  const logoHeight = (logo.height / logo.width) * logoWidth;

  return {
    draw: (page: PDFPage) => {
      page.drawImage(logo, { x: MARGIN_X, y: 795, width: logoWidth, height: logoHeight });
    },
  };
}

/** Logo dell'azienda, se personalizzato; altrimenti il logo Cantivo di default. */
async function embedLogoAzienda(pdfDoc: PDFDocument, azienda: AziendaBranding) {
  if (azienda.logoUrl) {
    try {
      const risposta = await fetch(azienda.logoUrl);
      if (risposta.ok) {
        const contentType = risposta.headers.get("content-type") || "";
        const bytes = Buffer.from(await risposta.arrayBuffer());
        const logo: PDFImage = contentType.includes("png")
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
        const logoWidth = 32;
        const logoHeight = (logo.height / logo.width) * logoWidth;

        return {
          draw: (page: PDFPage) => {
            page.drawImage(logo, { x: MARGIN_X, y: 795, width: logoWidth, height: logoHeight });
          },
        };
      }
    } catch (errore) {
      console.error("Errore caricamento logo azienda per PDF note spese/rimborsi", errore);
    }
  }

  return embedLogoCantivo(pdfDoc);
}

type Stato = {
  pdfDoc: PDFDocument;
  fonts: FontSet;
  logo: { draw: (page: PDFPage) => void };
  accento: RGB;
  aziendaNome: string;
  sottotitolo: string;
  // Nome del dipendente la cui sezione è in corso di disegno: se le sue
  // note spese non entrano in una pagina, la continuazione va comunque
  // identificata (altrimenti chi legge la pagina 2 non sa di chi è).
  dipendenteCorrente: string | null;
  page: PDFPage;
  y: number;
};

function nuovaPagina(stato: Stato) {
  stato.page = stato.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  stato.logo.draw(stato.page);
  drawText(stato.page, REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.TITOLO, {
    x: MARGIN_X + 40,
    y: 806,
    size: 13,
    font: stato.fonts.bold,
    color: COLORS.text,
  });
  const sottotitoloTesto = stato.dipendenteCorrente
    ? `${stato.aziendaNome} — ${stato.sottotitolo} — ${stato.dipendenteCorrente}`
    : `${stato.aziendaNome} — ${stato.sottotitolo}`;
  drawText(stato.page, sottotitoloTesto, {
    x: MARGIN_X + 40,
    y: 794,
    size: 9,
    font: stato.fonts.regular,
    color: COLORS.muted,
  });
  stato.page.drawLine({
    start: { x: MARGIN_X, y: 784 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 784 },
    thickness: 1.5,
    color: stato.accento,
  });
  stato.y = MARGIN_TOP - 42;
}

function garantisciSpazio(stato: Stato, altezzaNecessaria: number) {
  if (stato.y - altezzaNecessaria < MARGIN_BOTTOM) {
    nuovaPagina(stato);
  }
}

function disegnaTitoloSezione(stato: Stato, titolo: string) {
  garantisciSpazio(stato, 26);
  stato.y -= 6;
  stato.page.drawRectangle({ x: MARGIN_X, y: stato.y - 16, width: PAGE_WIDTH - MARGIN_X * 2, height: 20, color: COLORS.surface });
  stato.page.drawRectangle({ x: MARGIN_X, y: stato.y - 16, width: 3, height: 20, color: stato.accento });
  drawText(stato.page, titolo.toUpperCase(), { x: MARGIN_X + 6, y: stato.y - 10, size: 10, font: stato.fonts.bold, color: COLORS.text });
  stato.y -= 28;
}

const COLONNE_NOTE_SPESE = [
  { chiave: "data", label: REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.COLONNA_DATA, x: 0, width: 60 },
  { chiave: "tipo", label: REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.COLONNA_TIPO, x: 60, width: 90 },
  { chiave: "importo", label: REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.COLONNA_IMPORTO, x: 150, width: 60 },
  { chiave: "descrizione", label: REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.COLONNA_DESCRIZIONE, x: 210, width: PAGE_WIDTH - MARGIN_X * 2 - 210 },
] as const;

function disegnaSezioneNoteSpese(stato: Stato, dipendente: DipendenteReportSpeseRimborsi) {
  disegnaTitoloSezione(stato, REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.SEZIONE_NOTE_SPESE);

  if (dipendente.noteSpese.length === 0) {
    garantisciSpazio(stato, 14);
    drawText(stato.page, REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.NESSUNA_NOTA_SPESA, {
      x: MARGIN_X,
      y: stato.y,
      size: 9,
      font: stato.fonts.regular,
      color: COLORS.muted,
    });
    stato.y -= 20;
    return;
  }

  garantisciSpazio(stato, 16);
  COLONNE_NOTE_SPESE.forEach((colonna) => {
    drawText(stato.page, colonna.label, { x: MARGIN_X + colonna.x, y: stato.y, size: 8, font: stato.fonts.bold, color: COLORS.muted });
  });
  stato.y -= 14;

  dipendente.noteSpese.forEach((nota) => {
    garantisciSpazio(stato, 14);
    drawText(stato.page, formattaData(nota.data), { x: MARGIN_X + COLONNE_NOTE_SPESE[0].x, y: stato.y, size: 9, font: stato.fonts.regular, color: COLORS.text });
    drawText(stato.page, LABEL_TIPO_SPESA[nota.tipo] || nota.tipo, { x: MARGIN_X + COLONNE_NOTE_SPESE[1].x, y: stato.y, size: 9, font: stato.fonts.regular, color: COLORS.text });
    drawText(stato.page, formattaImporto(nota.importo), { x: MARGIN_X + COLONNE_NOTE_SPESE[2].x, y: stato.y, size: 9, font: stato.fonts.regular, color: COLORS.text });
    drawText(stato.page, nota.descrizione, { x: MARGIN_X + COLONNE_NOTE_SPESE[3].x, y: stato.y, size: 9, font: stato.fonts.regular, color: COLORS.text });
    stato.y -= 14;
  });

  stato.y -= 4;
  garantisciSpazio(stato, 16);
  drawText(stato.page, `${REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.TOTALE_NOTE_SPESE}: ${formattaImporto(dipendente.totaleNoteSpese)}`, {
    x: MARGIN_X,
    y: stato.y,
    size: 9.5,
    font: stato.fonts.bold,
    color: COLORS.text,
  });
  stato.y -= 20;
}

function disegnaSezioneRimborsoKm(stato: Stato, dipendente: DipendenteReportSpeseRimborsi) {
  disegnaTitoloSezione(stato, REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.SEZIONE_RIMBORSO_KM);

  const rimborso = dipendente.rimborsoKm;

  if (!rimborso) {
    garantisciSpazio(stato, 14);
    drawText(stato.page, "—", { x: MARGIN_X, y: stato.y, size: 9, font: stato.fonts.regular, color: COLORS.muted });
    stato.y -= 20;
    return;
  }

  const righe = [
    [REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.VEICOLO, rimborso.veicoloDescrizione || "—"],
    [REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.KM_TOTALI, `${rimborso.kmTotali} km`],
    [
      REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.TARIFFA,
      rimborso.tariffaKmRimborso !== null
        ? `${rimborso.tariffaKmRimborso} €/km`
        : REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.TARIFFA_NON_IMPOSTATA,
    ],
    [
      REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.RIMBORSO,
      rimborso.rimborso !== null ? formattaImporto(rimborso.rimborso) : "—",
    ],
  ] as const;

  righe.forEach(([label, valore]) => {
    garantisciSpazio(stato, 15);
    drawText(stato.page, label, { x: MARGIN_X, y: stato.y, size: 9, font: stato.fonts.regular, color: COLORS.muted });
    drawText(stato.page, valore, { x: MARGIN_X + 140, y: stato.y, size: 9, font: stato.fonts.bold, color: COLORS.text });
    stato.y -= 15;
  });

  stato.y -= 6;
}

function disegnaTotaleDipendente(stato: Stato, dipendente: DipendenteReportSpeseRimborsi) {
  const rimborsoKm = dipendente.rimborsoKm?.rimborso || 0;
  const totale = Math.round((dipendente.totaleNoteSpese + rimborsoKm) * 100) / 100;

  garantisciSpazio(stato, 28);
  stato.y -= 4;
  stato.page.drawRectangle({ x: MARGIN_X, y: stato.y - 20, width: PAGE_WIDTH - MARGIN_X * 2, height: 24, color: COLORS.surface });
  drawText(stato.page, REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.TOTALE_DIPENDENTE, {
    x: MARGIN_X + 8,
    y: stato.y - 13,
    size: 10,
    font: stato.fonts.bold,
    color: COLORS.text,
  });
  const valoreTotale = formattaImporto(totale);
  const larghezzaValore = stato.fonts.bold.widthOfTextAtSize(valoreTotale, 11);
  drawText(stato.page, valoreTotale, {
    x: PAGE_WIDTH - MARGIN_X - 8 - larghezzaValore,
    y: stato.y - 13,
    size: 11,
    font: stato.fonts.bold,
    color: stato.accento,
  });
  stato.y -= 30;
}

function disegnaPiePagina(pdfDoc: PDFDocument, fonts: FontSet) {
  const pagine = pdfDoc.getPages();
  pagine.forEach((page, indice) => {
    drawText(
      page,
      `${REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.PAGINA} ${indice + 1} ${REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.DI} ${pagine.length}`,
      { x: MARGIN_X, y: 32, size: 7.5, font: fonts.regular, color: COLORS.muted }
    );
  });
}

export function getNomeFileReportSpeseRimborsi(anno: number, mese: number) {
  return `${REPORT_NOTE_SPESE_RIMBORSI_PDF.FILE_PREFIX}_${anno}-${String(mese).padStart(2, "0")}.pdf`;
}

export async function generaPdfReportSpeseRimborsi({
  righe,
  anno,
  mese,
  azienda,
}: {
  righe: DipendenteReportSpeseRimborsi[];
  anno: number;
  mese: number;
  azienda: AziendaBranding;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts: FontSet = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await embedLogoAzienda(pdfDoc, azienda);

  const sottotitolo = `${REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.SOTTOTITOLO_PREFIX} ${getNomeMese(anno, mese)}`;

  const stato = {
    pdfDoc,
    fonts,
    logo,
    accento: hexToRgb(azienda.colorePrimario) ?? ACCENTO_DEFAULT,
    aziendaNome: azienda.nome,
    sottotitolo,
    dipendenteCorrente: null,
  } as Stato;

  if (righe.length === 0) {
    nuovaPagina(stato);
    drawText(stato.page, REPORT_NOTE_SPESE_RIMBORSI_PDF.TESTI.NESSUN_DIPENDENTE, {
      x: MARGIN_X,
      y: stato.y,
      size: 10,
      font: fonts.regular,
      color: COLORS.muted,
    });
  }

  righe.forEach((dipendente) => {
    stato.dipendenteCorrente = dipendente.dipendente;
    nuovaPagina(stato);

    drawText(stato.page, dipendente.dipendente, { x: MARGIN_X, y: stato.y, size: 14, font: fonts.bold, color: COLORS.text });
    stato.y -= 26;

    disegnaSezioneNoteSpese(stato, dipendente);
    disegnaSezioneRimborsoKm(stato, dipendente);
    disegnaTotaleDipendente(stato, dipendente);
  });

  disegnaPiePagina(pdfDoc, fonts);

  return pdfDoc.save();
}
