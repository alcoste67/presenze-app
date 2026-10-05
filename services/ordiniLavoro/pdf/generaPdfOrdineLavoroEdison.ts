// Genera il PDF nel formato ESATTO del modulo cartaceo "ORDINE DI
// LAVORO" Edison Energia: carica il file originale come template e ci
// scrive sopra solo i dati compilati, nei punti esatti dei campi
// vuoti. Il layout, il logo e i colori restano quelli del documento
// originale — non vanno mai ridisegnati o alterati. Stessa tecnica di
// generaPdfChecklistWallboxEdison.ts, coordinate estratte dal PDF
// originale (testo e rettangoli), non misurate a occhio.
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";

import type { OrdineLavoroEdison, VoceElencoOrdineLavoro } from "@/types/ordiniLavoro";

const TEMPLATE_PATH = "assets/pdf-templates/ordine-lavoro-edison.pdf";
const BLACK = rgb(0, 0, 0);

function normalizzaTestoPdf(value: string) {
  return value
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replaceAll("’", "'")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "");
}

function scriviCampo(
  page: PDFPage,
  font: PDFFont,
  value: string,
  { x, y, size = 9 }: { x: number; y: number; size?: number }
) {
  if (!value) return;
  page.drawText(normalizzaTestoPdf(value), { x, y, size, font, color: BLACK });
}

function segnaCheckbox(page: PDFPage, checked: boolean, box: { x: number; y: number; w: number; h: number }) {
  if (!checked) return;
  page.drawRectangle({
    x: box.x + 1.3,
    y: box.y + 1.3,
    width: box.w - 2.6,
    height: box.h - 2.6,
    color: BLACK,
  });
}

async function embedImmagineDataUrl(pdfDoc: PDFDocument, dataUrl: string | null) {
  if (!dataUrl) return null;
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  return match[1].toLowerCase() === "png" ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes);
}

function disegnaImmagineContenuta(
  page: PDFPage,
  image: PDFImage,
  box: { x: number; y: number; w: number; h: number }
) {
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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
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
  return lines;
}

function disegnaTestoMultilinea(
  page: PDFPage,
  font: PDFFont,
  text: string,
  { x, baselines, maxWidth, size = 8 }: { x: number; baselines: number[]; maxWidth: number; size?: number }
) {
  if (!text) return;
  const righe = wrapText(text, font, size, maxWidth);
  righe.slice(0, baselines.length).forEach((riga, index) => {
    page.drawText(riga, { x, y: baselines[index], size, font, color: BLACK });
  });
}

function formattaEuro(importo: string) {
  const valore = normalizzaTestoPdf(importo).trim();
  if (!valore) return "";
  return /€/.test(valore) ? valore : `${valore} €`;
}

function sommaImporti(voci: VoceElencoOrdineLavoro[]) {
  const totale = voci.reduce((somma, voce) => {
    const numero = Number(voce.importo.replace(",", ".").replace(/[^0-9.-]/g, ""));
    return somma + (Number.isFinite(numero) ? numero : 0);
  }, 0);
  return totale > 0 ? totale.toFixed(2).replace(".", ",") : "";
}

// ──────────────────────────────────────────────────────────────────
// Coordinate rilevate dal PDF originale "ORDINE DI LAVORO" (595.276 x
// 841.89, estrazione testo/rettangoli, coordinate PDF standard:
// origine in basso a sinistra).
// ──────────────────────────────────────────────────────────────────

const CAMPI = {
  interventoNumero: { x: 123, y: 698.56, size: 9 },
  data: { x: 324, y: 700.14, size: 9 },
  oraDalle: { x: 441, y: 700.14, size: 9 },
  oraAlle: { x: 507, y: 700.14, size: 9 },

  tecnicoSocieta: { x: 138, y: 652.83, size: 9 },
  tecnicoNome: { x: 182, y: 637.83, size: 9 },

  clienteNomeCognome: { x: 101, y: 600.83, size: 9 },
  clienteIndirizzo: { x: 66, y: 587.33, size: 9 },
  clienteCivico: { x: 248, y: 587.33, size: 9 },
  clienteComune: { x: 304, y: 587.33, size: 9 },
  clienteCap: { x: 493, y: 587.33, size: 9 },
  clienteProvincia: { x: 547, y: 587.33, size: 9 },
  clienteTelefono: { x: 69, y: 573.83, size: 9 },
  clienteEmail: { x: 273, y: 573.83, size: 9 },

  oreManodoperaExtra: { x: 426, y: 509.75, size: 8 },
  prescrizioneMotivo: { x: 224, y: 216.32, size: 8 },

  luogoData: { x: 34, y: 30.52, size: 9 },
} as const;

const CHECKBOX_TIPOLOGIA = {
  tipologia_24_7: { x: 50.154, y: 542.721, w: 7.754, h: 7.754 },
  tipologia_caldaia: { x: 50.154, y: 518.721, w: 7.754, h: 7.754 },
  tipologia_scaldabagno: { x: 50.154, y: 504.721, w: 7.754, h: 7.754 },
  tipologia_climatizzatore: { x: 50.154, y: 490.721, w: 7.754, h: 7.754 },
  tipologia_elettrodomestico: { x: 50.154, y: 476.721, w: 7.754, h: 7.754 },
  tipologia_varie: { x: 50.154, y: 462.721, w: 7.754, h: 7.754 },
} as const;

const CHECKBOX_DETTAGLIO = {
  dettaglio_manodopera_compresa: { x: 316.186, y: 544.721, w: 7.754, h: 7.754 },
  dettaglio_manodopera_a_pagamento: { x: 316.186, y: 531.721, w: 7.754, h: 7.754 },
  oreManodoperaExtra: { x: 316.186, y: 509.121, w: 7.754, h: 7.754 },
  dettaglio_pezzi_ricambio: { x: 316.186, y: 496.121, w: 7.754, h: 7.754 },
  dettaglio_preventivo: { x: 316.186, y: 483.121, w: 7.754, h: 7.754 },
  dettaglio_riparazione: { x: 316.186, y: 470.121, w: 7.754, h: 7.754 },
  dettaglio_manutenzione: { x: 316.186, y: 457.121, w: 7.754, h: 7.754 },
} as const;

const DETTAGLIO_IMPIANTI_AREA = { x: 35, baselines: [426.22], maxWidth: 430 };
const DETTAGLIO_INTERVENTO_AREA = { x: 35, baselines: [397.42, 382.82], maxWidth: 525 };
const OSSERVAZIONI_AREA = { x: 35, baselines: [188.72], maxWidth: 430 };

// Tabella "Elenco interventi eseguiti/componenti acquistati" (4 righe + totale).
const ELENCO_RIGHE_Y = [314.57, 300.57, 286.57, 272.57];
const ELENCO_TOTALE_Y = 258.57;
const ELENCO_DESCRIZIONE_X = 40;
const ELENCO_IMPORTO_X = 445;
const ELENCO_MAX_WIDTH = 390;

const CHECKBOX_PRESCRIZIONE_SI = { x: 40.485, y: 213.694, w: 7.754, h: 7.754 };
const CHECKBOX_PRESCRIZIONE_NO = { x: 82.952, y: 213.694, w: 7.754, h: 7.754 };

const CHECKBOX_PAGAMENTO_BOLLETTA = { x: 43.32, y: 71.894, w: 7.754, h: 7.754 };
const CHECKBOX_PAGAMENTO_CARTA = { x: 182.653, y: 71.894, w: 7.754, h: 7.754 };

// Spazio tra l'etichetta "Firma del Cliente/tecnico" (y=48.52) e la
// riga vuota (y=28.52): firma disegnata in questo spazio stretto, senza
// nome stampato sotto (non c'è spazio sul modulo).
const FIRMA_CLIENTE = { x: 214, y: 31, w: 140, h: 16 };
const FIRMA_TECNICO = { x: 430, y: 31, w: 85, h: 16 };

export function getNomeFileOrdineLavoroEdison(ordine: OrdineLavoroEdison) {
  const cliente = ordine.cliente_nome_cognome.trim() || "cliente";
  const comune = ordine.cliente_comune.trim() || "citta";
  const slug = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  return `${slug(comune)}-${slug(cliente)}-ordine-lavoro.pdf`;
}

export async function generaPdfOrdineLavoroEdison(
  ordine: OrdineLavoroEdison
): Promise<Uint8Array> {
  const templateBytes = await readFile(path.join(process.cwd(), TEMPLATE_PATH));
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const [pagina] = pdfDoc.getPages();

  scriviCampo(pagina, font, ordine.intervento_numero, CAMPI.interventoNumero);
  scriviCampo(
    pagina,
    font,
    ordine.data ? formattaData(ordine.data) : "",
    CAMPI.data
  );
  scriviCampo(pagina, font, ordine.ora_dalle, CAMPI.oraDalle);
  scriviCampo(pagina, font, ordine.ora_alle, CAMPI.oraAlle);

  scriviCampo(pagina, font, ordine.tecnico_societa, CAMPI.tecnicoSocieta);
  scriviCampo(pagina, font, ordine.tecnico_nome, CAMPI.tecnicoNome);

  scriviCampo(pagina, font, ordine.cliente_nome_cognome, CAMPI.clienteNomeCognome);
  scriviCampo(pagina, font, ordine.cliente_indirizzo, CAMPI.clienteIndirizzo);
  scriviCampo(pagina, font, ordine.cliente_civico, CAMPI.clienteCivico);
  scriviCampo(pagina, font, ordine.cliente_comune, CAMPI.clienteComune);
  scriviCampo(pagina, font, ordine.cliente_cap, CAMPI.clienteCap);
  scriviCampo(pagina, font, ordine.cliente_provincia, CAMPI.clienteProvincia);
  scriviCampo(pagina, font, ordine.cliente_telefono, CAMPI.clienteTelefono);
  scriviCampo(pagina, font, ordine.cliente_email, CAMPI.clienteEmail);

  segnaCheckbox(pagina, ordine.tipologia_24_7, CHECKBOX_TIPOLOGIA.tipologia_24_7);
  segnaCheckbox(pagina, ordine.tipologia_caldaia, CHECKBOX_TIPOLOGIA.tipologia_caldaia);
  segnaCheckbox(pagina, ordine.tipologia_scaldabagno, CHECKBOX_TIPOLOGIA.tipologia_scaldabagno);
  segnaCheckbox(pagina, ordine.tipologia_climatizzatore, CHECKBOX_TIPOLOGIA.tipologia_climatizzatore);
  segnaCheckbox(pagina, ordine.tipologia_elettrodomestico, CHECKBOX_TIPOLOGIA.tipologia_elettrodomestico);
  segnaCheckbox(pagina, ordine.tipologia_varie, CHECKBOX_TIPOLOGIA.tipologia_varie);

  segnaCheckbox(pagina, ordine.dettaglio_manodopera_compresa, CHECKBOX_DETTAGLIO.dettaglio_manodopera_compresa);
  segnaCheckbox(pagina, ordine.dettaglio_manodopera_a_pagamento, CHECKBOX_DETTAGLIO.dettaglio_manodopera_a_pagamento);
  segnaCheckbox(pagina, Boolean(ordine.dettaglio_ore_manodopera_extra), CHECKBOX_DETTAGLIO.oreManodoperaExtra);
  segnaCheckbox(pagina, ordine.dettaglio_pezzi_ricambio, CHECKBOX_DETTAGLIO.dettaglio_pezzi_ricambio);
  segnaCheckbox(pagina, ordine.dettaglio_preventivo, CHECKBOX_DETTAGLIO.dettaglio_preventivo);
  segnaCheckbox(pagina, ordine.dettaglio_riparazione, CHECKBOX_DETTAGLIO.dettaglio_riparazione);
  segnaCheckbox(pagina, ordine.dettaglio_manutenzione, CHECKBOX_DETTAGLIO.dettaglio_manutenzione);
  scriviCampo(pagina, font, ordine.dettaglio_ore_manodopera_extra, CAMPI.oreManodoperaExtra);

  disegnaTestoMultilinea(pagina, font, ordine.dettaglio_impianti, DETTAGLIO_IMPIANTI_AREA);
  disegnaTestoMultilinea(pagina, font, ordine.dettaglio_intervento_eseguito, DETTAGLIO_INTERVENTO_AREA);

  ordine.elenco_interventi.slice(0, ELENCO_RIGHE_Y.length).forEach((voce, index) => {
    const y = ELENCO_RIGHE_Y[index];
    if (voce.descrizione) {
      disegnaTestoMultilinea(pagina, font, voce.descrizione, {
        x: ELENCO_DESCRIZIONE_X,
        maxWidth: ELENCO_MAX_WIDTH,
        baselines: [y],
      });
    }
    if (voce.importo) {
      pagina.drawText(normalizzaTestoPdf(formattaEuro(voce.importo)), {
        x: ELENCO_IMPORTO_X,
        y,
        size: 8,
        font,
        color: BLACK,
      });
    }
  });

  const totale = sommaImporti(ordine.elenco_interventi);
  if (totale) {
    pagina.drawText(normalizzaTestoPdf(`${totale} €`), {
      x: ELENCO_IMPORTO_X,
      y: ELENCO_TOTALE_Y,
      size: 9,
      font,
      color: BLACK,
    });
  }

  if (ordine.prescrizione_sicurezza !== null) {
    segnaCheckbox(pagina, ordine.prescrizione_sicurezza === true, CHECKBOX_PRESCRIZIONE_SI);
    segnaCheckbox(pagina, ordine.prescrizione_sicurezza === false, CHECKBOX_PRESCRIZIONE_NO);
  }
  scriviCampo(pagina, font, ordine.prescrizione_motivo, CAMPI.prescrizioneMotivo);

  disegnaTestoMultilinea(pagina, font, ordine.osservazioni, OSSERVAZIONI_AREA);

  segnaCheckbox(pagina, ordine.modalita_pagamento === "BOLLETTA", CHECKBOX_PAGAMENTO_BOLLETTA);
  segnaCheckbox(pagina, ordine.modalita_pagamento === "CARTA", CHECKBOX_PAGAMENTO_CARTA);

  scriviCampo(
    pagina,
    font,
    [ordine.luogo, ordine.data ? formattaData(ordine.data) : ""].filter(Boolean).join(" - "),
    CAMPI.luogoData
  );

  const firmaCliente = await embedImmagineDataUrl(pdfDoc, ordine.firma_cliente_data_url);
  if (firmaCliente) {
    disegnaImmagineContenuta(pagina, firmaCliente, FIRMA_CLIENTE);
  }

  const firmaTecnico = await embedImmagineDataUrl(pdfDoc, ordine.firma_tecnico_data_url);
  if (firmaTecnico) {
    disegnaImmagineContenuta(pagina, firmaTecnico, FIRMA_TECNICO);
  }

  return pdfDoc.save();
}

function formattaData(data: string) {
  return new Intl.DateTimeFormat("it-IT").format(new Date(`${data}T00:00:00`));
}
