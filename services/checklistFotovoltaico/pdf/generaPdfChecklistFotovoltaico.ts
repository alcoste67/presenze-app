// Generatore PDF della checklist fotovoltaico: documento "da zero" (non
// replica un modulo cartaceo esistente, a differenza della checklist
// wallbox Edison). Il PDF inviato e' archiviato e' la copia legale:
// generato una volta, mai rigenerato (stesso principio di
// generaPdfChecklistWallboxA2C.ts, di cui riusa la struttura).
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, PDFFont, PDFImage, PDFPage, RGB, StandardFonts, rgb } from "pdf-lib";

import {
  CHECKLIST_FOTOVOLTAICO_PDF,
  CHECKLIST_FOTOVOLTAICO_TESTI,
  LABEL_STATI_CHECKLIST_FOTOVOLTAICO,
} from "@/constants/checklistFotovoltaico";
import type { ChecklistFotovoltaico } from "@/types/checklistFotovoltaico";

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
  green: rgb(0.106, 0.612, 0.325),
} as const;

// Accento di default (brand Cantivo): usato quando l'azienda non ha
// personalizzato il colore primario in aziende.colori.
const ACCENTO_DEFAULT = rgb(0.914, 0.337, 0.141); // #e95624

type FontSet = {
  regular: PDFFont;
  bold: PDFFont;
};

// Dati di marchio dell'azienda che genera il documento (non Cantivo
// stesso): nome mostrato in intestazione, logo e colore d'accento se
// personalizzati, altrimenti i default Cantivo.
export type AziendaBranding = {
  nome: string;
  logoUrl: string | null;
  colorePrimario: string | null;
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

function drawText(
  page: PDFPage,
  text: string,
  options: { x: number; y: number; size: number; font: PDFFont; color: RGB }
) {
  if (!text) return;
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
  const words = normalizzaTestoPdf(text).split(/\s+/).filter(Boolean);
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

function formattaData(data: string | null) {
  if (!data) return "";
  return new Intl.DateTimeFormat(CHECKLIST_FOTOVOLTAICO_PDF.LOCALE).format(
    new Date(`${data}T00:00:00`)
  );
}

function formattaDataOra(data: string | null) {
  if (!data) return "";
  return new Intl.DateTimeFormat(CHECKLIST_FOTOVOLTAICO_PDF.LOCALE, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(data));
}

function formattaNumero(value: number | null, suffisso = "") {
  if (value === null || value === undefined) return "—";
  return `${new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 }).format(value)}${suffisso}`;
}

function slugPercorso(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function getNomeFileChecklistFotovoltaico(checklist: ChecklistFotovoltaico) {
  const cliente =
    `${checklist.nome} ${checklist.cognome}`.trim() || checklist.ragione_sociale.trim() || "cliente";
  const comune = checklist.comune.trim() || "citta";

  return `${slugPercorso(comune)}-${slugPercorso(cliente)}-fotovoltaico.pdf`;
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

/** Logo dell'azienda che genera il documento, se personalizzato (storage
 * pubblico); altrimenti il logo Cantivo di default. */
async function embedLogoAzienda(pdfDoc: PDFDocument, azienda: AziendaBranding) {
  if (azienda.logoUrl) {
    try {
      const risposta = await fetch(azienda.logoUrl);
      if (risposta.ok) {
        const contentType = risposta.headers.get("content-type") || "";
        const bytes = Buffer.from(await risposta.arrayBuffer());
        const logo = contentType.includes("png") ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
        const logoWidth = 32;
        const logoHeight = (logo.height / logo.width) * logoWidth;

        return {
          draw: (page: PDFPage) => {
            page.drawImage(logo, { x: MARGIN_X, y: 795, width: logoWidth, height: logoHeight });
          },
        };
      }
    } catch (errore) {
      console.error("Errore caricamento logo azienda per PDF fotovoltaico", errore);
    }
  }

  return embedLogoCantivo(pdfDoc);
}

async function embedImmagineDataUrl(pdfDoc: PDFDocument, dataUrl: string | null): Promise<PDFImage | null> {
  if (!dataUrl) return null;
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  return match[1].toLowerCase() === "png" ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes);
}

function disegnaImmagineContenuta(page: PDFPage, image: PDFImage, box: { x: number; y: number; w: number; h: number }) {
  const scale = Math.min(box.w / image.width, box.h / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: box.x + (box.w - width) / 2,
    y: box.y + (box.h - height) / 2,
    width,
    height,
  });
}

// ── Stato mutabile: pagina corrente + cursore verticale, con page-break
//    automatico quando il contenuto non entra più ──────────────────────

type Stato = {
  pdfDoc: PDFDocument;
  fonts: FontSet;
  logo: { draw: (page: PDFPage) => void };
  accento: RGB;
  aziendaNome: string;
  page: PDFPage;
  y: number;
  numeroPagina: number;
};

function nuovaPagina(stato: Stato) {
  stato.page = stato.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  stato.numeroPagina += 1;
  stato.logo.draw(stato.page);
  drawText(stato.page, CHECKLIST_FOTOVOLTAICO_TESTI.PDF.TITOLO, {
    x: MARGIN_X + 40,
    y: 806,
    size: 13,
    font: stato.fonts.bold,
    color: COLORS.text,
  });
  drawText(stato.page, stato.aziendaNome, {
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
  stato.page.drawRectangle({
    x: MARGIN_X,
    y: stato.y - 16,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 20,
    color: COLORS.surface,
  });
  stato.page.drawRectangle({
    x: MARGIN_X,
    y: stato.y - 16,
    width: 3,
    height: 20,
    color: stato.accento,
  });
  drawText(stato.page, titolo.toUpperCase(), {
    x: MARGIN_X + 6,
    y: stato.y - 10,
    size: 10,
    font: stato.fonts.bold,
    color: COLORS.text,
  });
  stato.y -= 28;
}

// Due colonne etichetta/valore per riga, come una tabella leggera.
function disegnaCampi(stato: Stato, campi: { label: string; valore: string }[]) {
  const colWidth = (PAGE_WIDTH - MARGIN_X * 2) / 2;

  for (let i = 0; i < campi.length; i += 2) {
    garantisciSpazio(stato, 16);
    const coppia = [campi[i], campi[i + 1]];
    coppia.forEach((campo, indice) => {
      if (!campo) return;
      const x = MARGIN_X + indice * colWidth;
      drawText(stato.page, `${campo.label}:`, {
        x,
        y: stato.y,
        size: 8.5,
        font: stato.fonts.bold,
        color: COLORS.muted,
      });
      drawText(stato.page, campo.valore || "—", {
        x: x + 130,
        y: stato.y,
        size: 9,
        font: stato.fonts.regular,
        color: COLORS.text,
      });
    });
    stato.y -= 16;
  }
  stato.y -= 6;
}

function disegnaDomandaSiNo(stato: Stato, domanda: string, risposta: boolean | null) {
  garantisciSpazio(stato, 15);
  drawText(stato.page, domanda, {
    x: MARGIN_X,
    y: stato.y,
    size: 9,
    font: stato.fonts.regular,
    color: COLORS.text,
  });
  const valore =
    risposta === null
      ? "—"
      : risposta
        ? CHECKLIST_FOTOVOLTAICO_TESTI.SI
        : CHECKLIST_FOTOVOLTAICO_TESTI.NO;
  drawText(stato.page, valore, {
    x: PAGE_WIDTH - MARGIN_X - 30,
    y: stato.y,
    size: 9,
    font: stato.fonts.bold,
    color: risposta === false ? rgb(0.75, 0.2, 0.2) : COLORS.text,
  });
  stato.y -= 15;
}

function disegnaParagrafo(stato: Stato, testo: string) {
  if (!testo.trim()) return;
  const righe = wrapText({ text: testo, font: stato.fonts.regular, size: 9, maxWidth: PAGE_WIDTH - MARGIN_X * 2 });
  righe.forEach((riga) => {
    garantisciSpazio(stato, 13);
    drawText(stato.page, riga, { x: MARGIN_X, y: stato.y, size: 9, font: stato.fonts.regular, color: COLORS.text });
    stato.y -= 13;
  });
  stato.y -= 4;
}

function disegnaTabellaMateriali(stato: Stato, materiali: { descrizione: string; quantita: string }[]) {
  if (materiali.length === 0) {
    disegnaParagrafo(stato, "Nessun materiale previsto.");
    return;
  }

  const colDescrizioneWidth = PAGE_WIDTH - MARGIN_X * 2 - 90;

  garantisciSpazio(stato, 16);
  drawText(stato.page, CHECKLIST_FOTOVOLTAICO_TESTI.DESCRIZIONE_PLACEHOLDER, {
    x: MARGIN_X,
    y: stato.y,
    size: 8.5,
    font: stato.fonts.bold,
    color: COLORS.muted,
  });
  drawText(stato.page, CHECKLIST_FOTOVOLTAICO_TESTI.QUANTITA, {
    x: MARGIN_X + colDescrizioneWidth + 10,
    y: stato.y,
    size: 8.5,
    font: stato.fonts.bold,
    color: COLORS.muted,
  });
  stato.y -= 14;

  materiali.forEach((materiale) => {
    if (!materiale.descrizione.trim()) return;
    garantisciSpazio(stato, 14);
    drawText(stato.page, materiale.descrizione, {
      x: MARGIN_X,
      y: stato.y,
      size: 9,
      font: stato.fonts.regular,
      color: COLORS.text,
    });
    drawText(stato.page, materiale.quantita || "—", {
      x: MARGIN_X + colDescrizioneWidth + 10,
      y: stato.y,
      size: 9,
      font: stato.fonts.regular,
      color: COLORS.text,
    });
    stato.y -= 14;
  });
  stato.y -= 6;
}

// Callout evidenziato con bordo/colore d'accento per i risultati del
// dimensionamento: sono il punto più importante del documento per il
// cliente, meritano più risalto di un campo etichetta/valore qualsiasi.
function disegnaRisultatiDimensionamento(stato: Stato, checklist: ChecklistFotovoltaico) {
  if (checklist.potenza_consigliata_kwp === null) {
    disegnaParagrafo(stato, CHECKLIST_FOTOVOLTAICO_TESTI.RISULTATI_NON_DISPONIBILI);
    return;
  }

  const righe: [string, string][] = [
    [CHECKLIST_FOTOVOLTAICO_TESTI.FABBISOGNO_TOTALE, formattaNumero(checklist.fabbisogno_totale_kwh, " kWh")],
    [CHECKLIST_FOTOVOLTAICO_TESTI.POTENZA_CONSIGLIATA, formattaNumero(checklist.potenza_consigliata_kwp, " kWp")],
    [CHECKLIST_FOTOVOLTAICO_TESTI.POTENZA_MASSIMA, formattaNumero(checklist.potenza_massima_kwp, " kWp")],
    [
      CHECKLIST_FOTOVOLTAICO_TESTI.NUMERO_MODULI_MAX,
      checklist.numero_moduli_max === null ? "—" : String(checklist.numero_moduli_max),
    ],
    [CHECKLIST_FOTOVOLTAICO_TESTI.BATTERIA_CONSIGLIATA, formattaNumero(checklist.batteria_consigliata_kwh, " kWh")],
  ];

  const altezzaRiga = 20;
  const boxHeight = righe.length * altezzaRiga + 14;
  garantisciSpazio(stato, boxHeight + 10);

  const yTop = stato.y;
  stato.page.drawRectangle({
    x: MARGIN_X,
    y: yTop - boxHeight,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: boxHeight,
    borderColor: stato.accento,
    borderWidth: 1.2,
    color: COLORS.surface,
  });
  stato.page.drawRectangle({
    x: MARGIN_X,
    y: yTop - boxHeight,
    width: 4,
    height: boxHeight,
    color: stato.accento,
  });

  let rigaY = yTop - 17;
  righe.forEach(([label, valore]) => {
    drawText(stato.page, label, { x: MARGIN_X + 14, y: rigaY, size: 9, font: stato.fonts.regular, color: COLORS.muted });
    const larghezzaValore = stato.fonts.bold.widthOfTextAtSize(valore, 11);
    drawText(stato.page, valore, {
      x: PAGE_WIDTH - MARGIN_X - 14 - larghezzaValore,
      y: rigaY,
      size: 11,
      font: stato.fonts.bold,
      color: COLORS.text,
    });
    rigaY -= altezzaRiga;
  });

  stato.y = yTop - boxHeight - 10;
}

async function disegnaFirme(stato: Stato, checklist: ChecklistFotovoltaico) {
  garantisciSpazio(stato, 110);
  const colWidth = (PAGE_WIDTH - MARGIN_X * 2 - 20) / 2;
  const boxHeight = 70;
  const yBox = stato.y - boxHeight;

  const immagineTecnico = await embedImmagineDataUrl(stato.pdfDoc, checklist.firma_tecnico_data_url);
  const immagineCliente = await embedImmagineDataUrl(stato.pdfDoc, checklist.firma_cliente_data_url);

  [
    { x: MARGIN_X, immagine: immagineTecnico, nome: checklist.firma_tecnico_nome, at: checklist.firma_tecnico_at, label: CHECKLIST_FOTOVOLTAICO_TESTI.FIRMA_TECNICO },
    { x: MARGIN_X + colWidth + 20, immagine: immagineCliente, nome: checklist.firma_cliente_nome, at: checklist.firma_cliente_at, label: CHECKLIST_FOTOVOLTAICO_TESTI.FIRMA_CLIENTE },
  ].forEach(({ x, immagine, nome, at, label }) => {
    stato.page.drawRectangle({
      x,
      y: yBox,
      width: colWidth,
      height: boxHeight,
      borderColor: COLORS.border,
      borderWidth: 1,
      color: COLORS.white,
    });
    if (immagine) {
      disegnaImmagineContenuta(stato.page, immagine, { x: x + 4, y: yBox + 18, w: colWidth - 8, h: boxHeight - 22 });
    }
    drawText(stato.page, `${label}: ${nome || "—"}`, {
      x: x + 4,
      y: yBox - 12,
      size: 8,
      font: stato.fonts.regular,
      color: COLORS.muted,
    });
    if (at) {
      drawText(stato.page, `${CHECKLIST_FOTOVOLTAICO_TESTI.PDF.DATA_FIRMA}: ${formattaDataOra(at)}`, {
        x: x + 4,
        y: yBox - 24,
        size: 8,
        font: stato.fonts.regular,
        color: COLORS.muted,
      });
    }
  });

  stato.y = yBox - 34;
}

function disegnaPiePagina(pdfDoc: PDFDocument, fonts: FontSet, checklist: ChecklistFotovoltaico) {
  const pagine = pdfDoc.getPages();
  pagine.forEach((page, indice) => {
    drawText(page, `${CHECKLIST_FOTOVOLTAICO_TESTI.PDF.PAGINA} ${indice + 1} ${CHECKLIST_FOTOVOLTAICO_TESTI.PDF.DI} ${pagine.length} — ${LABEL_STATI_CHECKLIST_FOTOVOLTAICO[checklist.stato]}`, {
      x: MARGIN_X,
      y: 32,
      size: 7.5,
      font: fonts.regular,
      color: COLORS.muted,
    });
  });
}

export async function generaPdfChecklistFotovoltaico(
  checklist: ChecklistFotovoltaico,
  azienda: AziendaBranding
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fonts: FontSet = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
  const logo = await embedLogoAzienda(pdfDoc, azienda);

  const stato: Stato = {
    pdfDoc,
    fonts,
    logo,
    accento: hexToRgb(azienda.colorePrimario) ?? ACCENTO_DEFAULT,
    aziendaNome: azienda.nome,
    page: pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: MARGIN_TOP,
    numeroPagina: 0,
  };
  nuovaPagina(stato);

  const nomeCliente = `${checklist.nome} ${checklist.cognome}`.trim();

  // ── Dati cliente/immobile ──
  disegnaTitoloSezione(stato, CHECKLIST_FOTOVOLTAICO_TESTI.SEZIONE_DATI_CLIENTE);
  disegnaCampi(stato, [
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.NOME + "/" + CHECKLIST_FOTOVOLTAICO_TESTI.COGNOME, valore: nomeCliente },
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.RAGIONE_SOCIALE, valore: checklist.ragione_sociale },
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.PIVA, valore: checklist.piva },
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.TELEFONO, valore: checklist.telefono },
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.EMAIL_CLIENTE, valore: checklist.email_cliente },
    {
      label: CHECKLIST_FOTOVOLTAICO_TESTI.VIA,
      valore: `${checklist.via}, ${checklist.cap} ${checklist.comune} (${checklist.provincia})`,
    },
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.LUOGO, valore: checklist.luogo },
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.DATA_SOPRALLUOGO, valore: formattaData(checklist.data_sopralluogo) },
  ]);

  // ── Falda e copertura ──
  disegnaTitoloSezione(stato, CHECKLIST_FOTOVOLTAICO_TESTI.SEZIONE_FALDA);
  disegnaCampi(stato, [
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.TIPO_COPERTURA, valore: checklist.tipo_copertura },
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.ORIENTAMENTO_FALDA, valore: checklist.orientamento_falda },
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.INCLINAZIONE_FALDA, valore: formattaNumero(checklist.inclinazione_falda_gradi, "°") },
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.SUPERFICIE_FALDA, valore: formattaNumero(checklist.superficie_falda_mq, " mq") },
  ]);
  disegnaDomandaSiNo(stato, CHECKLIST_FOTOVOLTAICO_TESTI.OMBREGGIAMENTI_PRESENTI, checklist.ombreggiamenti_presenti);
  if (checklist.note_ombreggiamenti.trim()) {
    disegnaParagrafo(stato, checklist.note_ombreggiamenti);
  }

  // ── Verifiche tecniche ──
  disegnaTitoloSezione(stato, CHECKLIST_FOTOVOLTAICO_TESTI.SEZIONE_VERIFICHE);
  disegnaCampi(stato, [
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.POTENZA_CONTATORE, valore: checklist.potenza_contatore_kw },
  ]);
  disegnaDomandaSiNo(stato, CHECKLIST_FOTOVOLTAICO_TESTI.QUADRO_CONFORME, checklist.quadro_conforme);
  disegnaDomandaSiNo(stato, CHECKLIST_FOTOVOLTAICO_TESTI.IMPIANTO_A_NORMA, checklist.impianto_a_norma);
  disegnaDomandaSiNo(stato, CHECKLIST_FOTOVOLTAICO_TESTI.DICHIARAZIONE_CONFORMITA, checklist.dichiarazione_conformita);
  disegnaDomandaSiNo(stato, CHECKLIST_FOTOVOLTAICO_TESTI.AUTORIZZAZIONI_NECESSARIE, checklist.autorizzazioni_necessarie);
  disegnaDomandaSiNo(stato, CHECKLIST_FOTOVOLTAICO_TESTI.MESSA_A_TERRA, checklist.messa_a_terra);
  disegnaDomandaSiNo(stato, CHECKLIST_FOTOVOLTAICO_TESTI.STRUTTURA_IDONEA, checklist.struttura_idonea);
  disegnaDomandaSiNo(stato, CHECKLIST_FOTOVOLTAICO_TESTI.OPERE_ADEGUAMENTO_NECESSARIE, checklist.opere_adeguamento_necessarie);

  // ── Dimensionamento ──
  disegnaTitoloSezione(stato, CHECKLIST_FOTOVOLTAICO_TESTI.SEZIONE_DIMENSIONAMENTO);
  disegnaCampi(stato, [
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.CONSUMO_F1, valore: formattaNumero(checklist.consumo_f1_kwh, " kWh") },
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.CONSUMO_F2, valore: formattaNumero(checklist.consumo_f2_kwh, " kWh") },
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.CONSUMO_F3, valore: formattaNumero(checklist.consumo_f3_kwh, " kWh") },
  ]);
  const sviluppiFuturi: string[] = [];
  if (checklist.pompa_calore_attiva) sviluppiFuturi.push(CHECKLIST_FOTOVOLTAICO_TESTI.POMPA_CALORE);
  if (checklist.auto_elettrica_attiva) sviluppiFuturi.push(CHECKLIST_FOTOVOLTAICO_TESTI.AUTO_ELETTRICA);
  if (checklist.induzione_attiva) sviluppiFuturi.push(CHECKLIST_FOTOVOLTAICO_TESTI.INDUZIONE);
  if (checklist.altro_attivo) sviluppiFuturi.push(checklist.altro_descrizione || CHECKLIST_FOTOVOLTAICO_TESTI.ALTRO);
  disegnaCampi(stato, [
    { label: CHECKLIST_FOTOVOLTAICO_TESTI.SVILUPPI_FUTURI_TITOLO, valore: sviluppiFuturi.join(", ") || "—" },
  ]);

  disegnaTitoloSezione(stato, CHECKLIST_FOTOVOLTAICO_TESTI.RISULTATI_TITOLO);
  disegnaRisultatiDimensionamento(stato, checklist);

  // ── Materiali ──
  disegnaTitoloSezione(stato, CHECKLIST_FOTOVOLTAICO_TESTI.MATERIALI_TITOLO);
  disegnaTabellaMateriali(stato, checklist.materiali);

  // ── Planimetria ──
  if (checklist.planimetria_data_url) {
    disegnaTitoloSezione(stato, CHECKLIST_FOTOVOLTAICO_TESTI.PLANIMETRIA_TITOLO);
    const immaginePlanimetria = await embedImmagineDataUrl(stato.pdfDoc, checklist.planimetria_data_url);
    if (immaginePlanimetria) {
      const boxHeight = 160;
      garantisciSpazio(stato, boxHeight + 10);
      const box = { x: MARGIN_X, y: stato.y - boxHeight, w: PAGE_WIDTH - MARGIN_X * 2, h: boxHeight };
      stato.page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.w,
        height: box.h,
        borderColor: COLORS.border,
        borderWidth: 1,
        color: COLORS.white,
      });
      disegnaImmagineContenuta(stato.page, immaginePlanimetria, {
        x: box.x + 4,
        y: box.y + 4,
        w: box.w - 8,
        h: box.h - 8,
      });
      stato.y = box.y - 10;
    }
  }

  // ── Note ──
  if (checklist.note.trim()) {
    disegnaTitoloSezione(stato, CHECKLIST_FOTOVOLTAICO_TESTI.NOTE);
    disegnaParagrafo(stato, checklist.note);
  }

  // ── Firme ──
  disegnaTitoloSezione(stato, "Firme");
  await disegnaFirme(stato, checklist);

  disegnaPiePagina(pdfDoc, fonts, checklist);

  return pdfDoc.save();
}
