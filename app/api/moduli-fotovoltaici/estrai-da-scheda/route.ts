import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import {
  MODULI_FOTOVOLTAICI_LIMITI,
  MODULI_FOTOVOLTAICI_TESTI,
} from "@/constants/moduliFotovoltaici";
import { estraiBearerToken } from "@/lib/auth";
import { isAziendaAutorizzataFotovoltaico } from "@/lib/fotovoltaicoAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";
import type { ModuloFotovoltaicoImportPreview } from "@/types/moduliFotovoltaici";

export const runtime = "nodejs";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const TOOL_NAME = "registra_modulo_fotovoltaico";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE_HEADERS });
}

function jsonOk(payload: unknown) {
  return Response.json(payload, { status: HTTP_STATUS.OK, headers: NO_STORE_HEADERS });
}

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

function isPdf(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}

async function estraiModuloConClaude(base64Pdf: string): Promise<ModuloFotovoltaicoImportPreview> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error(MODULI_FOTOVOLTAICI_TESTI.ERRORI.AI_NON_CONFIGURATA);

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system:
        "Sei un assistente specializzato nella lettura di schede tecniche di moduli " +
        "fotovoltaici. Estrai marca, modello e caratteristiche fisiche/elettriche del " +
        "modulo. Le dimensioni vanno sempre convertite in millimetri. Se un dato non è " +
        "presente nel documento, omettilo.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64Pdf },
            },
            {
              type: "text",
              text: "Estrai i dati del modulo fotovoltaico usando lo strumento registra_modulo_fotovoltaico.",
            },
          ],
        },
      ],
      tools: [
        {
          name: TOOL_NAME,
          description: "Registra i dati del modulo fotovoltaico estratti dalla scheda tecnica",
          input_schema: {
            type: "object",
            properties: {
              marca: { type: "string", description: "Marca/produttore del modulo" },
              modello: { type: "string", description: "Modello/codice del modulo" },
              potenza_wp: { type: "number", description: "Potenza nominale in Wp" },
              lunghezza_mm: { type: "number", description: "Lunghezza del modulo in millimetri" },
              larghezza_mm: { type: "number", description: "Larghezza del modulo in millimetri" },
              spessore_mm: { type: "number", description: "Spessore del modulo in millimetri, se presente" },
              peso_kg: { type: "number", description: "Peso del modulo in kg, se presente" },
            },
          },
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    }),
  });

  if (!response.ok) {
    const dettaglio = await response.text();
    console.error("Errore Claude import modulo fotovoltaico", dettaglio);

    if (/credit balance is too low/i.test(dettaglio)) {
      throw new Error(MODULI_FOTOVOLTAICI_TESTI.ERRORI.AI_CREDITO_ESAURITO);
    }

    throw new Error(MODULI_FOTOVOLTAICI_TESTI.ERRORI.AI_ESTRAZIONE_FALLITA);
  }

  const payload: unknown = await response.json();

  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    throw new Error(MODULI_FOTOVOLTAICI_TESTI.ERRORI.AI_RISPOSTA_NON_VALIDA);
  }

  for (const block of payload.content) {
    if (
      isRecord(block) &&
      block.type === "tool_use" &&
      block.name === TOOL_NAME &&
      isRecord(block.input)
    ) {
      const input = block.input;
      const preview: ModuloFotovoltaicoImportPreview = {};
      if (typeof input.marca === "string" && input.marca.trim()) preview.marca = input.marca.trim();
      if (typeof input.modello === "string" && input.modello.trim()) preview.modello = input.modello.trim();
      if (typeof input.potenza_wp === "number") preview.potenza_wp = input.potenza_wp;
      if (typeof input.lunghezza_mm === "number") preview.lunghezza_mm = input.lunghezza_mm;
      if (typeof input.larghezza_mm === "number") preview.larghezza_mm = input.larghezza_mm;
      if (typeof input.spessore_mm === "number") preview.spessore_mm = input.spessore_mm;
      if (typeof input.peso_kg === "number") preview.peso_kg = input.peso_kg;
      return preview;
    }
  }

  throw new Error(MODULI_FOTOVOLTAICI_TESTI.ERRORI.AI_RISPOSTA_NON_VALIDA);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const accessToken = estraiBearerToken(request);
    if (!accessToken) {
      return jsonErrore(MODULI_FOTOVOLTAICI_TESTI.ERRORI.TOKEN_MANCANTE, HTTP_STATUS.UNAUTHORIZED);
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore(MODULI_FOTOVOLTAICI_TESTI.ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED);
    }

    const utenteAdmin = await isAdmin(user.email, supabaseAdmin);
    if (!utenteAdmin) {
      return jsonErrore(MODULI_FOTOVOLTAICI_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
    }

    const { data: dipendente } = await supabaseAdmin
      .from("dipendenti")
      .select("azienda_id")
      .eq("auth_user_id", user.id)
      .eq("attivo", true)
      .maybeSingle();

    if (!dipendente || !isAziendaAutorizzataFotovoltaico(dipendente.azienda_id as string)) {
      return jsonErrore(MODULI_FOTOVOLTAICI_TESTI.ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN);
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonErrore(MODULI_FOTOVOLTAICI_TESTI.ERRORI.FILE_PDF_OBBLIGATORIO, HTTP_STATUS.BAD_REQUEST);
    }

    const file = formData.get("file");
    if (!isFileEntry(file)) {
      return jsonErrore(MODULI_FOTOVOLTAICI_TESTI.ERRORI.FILE_PDF_OBBLIGATORIO, HTTP_STATUS.BAD_REQUEST);
    }

    if (!isPdf(file.name)) {
      return jsonErrore(MODULI_FOTOVOLTAICI_TESTI.ERRORI.FILE_NON_SUPPORTATO, HTTP_STATUS.BAD_REQUEST);
    }

    if (file.size > MODULI_FOTOVOLTAICI_LIMITI.IMPORT_MAX_FILE_BYTES) {
      return jsonErrore(MODULI_FOTOVOLTAICI_TESTI.ERRORI.FILE_TROPPO_GRANDE, HTTP_STATUS.BAD_REQUEST);
    }

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const preview = await estraiModuloConClaude(base64);

    return jsonOk(preview);
  } catch (error: unknown) {
    console.error("Errore import modulo fotovoltaico da scheda tecnica", error);
    const msg =
      error instanceof Error
        ? error.message
        : MODULI_FOTOVOLTAICI_TESTI.ERRORI.AI_ESTRAZIONE_FALLITA;
    return jsonErrore(msg, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
