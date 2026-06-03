import { inflateRawSync } from "zlib";
import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import {
  LAVORAZIONI_IMPORT,
  LAVORAZIONI_LIMITI,
  LAVORAZIONI_TESTI,
} from "@/constants/lavorazioni";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import type { LavorazioneImportPreview } from "@/types/lavorazioni";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const TOOL_NAME = "registra_lavorazioni";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

// ─── helpers risposta ─────────────────────────────────────────────────────────

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE_HEADERS });
}

function jsonOk(payload: unknown) {
  return Response.json(payload, {
    status: HTTP_STATUS.OK,
    headers: NO_STORE_HEADERS,
  });
}

// ─── auth ─────────────────────────────────────────────────────────────────────

function estraiAccessToken(request: Request): string | null {
  const authorization = request.headers.get(API_HEADERS.AUTHORIZATION);
  if (!authorization?.startsWith(API_HEADERS.BEARER_PREFIX)) return null;
  const token = authorization.slice(API_HEADERS.BEARER_PREFIX.length).trim();
  return token || null;
}

// ─── validazione file ─────────────────────────────────────────────────────────

function isFileEntry(
  value: FormDataEntryValue | null
): value is File {
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

// ─── parsing CSV ──────────────────────────────────────────────────────────────

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

// ─── parsing XLSX ─────────────────────────────────────────────────────────────

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
    while ((tM = tRe.exec(siM[1])) !== null) {
      parts.push(unescapeXml(tM[1]));
    }
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

// ─── normalizzazione output ───────────────────────────────────────────────────

function normalizzaNome(nome: string): string {
  return nome.trim().replace(/\s+/g, " ");
}

function normalizzaLavorazioniImport(
  raw: LavorazioneImportPreview[]
): LavorazioneImportPreview[] {
  const nomiUsati = new Set<string>();

  return [...raw]
    .sort((a, b) => a.ordine - b.ordine)
    .filter((lav) => {
      const chiave = normalizzaNome(lav.nome).toLowerCase();
      if (!chiave || nomiUsati.has(chiave)) return false;
      nomiUsati.add(chiave);
      return true;
    })
    .slice(0, LAVORAZIONI_LIMITI.IMPORT_MAX_LAVORAZIONI)
    .map((lav, i) => ({
      ...lav,
      nome: normalizzaNome(lav.nome),
      ordine: i + 1,
    }));
}

// ─── Claude API ───────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
    };

async function estraiLavorazioniConClaude(
  content: ContentBlock[]
): Promise<LavorazioneImportPreview[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error(LAVORAZIONI_TESTI.ERRORI.AI_NON_CONFIGURATA);

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 8192,
      system:
        "Sei un assistente specializzato nell'analisi di computi metrici edili. " +
        "Estrai le lavorazioni o fasi operative di cantiere dal documento. " +
        "Per ogni lavorazione inferisci la categoria tra: DEMOLIZIONI, COSTRUZIONI, " +
        "IMPIANTI ELETTRICI, DATI, ANTIFURTO, DOMOTICA, IMPIANTI IDRAULICI, SANITARI, " +
        "SERRAMENTI, TAMPONAMENTI, FINITURE, OPERE ESTERNE, ALTRO. " +
        "Scarta codici identificativi, totali, subtotali, intestazioni e voci non operative.",
      messages: [
        {
          role: "user",
          content: [
            ...content,
            {
              type: "text",
              text: "Estrai tutte le lavorazioni operative usando lo strumento registra_lavorazioni.",
            },
          ],
        },
      ],
      tools: [
        {
          name: TOOL_NAME,
          description: "Registra le lavorazioni estratte dal computo metrico",
          input_schema: {
            type: "object",
            properties: {
              lavorazioni: {
                type: "array",
                maxItems: LAVORAZIONI_LIMITI.IMPORT_MAX_LAVORAZIONI,
                items: {
                  type: "object",
                  properties: {
                    nome: { type: "string" },
                    ordine: { type: "integer" },
                    categoria: { type: "string" },
                    unita_misura: { type: "string" },
                    quantita: { type: "number" },
                    prezzo_unitario: { type: "number" },
                    note: { type: "string" },
                  },
                  required: ["nome", "ordine"],
                },
              },
            },
            required: ["lavorazioni"],
          },
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    }),
  });

  if (!response.ok) {
    console.error("Errore Claude import lavorazioni", await response.text());
    throw new Error(LAVORAZIONI_TESTI.ERRORI.AI_ESTRAZIONE_FALLITA);
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    throw new Error(LAVORAZIONI_TESTI.ERRORI.AI_RISPOSTA_NON_VALIDA);
  }

  for (const block of payload.content) {
    if (
      isRecord(block) &&
      block.type === "tool_use" &&
      block.name === TOOL_NAME &&
      isRecord(block.input) &&
      Array.isArray(block.input.lavorazioni)
    ) {
      return normalizzaLavorazioniImport(
        block.input.lavorazioni as LavorazioneImportPreview[]
      );
    }
  }

  throw new Error(LAVORAZIONI_TESTI.ERRORI.AI_RISPOSTA_NON_VALIDA);
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  try {
    const accessToken = estraiAccessToken(request);
    if (!accessToken) {
      return jsonErrore(LAVORAZIONI_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(LAVORAZIONI_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const utenteAdmin = await isAdmin(user.email, supabaseAdmin);
    if (!utenteAdmin) {
      return jsonErrore(LAVORAZIONI_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonErrore(LAVORAZIONI_TESTI.ERRORI.FILE_CSV_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
    }

    const file = formData.get("file");
    if (!isFileEntry(file)) {
      return jsonErrore(LAVORAZIONI_TESTI.ERRORI.FILE_CSV_OBBLIGATORIO, HTTP_STATUS.BAD_REQUEST);
    }

    if (!isEstensioneAccettata(file.name)) {
      return jsonErrore(LAVORAZIONI_TESTI.ERRORI.FILE_NON_SUPPORTATO, HTTP_STATUS.BAD_REQUEST);
    }

    if (file.size > LAVORAZIONI_LIMITI.IMPORT_MAX_FILE_BYTES) {
      return jsonErrore(LAVORAZIONI_TESTI.ERRORI.FILE_TROPPO_GRANDE, HTTP_STATUS.BAD_REQUEST);
    }

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
      if (!testo.trim()) {
        return jsonErrore(LAVORAZIONI_TESTI.ERRORI.FILE_CSV_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
      }
      content = [{ type: "text", text: `Foglio Excel:\n${testo}` }];
    } else {
      const testo = csvToTesto(await file.text());
      if (!testo.trim()) {
        return jsonErrore(LAVORAZIONI_TESTI.ERRORI.FILE_CSV_NON_VALIDO, HTTP_STATUS.BAD_REQUEST);
      }
      content = [{ type: "text", text: `Computo CSV:\n${testo}` }];
    }

    const lavorazioni = await estraiLavorazioniConClaude(content);

    if (lavorazioni.length === 0) {
      return jsonErrore(
        LAVORAZIONI_TESTI.ERRORI.NESSUNA_LAVORAZIONE_IMPORT,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    return jsonOk(lavorazioni);
  } catch (error: unknown) {
    console.error("Errore import lavorazioni da computo", error);
    const msg =
      error instanceof Error
        ? error.message
        : LAVORAZIONI_TESTI.ERRORI.AI_ESTRAZIONE_FALLITA;
    return jsonErrore(msg, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
