// Genera il PDF nel formato ESATTO del modulo cartaceo Edison Energia
// (V1_2026.03.12): carica il file originale come template e ci scrive
// sopra solo i dati compilati, nei punti esatti dei campi vuoti. Il
// layout, il logo e i colori restano quelli del documento originale —
// non vanno mai ridisegnati o alterati (vincolo esplicito del cliente).
// Le coordinate sono state estratte dal PDF originale (testo e
// rettangoli) con pdfjs-dist, non misurate a occhio.
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb } from "pdf-lib";

import { CHECKLIST_WALLBOX_CATALOGO_MATERIALI } from "@/constants/checklistWallbox";
import type { ChecklistWallbox } from "@/types/checklistWallbox";

const TEMPLATE_PATH = "assets/pdf-templates/checklist-wallbox-edison.pdf";
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
  page.drawText(normalizzaTestoPdf(value), { x, y: y + 2, size, font, color: BLACK });
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

// Cerchia la parola SI o NO corrispondente alla risposta data.
function cerchiaRisposta(
  page: PDFPage,
  risposta: boolean | null,
  si: { x: number; y: number; w: number; h: number },
  no: { x: number; y: number; w: number; h: number }
) {
  if (risposta === null) return;
  const target = risposta ? si : no;
  page.drawEllipse({
    x: target.x + target.w / 2,
    y: target.y + target.h / 2 - 1,
    xScale: target.w / 2 + 4,
    yScale: target.h / 2 + 3,
    borderColor: BLACK,
    borderWidth: 1.3,
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
  { x, baselines, maxWidth, size = 9 }: { x: number; baselines: number[]; maxWidth: number; size?: number }
) {
  if (!text) return;
  const righe = wrapText(text, font, size, maxWidth);
  righe.slice(0, baselines.length).forEach((riga, index) => {
    page.drawText(riga, { x, y: baselines[index], size, font, color: BLACK });
  });
}

// ──────────────────────────────────────────────────────────────────
// Coordinate rilevate dal nuovo PDF originale V1_2026.03.12
// (estrazione testo/rettangoli, coordinate PDF standard: origine in
// basso a sinistra).
// ──────────────────────────────────────────────────────────────────

const CAMPI_PAGINA1 = {
  // "Ragione Sociale Ditta______ Codice Ditta______" (riga intestazione,
  // riferita alla ditta installatrice, non al cliente).
  ditta: { x: 150, y: 709.95, size: 9 },
  codiceDitta: { x: 372, y: 709.95, size: 9 },
  nome: { x: 80, y: 659.2, size: 9 },
  cognome: { x: 384, y: 659.2, size: 9 },
  via: { x: 71, y: 633.95, size: 9 },
  comune: { x: 334, y: 633.95, size: 9 },
  cap: { x: 483, y: 633.95, size: 9 },
  provincia: { x: 74, y: 608.67, size: 9 },
  telefono: { x: 209, y: 608.67, size: 9 },
  posizionamentoAltro: { x: 421, y: 584.67, size: 8 },
  misuraTerraOhm: { x: 285, y: 410.63, size: 9 },
} as const;

const CHECKBOX_POSIZIONAMENTO = {
  BOX_SINGOLO: { x: 161.95, y: 584.37, w: 8.1, h: 7.5 },
  CONDOMINIO: { x: 229.1, y: 584.42, w: 8.1, h: 7.5 },
  PARCHEGGIO_APERTO: { x: 294, y: 585.12, w: 8.1, h: 7.5 },
  ALTRO: { x: 388.85, y: 584.77, w: 8.1, h: 7.5 },
} as const;

const CHECKBOX_PARETE = { x: 130.1, y: 558.99, w: 8.1, h: 7.5 };
const CHECKBOX_TERRA = { x: 199.35, y: 559.94, w: 8.1, h: 7.5 };

const DOMANDE_SI_NO: {
  campo: keyof Pick<
    ChecklistWallbox,
    | "stabile_cpi"
    | "obbligo_progetto_elettrico"
    | "autorizzazioni_necessarie"
    | "messa_a_terra"
    | "installazione_possibile"
  >;
  si: { x: number; y: number; w: number; h: number };
  no: { x: number; y: number; w: number; h: number };
}[] = [
  { campo: "stabile_cpi", si: { x: 476.7, y: 510.4, w: 9.67, h: 10.5 }, no: { x: 501.17, y: 510.4, w: 15.67, h: 10.5 } },
  { campo: "obbligo_progetto_elettrico", si: { x: 476.7, y: 485.4, w: 9.67, h: 10.5 }, no: { x: 501.2, y: 485.4, w: 15.67, h: 10.5 } },
  { campo: "autorizzazioni_necessarie", si: { x: 476.7, y: 460.15, w: 9.67, h: 10.5 }, no: { x: 501.17, y: 460.15, w: 15.67, h: 10.5 } },
  { campo: "messa_a_terra", si: { x: 476.7, y: 435.13, w: 9.92, h: 10.5 }, no: { x: 501.41, y: 435.13, w: 15.67, h: 10.5 } },
  { campo: "installazione_possibile", si: { x: 475.95, y: 386.13, w: 9.67, h: 10.5 }, no: { x: 500.42, y: 386.13, w: 15.67, h: 10.5 } },
];

// Tabella "Descrizione percorso cavi e posizionamento quadro elettrico"
// (8 righe) — i baseline sono i margini superiori di ciascuna riga meno
// un rientro per il testo.
const DESCRIZIONE_CAVI_RIGHE_TOP = [332.85, 310.35, 288.6, 266.83, 245.08, 223.33, 201.3, 179.55];
const DESCRIZIONE_CAVI_AREA = { x: 63, maxWidth: 460, baselines: DESCRIZIONE_CAVI_RIGHE_TOP.map((top) => top - 15) };

// Tabella "Note" (3 righe).
const NOTE_RIGHE_TOP = [131.8, 109.525, 87.525];
const NOTE_AREA = { x: 63, maxWidth: 465, baselines: NOTE_RIGHE_TOP.map((top) => top - 15) };

// Pagina 2: box per il disegno della planimetria sintetica.
const PLANIMETRIA_BOX = { x: 51.35, y: 473.75, w: 504.75, h: 273 };

// Pagina 2: colonna quantità della tabella materiali.
const QUANTITA_X = 478;

// Y di ciascuna riga materiale precompilata in pagina 2, nello stesso
// ordine del catalogo (CHECKLIST_WALLBOX_CATALOGO_MATERIALI, 11 voci).
const RIGHE_MATERIALI_Y = [
  412.38, 397.38, 368.1, 352.6, 337.85, 308.85, 294.1, 279.08, 264.08, 162.8, 148.05,
];

// Righe "(Altro)" a testo libero (descrizione + quantità sulla stessa riga).
const CAVO_ALTRO = { descrizioneX: 222.5, quantitaX: QUANTITA_X, y: 382.38, maxWidth: 236 };
const INTERRUTTORE_ALTRO = { descrizioneX: 251.5, quantitaX: QUANTITA_X, y: 322.85, maxWidth: 206 };

// 3 righe libere della categoria ALTRO (nessuna descrizione precompilata).
const MATERIALI_ALTRO_RIGHE_Y = [248.33, 233.33, 218.58];
const MATERIALI_ALTRO_DESCRIZIONE_X = 142;
const MATERIALI_ALTRO_MAX_WIDTH = 320;

const LUOGO_DATA = { x: 120, y: 93.78, size: 9 };

// "Nome e firma tecnico": riga stampata sul modulo, stretta (~159pt).
const FIRMA_TECNICO = { x: 157, y: 71, maxWidth: 150, maxHeight: 24 };
const FIRMA_TECNICO_NOME = { x: 157, y: 58, size: 7 };

// "Firma cliente" non esiste sul modulo originale: aggiunta minima
// richiesta esplicitamente da Alex, a destra della riga del tecnico,
// senza toccare il resto del layout.
const FIRMA_CLIENTE_LABEL = { x: 330, y: 68.53, size: 10 };
const FIRMA_CLIENTE_LINEA = { xStart: 395, xEnd: 538, y: 66 };
const FIRMA_CLIENTE = { x: 397, y: 69, maxWidth: 140, maxHeight: 24 };
const FIRMA_CLIENTE_NOME = { x: 397, y: 56, size: 7 };

export function getNomeFileChecklistWallboxEdison(checklist: ChecklistWallbox) {
  const cliente = `${checklist.nome} ${checklist.cognome}`.trim() || "cliente";
  const comune = checklist.comune.trim() || "citta";
  const slug = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

  return `${slug(comune)}-${slug(cliente)}-edison.pdf`;
}

export async function generaPdfChecklistWallboxEdison(
  checklist: ChecklistWallbox
): Promise<Uint8Array> {
  const templateBytes = await readFile(path.join(process.cwd(), TEMPLATE_PATH));
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const [pagina1, pagina2] = pdfDoc.getPages();

  // ── Pagina 1 ──
  scriviCampo(pagina1, font, checklist.ragione_sociale, CAMPI_PAGINA1.ditta);
  scriviCampo(pagina1, font, checklist.codice_ditta, CAMPI_PAGINA1.codiceDitta);
  scriviCampo(pagina1, font, checklist.nome, CAMPI_PAGINA1.nome);
  scriviCampo(pagina1, font, checklist.cognome, CAMPI_PAGINA1.cognome);
  scriviCampo(pagina1, font, checklist.via, CAMPI_PAGINA1.via);
  scriviCampo(pagina1, font, checklist.comune, CAMPI_PAGINA1.comune);
  scriviCampo(pagina1, font, checklist.cap, CAMPI_PAGINA1.cap);
  scriviCampo(pagina1, font, checklist.provincia, CAMPI_PAGINA1.provincia);
  scriviCampo(pagina1, font, checklist.telefono, CAMPI_PAGINA1.telefono);

  if (checklist.posizionamento_tipo) {
    segnaCheckbox(pagina1, true, CHECKBOX_POSIZIONAMENTO[checklist.posizionamento_tipo]);
    if (checklist.posizionamento_tipo === "ALTRO") {
      scriviCampo(pagina1, font, checklist.posizionamento, CAMPI_PAGINA1.posizionamentoAltro);
    }
  }

  segnaCheckbox(pagina1, checklist.modalita_posa === "PARETE", CHECKBOX_PARETE);
  segnaCheckbox(pagina1, checklist.modalita_posa === "TERRA", CHECKBOX_TERRA);

  // "Potenza contatore contrattuale 6 kW" è testo fisso già stampato sul
  // modulo in questa versione: non va sovrascritto.

  DOMANDE_SI_NO.forEach(({ campo, si, no }) => {
    cerchiaRisposta(pagina1, checklist[campo], si, no);
  });

  scriviCampo(pagina1, font, checklist.misura_terra_ohm, CAMPI_PAGINA1.misuraTerraOhm);

  disegnaTestoMultilinea(pagina1, font, checklist.descrizione_percorso_cavi, DESCRIZIONE_CAVI_AREA);
  disegnaTestoMultilinea(pagina1, font, checklist.note, NOTE_AREA);

  // ── Pagina 2: planimetria sintetica ──
  const planimetria = await embedImmagineDataUrl(pdfDoc, checklist.planimetria_data_url);
  if (planimetria) {
    disegnaImmagineContenuta(pagina2, planimetria, PLANIMETRIA_BOX);
  }

  // ── Pagina 2: materiali ──
  const quantitaPerDescrizione = new Map(
    checklist.materiali.map((m) => [m.descrizione, m.quantita])
  );
  CHECKLIST_WALLBOX_CATALOGO_MATERIALI.forEach((materiale, index) => {
    const quantita = quantitaPerDescrizione.get(materiale.descrizione);
    if (!quantita) return;
    pagina2.drawText(normalizzaTestoPdf(quantita), {
      x: QUANTITA_X,
      y: RIGHE_MATERIALI_Y[index] + 2,
      size: 9,
      font,
      color: BLACK,
    });
  });

  if (checklist.cavo_altro_descrizione) {
    disegnaTestoMultilinea(pagina2, font, checklist.cavo_altro_descrizione, {
      x: CAVO_ALTRO.descrizioneX,
      maxWidth: CAVO_ALTRO.maxWidth,
      baselines: [CAVO_ALTRO.y + 2],
    });
  }
  if (checklist.cavo_altro_quantita) {
    pagina2.drawText(normalizzaTestoPdf(checklist.cavo_altro_quantita), {
      x: CAVO_ALTRO.quantitaX,
      y: CAVO_ALTRO.y + 2,
      size: 9,
      font,
      color: BLACK,
    });
  }

  if (checklist.interruttore_altro_descrizione) {
    disegnaTestoMultilinea(pagina2, font, checklist.interruttore_altro_descrizione, {
      x: INTERRUTTORE_ALTRO.descrizioneX,
      maxWidth: INTERRUTTORE_ALTRO.maxWidth,
      baselines: [INTERRUTTORE_ALTRO.y + 2],
    });
  }
  if (checklist.interruttore_altro_quantita) {
    pagina2.drawText(normalizzaTestoPdf(checklist.interruttore_altro_quantita), {
      x: INTERRUTTORE_ALTRO.quantitaX,
      y: INTERRUTTORE_ALTRO.y + 2,
      size: 9,
      font,
      color: BLACK,
    });
  }

  checklist.materiali_altro.slice(0, MATERIALI_ALTRO_RIGHE_Y.length).forEach((materiale, index) => {
    const y = MATERIALI_ALTRO_RIGHE_Y[index];
    if (materiale.descrizione) {
      disegnaTestoMultilinea(pagina2, font, materiale.descrizione, {
        x: MATERIALI_ALTRO_DESCRIZIONE_X,
        maxWidth: MATERIALI_ALTRO_MAX_WIDTH,
        baselines: [y + 2],
      });
    }
    if (materiale.quantita) {
      pagina2.drawText(normalizzaTestoPdf(materiale.quantita), {
        x: QUANTITA_X,
        y: y + 2,
        size: 9,
        font,
        color: BLACK,
      });
    }
  });

  scriviCampo(
    pagina2,
    font,
    [checklist.luogo, checklist.data_sopralluogo ? formattaData(checklist.data_sopralluogo) : ""]
      .filter(Boolean)
      .join(" - "),
    LUOGO_DATA
  );

  const firmaTecnico = await embedImmagineDataUrl(pdfDoc, checklist.firma_tecnico_data_url);
  if (firmaTecnico) {
    disegnaImmagineContenuta(pagina2, firmaTecnico, {
      x: FIRMA_TECNICO.x,
      y: FIRMA_TECNICO.y,
      w: FIRMA_TECNICO.maxWidth,
      h: FIRMA_TECNICO.maxHeight,
    });
  }
  if (checklist.firma_tecnico_nome) {
    pagina2.drawText(normalizzaTestoPdf(checklist.firma_tecnico_nome), {
      x: FIRMA_TECNICO_NOME.x,
      y: FIRMA_TECNICO_NOME.y,
      size: FIRMA_TECNICO_NOME.size,
      font,
      color: BLACK,
    });
  }

  pagina2.drawText("Firma cliente", {
    x: FIRMA_CLIENTE_LABEL.x,
    y: FIRMA_CLIENTE_LABEL.y,
    size: FIRMA_CLIENTE_LABEL.size,
    font,
    color: BLACK,
  });
  pagina2.drawLine({
    start: { x: FIRMA_CLIENTE_LINEA.xStart, y: FIRMA_CLIENTE_LINEA.y },
    end: { x: FIRMA_CLIENTE_LINEA.xEnd, y: FIRMA_CLIENTE_LINEA.y },
    thickness: 0.75,
    color: BLACK,
  });

  const firmaCliente = await embedImmagineDataUrl(pdfDoc, checklist.firma_cliente_data_url);
  if (firmaCliente) {
    disegnaImmagineContenuta(pagina2, firmaCliente, {
      x: FIRMA_CLIENTE.x,
      y: FIRMA_CLIENTE.y,
      w: FIRMA_CLIENTE.maxWidth,
      h: FIRMA_CLIENTE.maxHeight,
    });
  }
  if (checklist.firma_cliente_nome) {
    pagina2.drawText(normalizzaTestoPdf(checklist.firma_cliente_nome), {
      x: FIRMA_CLIENTE_NOME.x,
      y: FIRMA_CLIENTE_NOME.y,
      size: FIRMA_CLIENTE_NOME.size,
      font,
      color: BLACK,
    });
  }

  return pdfDoc.save();
}

function formattaData(data: string) {
  return new Intl.DateTimeFormat("it-IT").format(new Date(`${data}T00:00:00`));
}
