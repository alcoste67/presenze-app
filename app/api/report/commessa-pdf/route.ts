import type { NextRequest } from "next/server";
import sharp from "sharp";
import {
  PDFDocument,
  type PDFImage,
  type RGB,
  type PDFPage,
  type PDFFont,
  rgb,
  StandardFonts,
} from "pdf-lib";

import { API_HEADERS } from "@/constants/api";
import { COMMESSA_TESTI } from "@/constants/commessa";
import {
  LABEL_STATI_RAPPORTO_INTERVENTO,
  RAPPORTI_INTERVENTO_STATI,
} from "@/constants/rapportiIntervento";
import {
  SAL_STATI,
  SAL_TESTI,
} from "@/constants/sal";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadCantiereBackoffice } from "@/services/cantieri/loadCantiereBackoffice";
import { loadDashboardCommessa } from "@/services/commessa/loadDashboardCommessa";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import { isResponsabile } from "@/services/dipendenti/isResponsabile";
import type { DashboardCommessaData } from "@/services/commessa/loadDashboardCommessa";
import type { CantiereBackoffice } from "@/types/cantieri";
import type { CostoMacchinarioCommessa } from "@/types/costiMacchinari";
import type { MacchinarioPubblico } from "@/types/macchinari";
import type { StatoSalLavorazione } from "@/types/sal";

export const runtime = "nodejs";

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
  danger: rgb(0.745, 0.204, 0.204),
  dangerSoft: rgb(0.973, 0.91, 0.91),
  gray: rgb(0.435, 0.416, 0.38),
  graySoft: rgb(0.969, 0.953, 0.925),
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

function jsonErrore(error: string, status: number) {
  return Response.json(
    { error },
    { status, headers: NO_STORE_HEADERS }
  );
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
    maxWidth?: number;
  }
) {
  page.drawText(normalizzaTestoPdf(text), options);
}

function calcolaRighe(text: string, font: PDFFont, size: number, maxWidth: number): number {
  const words = text.split(" ");
  let righe = 1;
  let lineWidth = 0;

  for (const word of words) {
    const wordWidth = font.widthOfTextAtSize(`${word} `, size);

    if (lineWidth + wordWidth > maxWidth && lineWidth > 0) {
      righe += 1;
      lineWidth = wordWidth;
    } else {
      lineWidth += wordWidth;
    }
  }

  return righe;
}

function drawTextWrapped(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    size: number;
    font: PDFFont;
    color: RGB;
    maxWidth: number;
    lineHeight: number;
  }
): void {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (options.font.widthOfTextAtSize(testLine, options.size) > options.maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) lines.push(currentLine);

  lines.forEach((line, i) => {
    page.drawText(normalizzaTestoPdf(line), {
      x: options.x,
      y: options.y - i * options.lineHeight,
      size: options.size,
      font: options.font,
      color: options.color,
    });
  });
}

function formattaData(value: string) {
  return new Intl.DateTimeFormat("it-IT").format(
    new Date(`${value}T00:00:00`)
  );
}

function formattaDataOra(value: string | null) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formattaOre(minutiTotali: number) {
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;

  return `${ore}h ${minuti}m`;
}

function formattaOreDecimali(valore: number) {
  return `${new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 2,
  }).format(valore)} h`;
}

function getNomeFile(cantiere: CantiereBackoffice) {
  const cantiereFile = cantiere.nome
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return `${COMMESSA_TESTI.TITOLO.toLowerCase()}_${cantiereFile || "cantiere"}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

function getStatoSalLabel(stato: StatoSalLavorazione) {
  if (stato === SAL_STATI.COMPLETATA) {
    return COMMESSA_TESTI.COMPLETATA;
  }

  if (stato === SAL_STATI.IN_CORSO) {
    return COMMESSA_TESTI.IN_CORSO;
  }

  return COMMESSA_TESTI.NON_INIZIATA;
}

function getStatoColoriSal(stato: StatoSalLavorazione) {
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

function getStatoColoriRapporto(stato: string) {
  if (stato === RAPPORTI_INTERVENTO_STATI.FIRMATO) {
    return {
      background: COLORS.successSoft,
      text: COLORS.success,
    };
  }

  if (stato === RAPPORTI_INTERVENTO_STATI.BOZZA) {
    return {
      background: COLORS.graySoft,
      text: COLORS.gray,
    };
  }

  return {
    background: COLORS.dangerSoft,
    text: COLORS.danger,
  };
}

async function embedImmagineDataUrl(
  pdfDoc: PDFDocument,
  dataUrl: string
): Promise<PDFImage | null> {
  const match =
    /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(
      dataUrl
    );

  if (!match) {
    return null;
  }

  const bytes = Buffer.from(match[2], "base64");
  const MAX_PX = 1200;
  const sharpInstance = sharp(bytes);
  const metadata = await sharpInstance.metadata();
  const needsResize =
    (metadata.width ?? 0) > MAX_PX ||
    (metadata.height ?? 0) > MAX_PX;

  const compressed = await sharpInstance
    .resize(
      needsResize
        ? {
            width: MAX_PX,
            height: MAX_PX,
            fit: "inside",
            withoutEnlargement: true,
          }
        : undefined
    )
    .jpeg({ quality: 75 })
    .toBuffer();

  return pdfDoc.embedJpg(compressed);
}

function drawFooter(
  page: PDFPage,
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
  },
  pageNumber: number,
  totalPages: number
) {
  page.drawLine({
    start: { x: MARGIN_X, y: 44 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: 44 },
    thickness: 1,
    color: COLORS.border,
  });

  drawText(
    page,
    `${COMMESSA_TESTI.TITOLO} - ${pageNumber}/${totalPages}`,
    {
      x: MARGIN_X,
      y: FOOTER_Y,
      size: 8,
      font: fonts.regular,
      color: COLORS.muted,
    }
  );
}

function drawHeader({
  page,
  fonts,
  cantiere,
  dataGenerazione,
}: {
  page: PDFPage;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
  };
  cantiere: CantiereBackoffice;
  dataGenerazione: Date;
}) {
  drawText(page, COMMESSA_TESTI.TITOLO, {
    x: MARGIN_X,
    y: TOP_Y,
    size: 24,
    font: fonts.bold,
    color: COLORS.text,
  });

  drawText(page, COMMESSA_TESTI.CARD_DESCRIZIONE, {
    x: MARGIN_X,
    y: TOP_Y - 22,
    size: 11,
    font: fonts.regular,
    color: COLORS.muted,
  });

  drawText(page, cantiere.nome, {
    x: MARGIN_X,
    y: TOP_Y - 50,
    size: 16,
    font: fonts.bold,
    color: COLORS.orange,
  });

  drawText(page, cantiere.indirizzo, {
    x: MARGIN_X,
    y: TOP_Y - 67,
    size: 10,
    font: fonts.regular,
    color: COLORS.muted,
  });

  drawText(page, `Generato il ${formattaDataOra(dataGenerazione.toISOString())}`, {
    x: PAGE_WIDTH - MARGIN_X - 170,
    y: TOP_Y - 15,
    size: 9,
    font: fonts.regular,
    color: COLORS.muted,
    maxWidth: 170,
  });
}

function drawStatCard({
  page,
  fonts,
  x,
  y,
  width,
  height,
  label,
  value,
  tone = "neutral",
}: {
  page: PDFPage;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
  };
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: string;
  tone?: "neutral" | "orange" | "green";
}) {
  const accent =
    tone === "green"
      ? COLORS.success
      : tone === "orange"
        ? COLORS.orange
        : COLORS.border;

  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: COLORS.border,
    borderWidth: 1,
    color: COLORS.white,
  });

  page.drawRectangle({
    x: x + 12,
    y: y + height - 12,
    width: 46,
    height: 4,
    color: accent,
  });

  drawText(page, label, {
    x: x + 12,
    y: y + height - 28,
    size: 8,
    font: fonts.bold,
    color: COLORS.muted,
  });

  drawText(page, value, {
    x: x + 12,
    y: y + 12,
    size: 16,
    font: fonts.bold,
    color: COLORS.text,
  });
}

function drawSectionTitle({
  page,
  fonts,
  title,
  subtitle,
  y,
}: {
  page: PDFPage;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
  };
  title: string;
  subtitle?: string;
  y: number;
}) {
  drawText(page, title, {
    x: MARGIN_X,
    y,
    size: 14,
    font: fonts.bold,
    color: COLORS.text,
  });

  if (subtitle) {
    drawText(page, subtitle, {
      x: MARGIN_X,
      y: y - 14,
      size: 9,
      font: fonts.regular,
      color: COLORS.muted,
    });
  }
}

function drawProgressBar({
  page,
  value,
  x,
  y,
  width,
  height,
}: {
  page: PDFPage;
  value: number;
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
    color: COLORS.graySoft,
  });

  page.drawRectangle({
    x,
    y,
    width: width * (Math.max(0, Math.min(100, value)) / 100),
    height,
    color: COLORS.orange,
  });
}

function getNomeMacchinario(
  costo:
    | CostoMacchinarioCommessa
    | {
        macchinario_id: string | null;
        tipo_macchinario: string;
      },
  macchinari: Map<string, MacchinarioPubblico>
) {
  if (!costo.macchinario_id) {
    return costo.tipo_macchinario;
  }

  return (
    macchinari.get(costo.macchinario_id)?.nome ||
    costo.tipo_macchinario
  );
}

function drawSummaryPage({
  page,
  fonts,
  dashboard,
  cantiere,
}: {
  page: PDFPage;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
  };
  dashboard: DashboardCommessaData;
  cantiere: CantiereBackoffice;
}) {
  const lavorazioni = dashboard.sal.lavorazioni;
  const summary = [
    {
      label: COMMESSA_TESTI.AVANZAMENTO_PERCENTUALE,
      value: `${dashboard.sal.avanzamentoTotale}%`,
      tone: "orange" as const,
    },
    {
      label: COMMESSA_TESTI.ORE_UOMO_TOTALI,
      value: formattaOre(dashboard.sal.oreUomoTotaliMinuti),
    },
    {
      label: COMMESSA_TESTI.LAVORAZIONI_COMPLETATE,
      value: String(
        lavorazioni.filter(
          (lavorazione) =>
            lavorazione.stato === SAL_STATI.COMPLETATA
        ).length
      ),
      tone: "green" as const,
    },
    {
      label: COMMESSA_TESTI.LAVORAZIONI_IN_CORSO,
      value: String(
        lavorazioni.filter(
          (lavorazione) =>
            lavorazione.stato === SAL_STATI.IN_CORSO
        ).length
      ),
      tone: "orange" as const,
    },
    {
      label: COMMESSA_TESTI.NUMERO_RAPPORTI,
      value: String(dashboard.numeroRapportiIntervento),
    },
    {
      label: COMMESSA_TESTI.NUMERO_FOTO_SAL,
      value: String(dashboard.numeroFotoSal),
    },
    {
      label: COMMESSA_TESTI.ORE_MACCHINARI,
      value: formattaOreDecimali(
        dashboard.costiMacchinari.reduce(
          (somma, costo) => somma + costo.ore_utilizzo,
          0
        )
      ),
      tone: "orange" as const,
    },
  ];

  const cardWidth =
    (PAGE_WIDTH - MARGIN_X * 2 - 24) / 3;
  const cardHeight = 56;
  let currentY = 650;

  summary.forEach((card, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x =
      MARGIN_X + column * (cardWidth + 12);
    const y = currentY - row * (cardHeight + 10);

    drawStatCard({
      page,
      fonts,
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      label: card.label,
      value: card.value,
      tone: card.tone || "neutral",
    });
  });

  currentY =
    currentY - 2 * (cardHeight + 10) - 16;

  drawSectionTitle({
    page,
    fonts,
    title: COMMESSA_TESTI.STATO_AVANZAMENTO,
    subtitle: cantiere.nome,
    y: currentY,
  });

  currentY -= 26;

  page.drawRectangle({
    x: MARGIN_X,
    y: currentY,
    width: PAGE_WIDTH - MARGIN_X * 2,
    height: 82,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  drawText(page, `${dashboard.sal.avanzamentoTotale}%`, {
    x: MARGIN_X + 16,
    y: currentY + 54,
    size: 20,
    font: fonts.bold,
    color: COLORS.orange,
  });

  drawProgressBar({
    page,
    value: dashboard.sal.avanzamentoTotale,
    x: MARGIN_X + 16,
    y: currentY + 34,
    width: PAGE_WIDTH - MARGIN_X * 2 - 32,
    height: 10,
  });

  drawText(page, COMMESSA_TESTI.AVANZAMENTO_PERCENTUALE, {
    x: MARGIN_X + 16,
    y: currentY + 22,
    size: 9,
    font: fonts.regular,
    color: COLORS.muted,
  });

  currentY -= 110;

  drawSectionTitle({
    page,
    fonts,
    title: COMMESSA_TESTI.LAVORAZIONI_PRINCIPALI,
    subtitle: COMMESSA_TESTI.STATO_AVANZAMENTO,
    y: currentY,
  });

  currentY -= 20;

  lavorazioni.slice(0, 5).forEach((lavorazione, index) => {
    const boxY = currentY - index * 46;
    const colori = getStatoColoriSal(lavorazione.stato);

    page.drawRectangle({
      x: MARGIN_X,
      y: boxY,
      width: PAGE_WIDTH - MARGIN_X * 2,
      height: 38,
      color: COLORS.white,
      borderColor: COLORS.border,
      borderWidth: 1,
    });

    drawText(page, lavorazione.nome, {
      x: MARGIN_X + 12,
      y: boxY + 22,
      size: 11,
      font: fonts.bold,
      color: COLORS.text,
      maxWidth: 280,
    });

    drawText(
      page,
      `${SAL_TESTI.PERCENTUALE}: ${lavorazione.percentuale_completamento}% · ${SAL_TESTI.ORE_UOMO}: ${formattaOre(lavorazione.oreUomoMinuti)}`,
      {
        x: MARGIN_X + 12,
        y: boxY + 8,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted,
        maxWidth: 300,
      }
    );

    page.drawRectangle({
      x: PAGE_WIDTH - MARGIN_X - 96,
      y: boxY + 10,
      width: 84,
      height: 18,
      color: colori.background,
    });

    drawText(page, getStatoSalLabel(lavorazione.stato), {
      x: PAGE_WIDTH - MARGIN_X - 88,
      y: boxY + 16,
      size: 7,
      font: fonts.bold,
      color: colori.text,
    });
  });
}

function drawOreUomoPage({
  page,
  fonts,
  dashboard,
}: {
  page: PDFPage;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
  };
  dashboard: DashboardCommessaData;
}) {
  drawSectionTitle({
    page,
    fonts,
    title: COMMESSA_TESTI.ORE_UOMO,
    subtitle: COMMESSA_TESTI.LAVORAZIONI_PRINCIPALI,
    y: 752,
  });

  const lavorazioniOre = dashboard.sal.lavorazioni
    .filter((lavorazione) => lavorazione.oreUomoMinuti > 0)
    .sort((a, b) => b.oreUomoMinuti - a.oreUomoMinuti)
    .slice(0, 5);

  if (lavorazioniOre.length === 0) {
    page.drawRectangle({
      x: MARGIN_X,
      y: 660,
      width: PAGE_WIDTH - MARGIN_X * 2,
      height: 48,
      color: COLORS.surface,
      borderColor: COLORS.border,
      borderWidth: 1,
    });

    drawText(page, COMMESSA_TESTI.NESSUN_DATO, {
      x: MARGIN_X + 16,
      y: 687,
      size: 10,
      font: fonts.regular,
      color: COLORS.muted,
    });
  } else {
    lavorazioniOre.forEach((lavorazione, index) => {
      const boxY = 690 - index * 46;
      page.drawRectangle({
        x: MARGIN_X,
        y: boxY,
        width: PAGE_WIDTH - MARGIN_X * 2,
        height: 38,
        color: COLORS.white,
        borderColor: COLORS.border,
        borderWidth: 1,
      });

      drawText(page, lavorazione.nome, {
        x: MARGIN_X + 12,
        y: boxY + 22,
        size: 11,
        font: fonts.bold,
        color: COLORS.text,
        maxWidth: 280,
      });

      drawText(page, `${formattaOre(lavorazione.oreUomoMinuti)} · ${lavorazione.percentuale_completamento}%`, {
        x: PAGE_WIDTH - MARGIN_X - 120,
        y: boxY + 16,
        size: 9,
        font: fonts.bold,
        color: COLORS.orange,
        maxWidth: 110,
      });
    });
  }

  drawSectionTitle({
    page,
    fonts,
    title: COMMESSA_TESTI.MACCHINARI_UTILIZZATI,
    subtitle: COMMESSA_TESTI.ORE_MACCHINARI,
    y: 460,
  });

  const macchinariById = new Map(
    dashboard.macchinariPubblici.map((macchinario) => [
      macchinario.id,
      macchinario,
    ])
  );

  const macchinari = dashboard.costiMacchinari.slice(0, 5);

  if (macchinari.length === 0) {
    page.drawRectangle({
      x: MARGIN_X,
      y: 368,
      width: PAGE_WIDTH - MARGIN_X * 2,
      height: 48,
      color: COLORS.surface,
      borderColor: COLORS.border,
      borderWidth: 1,
    });

    drawText(page, COMMESSA_TESTI.NESSUN_DATO, {
      x: MARGIN_X + 16,
      y: 395,
      size: 10,
      font: fonts.regular,
      color: COLORS.muted,
    });
  } else {
    macchinari.forEach((costo, index) => {
      const boxY = 410 - index * 46;
      page.drawRectangle({
        x: MARGIN_X,
        y: boxY,
        width: PAGE_WIDTH - MARGIN_X * 2,
        height: 38,
        color: COLORS.white,
        borderColor: COLORS.border,
        borderWidth: 1,
      });

      drawText(page, getNomeMacchinario(costo, macchinariById), {
        x: MARGIN_X + 12,
        y: boxY + 22,
        size: 11,
        font: fonts.bold,
        color: COLORS.text,
        maxWidth: 260,
      });

      drawText(page, `${formattaData(costo.data_utilizzo)} · ${formattaOreDecimali(costo.ore_utilizzo)}`, {
        x: MARGIN_X + 12,
        y: boxY + 8,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted,
        maxWidth: 250,
      });

      drawText(page, costo.note || costo.descrizione || "-", {
        x: PAGE_WIDTH - MARGIN_X - 140,
        y: boxY + 16,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted,
        maxWidth: 130,
      });
    });
  }
}

function drawRapportiPage({
  page,
  fonts,
  dashboard,
  mostraCosti,
}: {
  page: PDFPage;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
  };
  dashboard: DashboardCommessaData;
  mostraCosti: boolean;
}) {
  drawSectionTitle({
    page,
    fonts,
    title: COMMESSA_TESTI.RAPPORTI_RECENTI,
    subtitle: COMMESSA_TESTI.NUMERO_RAPPORTI,
    y: 752,
  });

  const rapporti = dashboard.rapportiRecenti.slice(0, 5);

  if (rapporti.length === 0) {
    page.drawRectangle({
      x: MARGIN_X,
      y: 660,
      width: PAGE_WIDTH - MARGIN_X * 2,
      height: 48,
      color: COLORS.surface,
      borderColor: COLORS.border,
      borderWidth: 1,
    });

    drawText(page, COMMESSA_TESTI.NESSUN_RAPPORTO, {
      x: MARGIN_X + 16,
      y: 687,
      size: 10,
      font: fonts.regular,
      color: COLORS.muted,
    });
  } else {
    rapporti.forEach((rapporto, index) => {
      const boxY = 700 - index * 58;
      const colori = getStatoColoriRapporto(rapporto.stato);

      page.drawRectangle({
        x: MARGIN_X,
        y: boxY,
        width: PAGE_WIDTH - MARGIN_X * 2,
        height: 50,
        color: COLORS.white,
        borderColor: COLORS.border,
        borderWidth: 1,
      });

      drawText(page, rapporto.cliente_committente, {
        x: MARGIN_X + 12,
        y: boxY + 29,
        size: 11,
        font: fonts.bold,
        color: COLORS.text,
        maxWidth: 250,
      });

      drawText(page, `${formattaData(rapporto.data_intervento)} · ${rapporto.responsabile_nome}`, {
        x: MARGIN_X + 12,
        y: boxY + 15,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted,
        maxWidth: 260,
      });

      drawText(page, LABEL_STATI_RAPPORTO_INTERVENTO[rapporto.stato], {
        x: PAGE_WIDTH - MARGIN_X - 90,
        y: boxY + 30,
        size: 7,
        font: fonts.bold,
        color: colori.text,
      });

      const oreLabel = mostraCosti
        ? `${COMMESSA_TESTI.ORE_UOMO_TOTALI}: ${formattaOre(rapporto.ore_uomo_reali_minuti)}`
        : `${COMMESSA_TESTI.ORE_UOMO}: ${formattaOre(rapporto.ore_uomo_reali_minuti)}`;

      drawText(page, oreLabel, {
        x: PAGE_WIDTH - MARGIN_X - 150,
        y: boxY + 15,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted,
        maxWidth: 140,
      });
    });
  }
}

async function generaPdf({
  cantiere,
  dashboard,
  mostraCosti,
}: {
  cantiere: CantiereBackoffice;
  dashboard: DashboardCommessaData;
  mostraCosti: boolean;
}) {
  const pdfDoc = await PDFDocument.create();
  const fonts = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };

  const dataGenerazione = new Date();
  const startY = TOP_Y - 80;
  const limitePagina = FOOTER_Y + 60;
  const contentWidth = PAGE_WIDTH - MARGIN_X * 2;

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawHeader({ page, fonts, cantiere, dataGenerazione });

  let currentY = startY;

  const checkNewPage = (y: number, spazioNecessario: number) => {
    if (y - spazioNecessario >= limitePagina) {
      return y;
    }

    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader({ page, fonts, cantiere, dataGenerazione });
    return startY;
  };

  const drawSectionHeader = ({
    title,
    subtitle,
    spazioNecessario = 0,
  }: {
    title: string;
    subtitle?: string;
    spazioNecessario?: number;
  }) => {
    currentY = checkNewPage(currentY, 34 + spazioNecessario);
    drawSectionTitle({ page, fonts, title, subtitle, y: currentY });
    currentY -= 34;
  };

  const drawEmptyState = (message: string) => {
    const height = 48;
    currentY = checkNewPage(currentY, height + 14);
    const y = currentY - height;

    page.drawRectangle({
      x: MARGIN_X,
      y,
      width: contentWidth,
      height,
      color: COLORS.surface,
      borderColor: COLORS.border,
      borderWidth: 1,
    });

    drawText(page, message, {
      x: MARGIN_X + 16,
      y: y + 27,
      size: 10,
      font: fonts.regular,
      color: COLORS.muted,
    });

    currentY = y - 14;
  };

  const lavorazioni = dashboard.sal.lavorazioni;
  const summary: Array<{
    label: string;
    value: string;
    tone?: "neutral" | "orange" | "green";
  }> = [
    {
      label: COMMESSA_TESTI.AVANZAMENTO_PERCENTUALE,
      value: `${dashboard.sal.avanzamentoTotale}%`,
      tone: "orange",
    },
    {
      label: COMMESSA_TESTI.ORE_UOMO_TOTALI,
      value: formattaOre(dashboard.sal.oreUomoTotaliMinuti),
    },
    {
      label: COMMESSA_TESTI.LAVORAZIONI_COMPLETATE,
      value: String(
        lavorazioni.filter(
          (lavorazione) => lavorazione.stato === SAL_STATI.COMPLETATA
        ).length
      ),
      tone: "green",
    },
    {
      label: COMMESSA_TESTI.LAVORAZIONI_IN_CORSO,
      value: String(
        lavorazioni.filter(
          (lavorazione) => lavorazione.stato === SAL_STATI.IN_CORSO
        ).length
      ),
      tone: "orange",
    },
    {
      label: COMMESSA_TESTI.NUMERO_RAPPORTI,
      value: String(dashboard.numeroRapportiIntervento),
    },
    {
      label: COMMESSA_TESTI.NUMERO_FOTO_SAL,
      value: String(dashboard.numeroFotoSal),
    },
    {
      label: COMMESSA_TESTI.ORE_MACCHINARI,
      value: formattaOreDecimali(
        dashboard.costiMacchinari.reduce(
          (somma, costo) => somma + costo.ore_utilizzo,
          0
        )
      ),
      tone: "orange",
    },
  ];

  const cardWidth = (contentWidth - 24) / 3;
  const cardHeight = 56;

  for (let index = 0; index < summary.length; index += 3) {
    const row = summary.slice(index, index + 3);
    currentY = checkNewPage(currentY, cardHeight + 12);
    const y = currentY - cardHeight;

    row.forEach((card, column) => {
      drawStatCard({
        page,
        fonts,
        x: MARGIN_X + column * (cardWidth + 12),
        y,
        width: cardWidth,
        height: cardHeight,
        label: card.label,
        value: card.value,
        tone: card.tone || "neutral",
      });
    });

    currentY = y - 12;
  }

  currentY -= 8;

  drawSectionHeader({
    title: COMMESSA_TESTI.STATO_AVANZAMENTO,
    subtitle: cantiere.nome,
    spazioNecessario: 82,
  });

  currentY = checkNewPage(currentY, 82 + 24);
  const progressY = currentY - 82;

  page.drawRectangle({
    x: MARGIN_X,
    y: progressY,
    width: contentWidth,
    height: 82,
    color: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
  });

  drawText(page, `${dashboard.sal.avanzamentoTotale}%`, {
    x: MARGIN_X + 16,
    y: progressY + 54,
    size: 20,
    font: fonts.bold,
    color: COLORS.orange,
  });

  drawProgressBar({
    page,
    value: dashboard.sal.avanzamentoTotale,
    x: MARGIN_X + 16,
    y: progressY + 34,
    width: contentWidth - 32,
    height: 10,
  });

  drawText(page, COMMESSA_TESTI.AVANZAMENTO_PERCENTUALE, {
    x: MARGIN_X + 16,
    y: progressY + 22,
    size: 9,
    font: fonts.regular,
    color: COLORS.muted,
  });

  currentY = progressY - 28;

  drawSectionHeader({
    title: COMMESSA_TESTI.LAVORAZIONI_PRINCIPALI,
    subtitle: COMMESSA_TESTI.STATO_AVANZAMENTO,
    spazioNecessario: lavorazioni.length > 0 ? 46 : 0,
  });

  lavorazioni.slice(0, 5).forEach((lavorazione) => {
    const lineHeight = 11;
    const righe = calcolaRighe(lavorazione.nome, fonts.bold, 11, 280);
    const boxH = Math.max(38, 16 + righe * lineHeight + 16);

    currentY = checkNewPage(currentY, boxH + 8);
    const boxY = currentY - boxH;
    const colori = getStatoColoriSal(lavorazione.stato);

    page.drawRectangle({
      x: MARGIN_X,
      y: boxY,
      width: contentWidth,
      height: boxH,
      color: COLORS.white,
      borderColor: COLORS.border,
      borderWidth: 1,
    });

    drawTextWrapped(page, lavorazione.nome, {
      x: MARGIN_X + 12,
      y: boxY + boxH - 16,
      size: 11,
      font: fonts.bold,
      color: COLORS.text,
      maxWidth: 280,
      lineHeight: 13,
    });

    drawText(
      page,
      `${SAL_TESTI.PERCENTUALE}: ${lavorazione.percentuale_completamento}% · ${SAL_TESTI.ORE_UOMO}: ${formattaOre(lavorazione.oreUomoMinuti)}`,
      {
        x: MARGIN_X + 12,
        y: boxY + 14,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted,
        maxWidth: 300,
      }
    );

    page.drawRectangle({
      x: PAGE_WIDTH - MARGIN_X - 96,
      y: boxY + boxH / 2 - 9,
      width: 84,
      height: 18,
      color: colori.background,
    });

    drawText(page, getStatoSalLabel(lavorazione.stato), {
      x: PAGE_WIDTH - MARGIN_X - 88,
      y: boxY + boxH / 2 - 5,
      size: 7,
      font: fonts.bold,
      color: colori.text,
    });

    currentY = boxY - 14;
  });

  currentY -= 12;

  drawSectionHeader({
    title: COMMESSA_TESTI.ORE_UOMO,
    subtitle: COMMESSA_TESTI.LAVORAZIONI_PRINCIPALI,
    spazioNecessario: 48,
  });

  const lavorazioniOre = dashboard.sal.lavorazioni
    .filter((lavorazione) => lavorazione.oreUomoMinuti > 0)
    .sort((a, b) => b.oreUomoMinuti - a.oreUomoMinuti)
    .slice(0, 5);

  if (lavorazioniOre.length === 0) {
    drawEmptyState(COMMESSA_TESTI.NESSUN_DATO);
  } else {
    lavorazioniOre.forEach((lavorazione) => {
      currentY = checkNewPage(currentY, 46);
      const boxY = currentY - 38;

      page.drawRectangle({
        x: MARGIN_X,
        y: boxY,
        width: contentWidth,
        height: 38,
        color: COLORS.white,
        borderColor: COLORS.border,
        borderWidth: 1,
      });

      drawText(page, lavorazione.nome, {
        x: MARGIN_X + 12,
        y: boxY + 22,
        size: 11,
        font: fonts.bold,
        color: COLORS.text,
        maxWidth: 280,
      });

      drawText(
        page,
        `${formattaOre(lavorazione.oreUomoMinuti)} · ${lavorazione.percentuale_completamento}%`,
        {
          x: PAGE_WIDTH - MARGIN_X - 120,
          y: boxY + 16,
          size: 9,
          font: fonts.bold,
          color: COLORS.orange,
          maxWidth: 110,
        }
      );

      currentY = boxY - 8;
    });
  }

  currentY -= 12;

  drawSectionHeader({
    title: COMMESSA_TESTI.MACCHINARI_UTILIZZATI,
    subtitle: COMMESSA_TESTI.ORE_MACCHINARI,
    spazioNecessario: 48,
  });

  const macchinariById = new Map(
    dashboard.macchinariPubblici.map((macchinario) => [
      macchinario.id,
      macchinario,
    ])
  );
  const macchinari = dashboard.costiMacchinari.slice(0, 5);

  if (macchinari.length === 0) {
    drawEmptyState(COMMESSA_TESTI.NESSUN_DATO);
  } else {
    macchinari.forEach((costo) => {
      currentY = checkNewPage(currentY, 46);
      const boxY = currentY - 38;

      page.drawRectangle({
        x: MARGIN_X,
        y: boxY,
        width: contentWidth,
        height: 38,
        color: COLORS.white,
        borderColor: COLORS.border,
        borderWidth: 1,
      });

      drawText(page, getNomeMacchinario(costo, macchinariById), {
        x: MARGIN_X + 12,
        y: boxY + 22,
        size: 11,
        font: fonts.bold,
        color: COLORS.text,
        maxWidth: 260,
      });

      drawText(
        page,
        `${formattaData(costo.data_utilizzo)} · ${formattaOreDecimali(costo.ore_utilizzo)}`,
        {
          x: MARGIN_X + 12,
          y: boxY + 8,
          size: 8,
          font: fonts.regular,
          color: COLORS.muted,
          maxWidth: 250,
        }
      );

      drawText(page, costo.note || costo.descrizione || "-", {
        x: PAGE_WIDTH - MARGIN_X - 140,
        y: boxY + 16,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted,
        maxWidth: 130,
      });

      currentY = boxY - 8;
    });
  }

  currentY -= 12;

  drawSectionHeader({
    title: COMMESSA_TESTI.RAPPORTI_RECENTI,
    subtitle: COMMESSA_TESTI.NUMERO_RAPPORTI,
    spazioNecessario: 58,
  });

  const rapporti = dashboard.rapportiRecenti.slice(0, 5);

  if (rapporti.length === 0) {
    drawEmptyState(COMMESSA_TESTI.NESSUN_RAPPORTO);
  } else {
    rapporti.forEach((rapporto) => {
      currentY = checkNewPage(currentY, 58);
      const boxY = currentY - 50;
      const colori = getStatoColoriRapporto(rapporto.stato);

      page.drawRectangle({
        x: MARGIN_X,
        y: boxY,
        width: contentWidth,
        height: 50,
        color: COLORS.white,
        borderColor: COLORS.border,
        borderWidth: 1,
      });

      drawText(page, rapporto.cliente_committente, {
        x: MARGIN_X + 12,
        y: boxY + 29,
        size: 11,
        font: fonts.bold,
        color: COLORS.text,
        maxWidth: 250,
      });

      drawText(
        page,
        `${formattaData(rapporto.data_intervento)} · ${rapporto.responsabile_nome}`,
        {
          x: MARGIN_X + 12,
          y: boxY + 15,
          size: 8,
          font: fonts.regular,
          color: COLORS.muted,
          maxWidth: 260,
        }
      );

      drawText(page, LABEL_STATI_RAPPORTO_INTERVENTO[rapporto.stato], {
        x: PAGE_WIDTH - MARGIN_X - 90,
        y: boxY + 30,
        size: 7,
        font: fonts.bold,
        color: colori.text,
      });

      const oreLabel = mostraCosti
        ? `${COMMESSA_TESTI.ORE_UOMO_TOTALI}: ${formattaOre(rapporto.ore_uomo_reali_minuti)}`
        : `${COMMESSA_TESTI.ORE_UOMO}: ${formattaOre(rapporto.ore_uomo_reali_minuti)}`;

      drawText(page, oreLabel, {
        x: PAGE_WIDTH - MARGIN_X - 150,
        y: boxY + 15,
        size: 8,
        font: fonts.regular,
        color: COLORS.muted,
        maxWidth: 140,
      });

      currentY = boxY - 8;
    });
  }

  currentY -= 12;

  drawSectionHeader({
    title: COMMESSA_TESTI.FOTO_RECENTI,
    subtitle: COMMESSA_TESTI.NUMERO_FOTO_SAL,
    spazioNecessario: 48,
  });

  const foto = dashboard.fotoRecenti.slice(0, 4);

  if (foto.length === 0) {
    drawEmptyState(COMMESSA_TESTI.NESSUNA_FOTO);
  } else {
    const totFoto = foto.length;
    const fotoWidth =
      totFoto === 1 ? contentWidth : (contentWidth - 16) / 2;
    const fotoHeight = totFoto === 1 ? 320 : 220;
    const fotoGap = 16;
    const cardHeightFoto = fotoHeight + 40;

    const fotoPdf = await Promise.all(
      foto.map(async (item) => ({
        image: await embedImmagineDataUrl(pdfDoc, item.immagine_data_url),
        descrizione: item.descrizione || COMMESSA_TESTI.FOTO_RECENTI,
        data: item.data_riferimento,
      }))
    );

    for (let index = 0; index < fotoPdf.length; ) {
      const itemsInRow =
        totFoto === 1 ? 1 : Math.min(2, fotoPdf.length - index);

      currentY = checkNewPage(currentY, cardHeightFoto + 14);
      const y = currentY - cardHeightFoto;

      for (let column = 0; column < itemsInRow; column += 1) {
        const fotoItem = fotoPdf[index + column];
        const x = MARGIN_X + column * (fotoWidth + fotoGap);

        page.drawRectangle({
          x,
          y,
          width: fotoWidth,
          height: cardHeightFoto,
          color: COLORS.white,
          borderColor: COLORS.border,
          borderWidth: 1,
        });

        if (fotoItem.image) {
          const ratio = fotoItem.image.width / fotoItem.image.height;
          let imageWidth = fotoWidth - 16;
          let imageHeight = fotoHeight;

          if (imageWidth / imageHeight > ratio) {
            imageWidth = imageHeight * ratio;
          } else {
            imageHeight = imageWidth / ratio;
          }

          page.drawImage(fotoItem.image, {
            x: x + (fotoWidth - imageWidth) / 2,
            y: y + 24 + (fotoHeight - imageHeight) / 2,
            width: imageWidth,
            height: imageHeight,
          });
        }

        drawText(page, fotoItem.descrizione, {
          x: x + 10,
          y: y + 14,
          size: 8,
          font: fonts.bold,
          color: COLORS.text,
          maxWidth: fotoWidth - 20,
        });

        drawText(page, formattaData(fotoItem.data), {
          x: x + fotoWidth - 70,
          y: y + 14,
          size: 7,
          font: fonts.regular,
          color: COLORS.muted,
          maxWidth: 60,
        });
      }

      currentY = y - 14;
      index += itemsInRow;
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((pdfPage, index) => {
    drawFooter(pdfPage, fonts, index + 1, pages.length);
  });

  return pdfDoc.save();
}

export async function GET(request: NextRequest) {
  const cantiereId =
    request.nextUrl.searchParams.get(
      "cantiereId"
    ) || "";

  try {
    if (!cantiereId) {
      return jsonErrore(
        COMMESSA_TESTI.ERRORI.CANTIERE_OBBLIGATORIO,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const accessToken = estraiBearerToken(request);

    if (!accessToken) {
      return jsonErrore(
        COMMESSA_TESTI.ERRORI.TOKEN_MANCANTE,
        HTTP_STATUS.UNAUTHORIZED
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(
        COMMESSA_TESTI.ERRORI.TOKEN_NON_VALIDO,
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
        COMMESSA_TESTI.ERRORI.ACCESSO_NEGATO,
        HTTP_STATUS.FORBIDDEN
      );
    }

    const [cantiere, dashboard] = await Promise.all([
      loadCantiereBackoffice(cantiereId, supabaseAdmin),
      loadDashboardCommessa({
        cantiereId,
        includeCosti: utenteAdmin,
        supabaseClient: supabaseAdmin,
      }),
    ]);

    if (!cantiere) {
      return jsonErrore(
        COMMESSA_TESTI.ERRORI.CANTIERE_NON_TROVATO,
        HTTP_STATUS.NOT_FOUND
      );
    }

    const pdfBytes = await generaPdf({
      cantiere,
      dashboard,
      mostraCosti: utenteAdmin,
    });
    const fileName = getNomeFile(cantiere);

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    console.error("Errore generazione PDF commessa", {
      cantiereId,
      message:
        error instanceof Error
          ? error.message
          : String(error),
      stack:
        error instanceof Error
          ? error.stack
          : undefined,
      error,
    });

    return jsonErrore(
      COMMESSA_TESTI.ERRORI.PDF_GENERICO,
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}
