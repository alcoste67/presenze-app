// Genera il PDF nel formato ESATTO del modulo cartaceo Edison Energia:
// carica il file originale come template e ci scrive sopra solo i dati
// compilati, nei punti esatti dei campi vuoti. Il layout, il logo e i
// colori restano quelli del documento originale — non vanno mai
// ridisegnati o alterati (vincolo esplicito del cliente).
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

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

async function embedFirma(pdfDoc: PDFDocument, dataUrl: string | null) {
  if (!dataUrl) return null;
  const match = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  return match[1].toLowerCase() === "png" ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes);
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

// Coordinate rilevate dal PDF originale (estrazione testo/rettangoli,
// coordinate PDF standard: origine in basso a sinistra).
const CAMPI_PAGINA1 = {
  ragioneSociale: { x: 128, y: 697.9, size: 9 },
  piva: { x: 371, y: 697.9, size: 9 },
  nome: { x: 80, y: 672.7, size: 9 },
  cognome: { x: 384, y: 672.7, size: 9 },
  via: { x: 71, y: 647.38, size: 9 },
  comune: { x: 334, y: 647.38, size: 9 },
  cap: { x: 483, y: 647.38, size: 9 },
  provincia: { x: 74, y: 622.06, size: 9 },
  telefono: { x: 148, y: 622.06, size: 9 },
  posizionamento: { x: 353, y: 585.82, size: 7 },
  potenzaContatore: { x: 208, y: 537.43, size: 9 },
} as const;

const CHECKBOX_PARETE = { x: 130.1, y: 560.18, w: 8.1, h: 7.5 };
const CHECKBOX_TERRA = { x: 199.35, y: 561.13, w: 8.1, h: 7.5 };

const DOMANDE_SI_NO: {
  campo: keyof Pick<
    ChecklistWallbox,
    | "quadro_conforme"
    | "impianto_a_norma"
    | "dichiarazione_conformita"
    | "autorizzazioni_necessarie"
    | "messa_a_terra"
    | "installazione_possibile"
    | "opere_adeguamento_necessarie"
  >;
  si: { x: number; y: number; w: number; h: number };
  no: { x: number; y: number; w: number; h: number };
}[] = [
  { campo: "quadro_conforme", si: { x: 477.34, y: 499.99, w: 10, h: 10.56 }, no: { x: 501.7, y: 499.99, w: 15.88, h: 10.56 } },
  { campo: "impianto_a_norma", si: { x: 477.58, y: 475.03, w: 10, h: 10.56 }, no: { x: 501.94, y: 475.03, w: 15.88, h: 10.56 } },
  { campo: "dichiarazione_conformita", si: { x: 476.38, y: 449.95, w: 10, h: 10.56 }, no: { x: 500.74, y: 449.95, w: 15.88, h: 10.56 } },
  { campo: "autorizzazioni_necessarie", si: { x: 476.14, y: 424.87, w: 10, h: 10.56 }, no: { x: 500.61, y: 424.87, w: 15.88, h: 10.56 } },
  { campo: "messa_a_terra", si: { x: 476.5, y: 399.79, w: 10, h: 10.56 }, no: { x: 500.86, y: 399.79, w: 15.88, h: 10.56 } },
  { campo: "installazione_possibile", si: { x: 475.54, y: 374.81, w: 10, h: 10.56 }, no: { x: 500.01, y: 374.81, w: 15.88, h: 10.56 } },
  { campo: "opere_adeguamento_necessarie", si: { x: 475.3, y: 337.61, w: 10, h: 10.56 }, no: { x: 499.77, y: 337.61, w: 15.88, h: 10.56 } },
];

// Righe della tabella "Eventuali Note" (8 righe, ~21pt ciascuna).
const NOTE_TABELLA = { top: 271.85, bottom: 96.86, x: 63, maxWidth: 465 };

// Y di ciascuna riga materiale in pagina 2, nello stesso ordine del
// catalogo (CHECKLIST_WALLBOX_CATALOGO_MATERIALI, 19 voci).
const RIGHE_MATERIALI_Y = [
  690.7, 675.82, 660.82, 645.94, 631.06, 616.66, 601.3, 586.42, 571.39,
  556.51, 541.63, 526.75, 512.35, 497.47, 481.99, 467.11, 452.23, 311.69,
  296.81,
];
const QUANTITA_X = 495;

const LUOGO_DATA = { x: 145, y: 192.14, size: 9 };
const FIRMA_TECNICO = { x: 117, y: 150, maxWidth: 150, maxHeight: 26 };
const FIRMA_TECNICO_NOME = { x: 117, y: 132, size: 7 };

// "Firma cliente" non esiste sul modulo originale (solo "Firma tecnico"):
// aggiunta minima richiesta esplicitamente, sulla stessa riga, a destra,
// senza toccare il resto del layout.
const FIRMA_CLIENTE_LABEL = { x: 320, y: 141.62, size: 11 };
const FIRMA_CLIENTE_LINEA = { xStart: 386, xEnd: 533, y: 139.5 };
const FIRMA_CLIENTE = { x: 386, y: 150, maxWidth: 145, maxHeight: 26 };
const FIRMA_CLIENTE_NOME = { x: 386, y: 132, size: 7 };

export function getNomeFileChecklistWallboxEdison(checklist: ChecklistWallbox) {
  const cliente =
    checklist.ragione_sociale.trim() ||
    `${checklist.nome} ${checklist.cognome}`.trim() ||
    "cliente";
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
  scriviCampo(pagina1, font, checklist.ragione_sociale, CAMPI_PAGINA1.ragioneSociale);
  scriviCampo(pagina1, font, checklist.piva, CAMPI_PAGINA1.piva);
  scriviCampo(pagina1, font, checklist.nome, CAMPI_PAGINA1.nome);
  scriviCampo(pagina1, font, checklist.cognome, CAMPI_PAGINA1.cognome);
  scriviCampo(pagina1, font, checklist.via, CAMPI_PAGINA1.via);
  scriviCampo(pagina1, font, checklist.comune, CAMPI_PAGINA1.comune);
  scriviCampo(pagina1, font, checklist.cap, CAMPI_PAGINA1.cap);
  scriviCampo(pagina1, font, checklist.provincia, CAMPI_PAGINA1.provincia);
  scriviCampo(pagina1, font, checklist.telefono, CAMPI_PAGINA1.telefono);
  scriviCampo(pagina1, font, checklist.posizionamento, CAMPI_PAGINA1.posizionamento);
  scriviCampo(pagina1, font, checklist.potenza_contatore_kw, CAMPI_PAGINA1.potenzaContatore);

  segnaCheckbox(pagina1, checklist.modalita_posa === "PARETE", CHECKBOX_PARETE);
  segnaCheckbox(pagina1, checklist.modalita_posa === "TERRA", CHECKBOX_TERRA);

  DOMANDE_SI_NO.forEach(({ campo, si, no }) => {
    cerchiaRisposta(pagina1, checklist[campo], si, no);
  });

  if (checklist.note) {
    const righe = wrapText(checklist.note, font, 9, NOTE_TABELLA.maxWidth);
    let y = NOTE_TABELLA.top - 15;
    righe.forEach((riga) => {
      if (y < NOTE_TABELLA.bottom) return;
      pagina1.drawText(riga, { x: NOTE_TABELLA.x, y, size: 9, font, color: BLACK });
      y -= 13;
    });
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

  scriviCampo(
    pagina2,
    font,
    [checklist.luogo, checklist.data_sopralluogo ? formattaData(checklist.data_sopralluogo) : ""]
      .filter(Boolean)
      .join(" - "),
    LUOGO_DATA
  );

  const firmaTecnico = await embedFirma(pdfDoc, checklist.firma_tecnico_data_url);
  if (firmaTecnico) {
    const scale = Math.min(
      FIRMA_TECNICO.maxWidth / firmaTecnico.width,
      FIRMA_TECNICO.maxHeight / firmaTecnico.height
    );
    pagina2.drawImage(firmaTecnico, {
      x: FIRMA_TECNICO.x,
      y: FIRMA_TECNICO.y,
      width: firmaTecnico.width * scale,
      height: firmaTecnico.height * scale,
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

  const firmaCliente = await embedFirma(pdfDoc, checklist.firma_cliente_data_url);
  if (firmaCliente) {
    const scale = Math.min(
      FIRMA_CLIENTE.maxWidth / firmaCliente.width,
      FIRMA_CLIENTE.maxHeight / firmaCliente.height
    );
    pagina2.drawImage(firmaCliente, {
      x: FIRMA_CLIENTE.x,
      y: FIRMA_CLIENTE.y,
      width: firmaCliente.width * scale,
      height: firmaCliente.height * scale,
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
