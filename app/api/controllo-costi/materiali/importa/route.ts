import { inflateRawSync } from "zlib";
import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { LAVORAZIONI_IMPORT, LAVORAZIONI_LIMITI } from "@/constants/lavorazioni";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const TOOL_NAME = "registra_materiali";
const MAX_TESTO_CHARS = 15000;

const ERRORI = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  FILE_OBBLIGATORIO: "File obbligatorio",
  FILE_NON_SUPPORTATO: "Formato file non supportato",
  FILE_TROPPO_GRANDE: "File troppo grande (max 10 MB)",
  FILE_NON_VALIDO: "File non leggibile",
  NESSUN_MATERIALE: "Nessun materiale trovato nel documento",
  AI_NON_CONFIGURATA: "Servizio AI non configurato",
  AI_ESTRAZIONE_FALLITA: "Estrazione AI fallita",
  AI_RISPOSTA_NON_VALIDA: "Risposta AI non valida",
  ERRORE_GENERICO: "Errore importazione materiali",
} as const;

const NO_STORE = { "Cache-Control": "no-store" } as const;

// ─── Helpers risposta ─────────────────────────────────────────────────────────

function jsonErr(msg: string, status: number) {
  return Response.json({ errore: msg }, { status, headers: NO_STORE });
}

function jsonOk(payload: unknown) {
  return Response.json(payload, { status: HTTP_STATUS.OK, headers: NO_STORE });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function estraiToken(request: Request): string | null {
  const auth = request.headers.get(API_HEADERS.AUTHORIZATION);
  if (!auth?.startsWith(API_HEADERS.BEARER_PREFIX)) return null;
  return auth.slice(API_HEADERS.BEARER_PREFIX.length).trim() || null;
}

type AuthOk = { ok: true };
type AuthFail = { ok: false; risposta: Response };

async function verificaAdmin(request: Request): Promise<AuthOk | AuthFail> {
  const token = estraiToken(request);
  if (!token)
    return { ok: false, risposta: jsonErr(ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED) };
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);
  if (error || !user?.email)
    return { ok: false, risposta: jsonErr(ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED) };
  const adminOk = await isAdmin(user.email, supabaseAdmin);
  if (!adminOk)
    return { ok: false, risposta: jsonErr(ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN) };
  return { ok: true };
}

// ─── Validazione file ─────────────────────────────────────────────────────────

function isFileEntry(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    typeof (value as File).name === "string" &&
    typeof (value as File).size === "number"
  );
}

function getEstensione(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? `.${parts.pop()}` : "";
}

function isEstensioneAccettata(filename: string): boolean {
  return (LAVORAZIONI_IMPORT.ESTENSIONI_ACCETTATE as readonly string[]).includes(
    getEstensione(filename)
  );
}

// ─── Parsing CSV ──────────────────────────────────────────────────────────────

function contaSeparatore(riga: string, sep: string): number {
  let n = 0;
  let inVirgolette = false;
  for (let i = 0; i < riga.length; i += 1) {
    const c = riga[i];
    const next = riga[i + 1];
    if (c === '"' && next === '"') { i += 1; continue; }
    if (c === '"') { inVirgolette = !inVirgolette; continue; }
    if (!inVirgolette && c === sep) n += 1;
  }
  return n;
}

function getSeparatoreCsv(righe: string[]): string {
  const valide = righe.filter((r) => r.trim()).slice(0, 20);
  const punti = valide.reduce((t, r) => t + contaSeparatore(r, ";"), 0);
  const virgole = valide.reduce((t, r) => t + contaSeparatore(r, ","), 0);
  return punti >= virgole ? ";" : ",";
}

function splitRigaCsv(riga: string, sep: string): string[] {
  const celle: string[] = [];
  let cella = "";
  let inVirgolette = false;
  for (let i = 0; i < riga.length; i += 1) {
    const c = riga[i];
    const next = riga[i + 1];
    if (c === '"' && next === '"') { cella += '"'; i += 1; continue; }
    if (c === '"') { inVirgolette = !inVirgolette; continue; }
    if (!inVirgolette && c === sep) { celle.push(cella.trim()); cella = ""; continue; }
    cella += c;
  }
  celle.push(cella.trim());
  return celle;
}

function csvToTesto(csv: string): string {
  const righe = csv
    .replace(/^﻿/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  const sep = getSeparatoreCsv(righe);
  return righe
    .map((r) =>
      splitRigaCsv(r, sep)
        .map((c) => c.replace(/\s+/g, " ").trim())
        .filter(Boolean)
    )
    .filter((celle) => celle.length > 0)
    .map((celle, i) => `${i + 1}. ${celle.join(" | ")}`)
    .join("\n");
}

// ─── Parsing XLSX ─────────────────────────────────────────────────────────────

const ZIP_LOCAL_SIGNATURE = 0x04034b50;

function estraiEntriesZip(buf: Buffer): Map<string, string> {
  const entries = new Map<string, string>();
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== ZIP_LOCAL_SIGNATURE) break;
    const compression = buf.readUInt16LE(offset + 8);
    const compressedSize = buf.readUInt32LE(offset + 18);
    const filenameLen = buf.readUInt16LE(offset + 26);
    const extraLen = buf.readUInt16LE(offset + 28);
    const filename = buf.toString("utf8", offset + 30, offset + 30 + filenameLen);
    const dataStart = offset + 30 + filenameLen + extraLen;
    const compressed = buf.subarray(dataStart, dataStart + compressedSize);
    try {
      const data = compression === 8 ? inflateRawSync(compressed) : compressed;
      entries.set(filename, data.toString("utf8"));
    } catch {
      // entry non leggibile, ignorata
    }
    offset = dataStart + compressedSize;
  }
  return entries;
}

function unescapeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function estraiStringheCondivise(xml: string): string[] {
  const strings: string[] = [];
  const siRe = /<si>([\s\S]*?)<\/si>/g;
  let siM;
  while ((siM = siRe.exec(xml)) !== null) {
    const tRe = /<t[^>]*>([^<]*)<\/t>/g;
    const parts: string[] = [];
    let tM;
    while ((tM = tRe.exec(siM[1])) !== null) parts.push(unescapeXml(tM[1]));
    strings.push(parts.join(""));
  }
  return strings;
}

function getValoreCella(inner: string, tipo: string, ss: string[]): string {
  if (tipo === "s") {
    const m = /<v>(\d+)<\/v>/.exec(inner);
    return m ? (ss[parseInt(m[1], 10)] ?? "") : "";
  }
  if (tipo === "inlineStr") {
    const m = /<t[^>]*>([^<]*)<\/t>/.exec(inner);
    return m ? unescapeXml(m[1]) : "";
  }
  const m = /<v>([^<]*)<\/v>/.exec(inner);
  return m ? m[1] : "";
}

function xlsxToTesto(buf: Buffer): string {
  const entries = estraiEntriesZip(buf);
  const ss = estraiStringheCondivise(entries.get("xl/sharedStrings.xml") ?? "");
  const sheetXml = entries.get("xl/worksheets/sheet1.xml") ?? "";
  if (!sheetXml) return "";
  const righe: string[] = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let rowM;
  while ((rowM = rowRe.exec(sheetXml)) !== null) {
    const celle: string[] = [];
    const cellRe = /<c r="[^"]*"([^>]*)>([\s\S]*?)<\/c>/g;
    let cellM;
    while ((cellM = cellRe.exec(rowM[1])) !== null) {
      const tipoM = /\bt="([^"]*)"/.exec(cellM[1]);
      celle.push(getValoreCella(cellM[2], tipoM ? tipoM[1] : "", ss));
    }
    const riga = celle.filter(Boolean).join(" | ");
    if (riga) righe.push(riga);
  }
  return righe.map((r, i) => `${i + 1}. ${r}`).join("\n");
}

// ─── Tipi e normalizzazione ───────────────────────────────────────────────────

export type MaterialeEstrato = {
  descrizione: string;
  fornitore?: string | null;
  quantita?: number | null;
  prezzo_unitario: number;
  numero_ddt?: string | null;
  data_acquisto?: string | null;
};

function isMateriale(v: unknown): v is MaterialeEstrato {
  return (
    isRecord(v) &&
    typeof v.descrizione === "string" &&
    v.descrizione.trim() !== "" &&
    typeof v.prezzo_unitario === "number" &&
    v.prezzo_unitario >= 0
  );
}

function normalizzaMateriali(raw: unknown[]): MaterialeEstrato[] {
  return raw.filter(isMateriale).map((m) => ({
    descrizione: m.descrizione.trim().replace(/\s+/g, " "),
    fornitore:
      typeof m.fornitore === "string" && m.fornitore.trim() ? m.fornitore.trim() : null,
    quantita: typeof m.quantita === "number" && m.quantita > 0 ? m.quantita : 1,
    prezzo_unitario: m.prezzo_unitario,
    numero_ddt:
      typeof m.numero_ddt === "string" && m.numero_ddt.trim() ? m.numero_ddt.trim() : null,
    data_acquisto:
      typeof m.data_acquisto === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.data_acquisto)
        ? m.data_acquisto
        : null,
  }));
}

// ─── Claude API ───────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
    };

async function estraiMaterialiConClaude(
  content: ContentBlock[]
): Promise<MaterialeEstrato[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error(ERRORI.AI_NON_CONFIGURATA);

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system:
        "Estrai le voci di materiale da questo DDT o fattura di acquisto. " +
        "Per ogni voce estrai descrizione, fornitore, quantità, prezzo unitario, numero DDT e data. " +
        "Scarta totali, subtotali, sconti e voci non materiali.",
      messages: [
        {
          role: "user",
          content: [
            ...content,
            {
              type: "text",
              text: "Estrai tutti i materiali usando lo strumento registra_materiali.",
            },
          ],
        },
      ],
      tools: [
        {
          name: TOOL_NAME,
          description: "Registra le voci di materiale estratte dal DDT o fattura",
          input_schema: {
            type: "object",
            properties: {
              materiali: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    descrizione: { type: "string" },
                    fornitore: { type: "string" },
                    quantita: { type: "number" },
                    prezzo_unitario: { type: "number" },
                    numero_ddt: { type: "string" },
                    data_acquisto: {
                      type: "string",
                      description: "Formato YYYY-MM-DD",
                    },
                  },
                  required: ["descrizione", "prezzo_unitario"],
                },
              },
            },
            required: ["materiali"],
          },
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    }),
  });

  if (!response.ok) {
    const dettaglio = await response.text();
    console.error("Errore Claude import materiali", dettaglio);
    throw new Error(ERRORI.AI_ESTRAZIONE_FALLITA);
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload) || !Array.isArray(payload.content))
    throw new Error(ERRORI.AI_RISPOSTA_NON_VALIDA);

  for (const block of payload.content) {
    if (
      isRecord(block) &&
      block.type === "tool_use" &&
      block.name === TOOL_NAME &&
      isRecord(block.input) &&
      Array.isArray(block.input.materiali)
    ) {
      return normalizzaMateriali(block.input.materiali);
    }
  }

  throw new Error(ERRORI.AI_RISPOSTA_NON_VALIDA);
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  try {
    const auth = await verificaAdmin(request);
    if (!auth.ok) return auth.risposta;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonErr(ERRORI.FILE_OBBLIGATORIO, HTTP_STATUS.BAD_REQUEST);
    }

    const file = formData.get("file");
    if (!isFileEntry(file))
      return jsonErr(ERRORI.FILE_OBBLIGATORIO, HTTP_STATUS.BAD_REQUEST);

    if (!isEstensioneAccettata(file.name))
      return jsonErr(ERRORI.FILE_NON_SUPPORTATO, HTTP_STATUS.BAD_REQUEST);

    if (file.size > LAVORAZIONI_LIMITI.IMPORT_MAX_FILE_BYTES)
      return jsonErr(ERRORI.FILE_TROPPO_GRANDE, HTTP_STATUS.BAD_REQUEST);

    const ext = getEstensione(file.name);
    let content: ContentBlock[];

    if (ext === ".pdf") {
      const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
      content = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64 },
        },
      ];
    } else if (ext === ".xlsx" || ext === ".xls") {
      const testo = xlsxToTesto(Buffer.from(await file.arrayBuffer()));
      if (!testo.trim())
        return jsonErr(ERRORI.FILE_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
      content = [{ type: "text", text: `Foglio Excel:\n${testo.slice(0, MAX_TESTO_CHARS)}` }];
    } else {
      const testo = csvToTesto(await file.text());
      if (!testo.trim())
        return jsonErr(ERRORI.FILE_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
      content = [{ type: "text", text: `Documento:\n${testo.slice(0, MAX_TESTO_CHARS)}` }];
    }

    const materiali = await estraiMaterialiConClaude(content);

    if (materiali.length === 0)
      return jsonErr(ERRORI.NESSUN_MATERIALE, HTTP_STATUS.BAD_REQUEST);

    return jsonOk(materiali);
  } catch (error: unknown) {
    console.error("Errore import materiali da DDT", error);
    const msg = error instanceof Error ? error.message : ERRORI.ERRORE_GENERICO;
    return jsonErr(msg, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
