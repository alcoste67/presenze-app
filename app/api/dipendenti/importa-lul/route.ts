import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { LAVORAZIONI_LIMITI } from "@/constants/lavorazioni";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";

export const dynamic = "force-dynamic";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const TOOL_NAME = "registra_dipendenti_lul";

const ERRORI = {
  TOKEN_MANCANTE: "Token autenticazione mancante",
  TOKEN_NON_VALIDO: "Token autenticazione non valido",
  ACCESSO_NEGATO: "Accesso non autorizzato",
  FILE_OBBLIGATORIO: "File obbligatorio",
  FILE_NON_SUPPORTATO: "Solo PDF accettati",
  FILE_TROPPO_GRANDE: "File troppo grande (max 10 MB)",
  NESSUN_DIPENDENTE: "Nessun dipendente trovato nella LUL",
  AI_NON_CONFIGURATA: "Servizio AI non configurato",
  AI_ESTRAZIONE_FALLITA: "Estrazione AI fallita",
  AI_RISPOSTA_NON_VALIDA: "Risposta AI non valida",
  ERRORE_GENERICO: "Errore importazione LUL",
} as const;

const NO_STORE = { "Cache-Control": "no-store" } as const;

function jsonErr(msg: string, status: number) {
  return Response.json({ errore: msg }, { status, headers: NO_STORE });
}

function jsonOk(payload: unknown) {
  return Response.json(payload, { status: HTTP_STATUS.OK, headers: NO_STORE });
}

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
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user?.email)
    return { ok: false, risposta: jsonErr(ERRORI.TOKEN_NON_VALIDO, HTTP_STATUS.UNAUTHORIZED) };
  const adminOk = await isAdmin(user.email, supabaseAdmin);
  if (!adminOk)
    return { ok: false, risposta: jsonErr(ERRORI.ACCESSO_NEGATO, HTTP_STATUS.FORBIDDEN) };
  return { ok: true };
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

// ─── Types ────────────────────────────────────────────────────────────────────

export type DipendenteLulEstrato = {
  nome: string;
  cognome: string;
  ral: number;
  qualifica?: string | null;
  ore_settimanali?: number | null;
};

function isDipendenteLul(v: unknown): v is DipendenteLulEstrato {
  return (
    isRecord(v) &&
    typeof v.nome === "string" &&
    v.nome.trim() !== "" &&
    typeof v.cognome === "string" &&
    v.cognome.trim() !== "" &&
    typeof v.ral === "number" &&
    v.ral > 0
  );
}

function normalizzaDipendentiLul(raw: unknown[]): DipendenteLulEstrato[] {
  return raw.filter(isDipendenteLul).map((d) => ({
    nome: d.nome.trim(),
    cognome: d.cognome.trim(),
    ral: d.ral,
    qualifica:
      typeof d.qualifica === "string" && d.qualifica.trim() ? d.qualifica.trim() : null,
    ore_settimanali:
      typeof d.ore_settimanali === "number" && d.ore_settimanali > 0
        ? d.ore_settimanali
        : null,
  }));
}

// ─── Claude API ───────────────────────────────────────────────────────────────

async function estraiDipendentiConClaude(base64: string): Promise<DipendenteLulEstrato[]> {
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
        "Sei un esperto di paghe italiane. Analizza questa LUL (Lista Unica del Lavoro). " +
        "Per ogni dipendente estrai nome, cognome e RAL annua lorda. " +
        "La RAL annua lorda si trova nella sezione ANNO della busta paga, campo 'IMPONIBILE FISCALE' della riga ANNO (non del mese). " +
        "In alternativa usa il campo 'IMPONIBILE LORDO' annuo o 'TOTALE COMPETENZE' annuo. " +
        "NON usare la retribuzione mensile moltiplicata — usa sempre il totale annuo già calcolato nel documento. " +
        "Ogni dipendente ha il proprio imponibile annuo — non usare lo stesso valore per dipendenti diversi. " +
        "Estrai anche qualifica e ore settimanali se presenti. " +
        "ATTENZIONE: L'imponibile fiscale nella sezione ANNO è il cumulato dall'inizio dell'anno al mese corrente, NON la RAL annua completa. " +
        "Per calcolare la RAL annua: dividi l'imponibile fiscale annuo per il numero di mesi trascorsi e moltiplica per 12. " +
        "Il mese della busta paga è indicato nell'intestazione. " +
        "In alternativa, usa la RETRIBUZIONE MENSILE e moltiplicala per 13 mensilità.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: base64 },
            },
            {
              type: "text",
              text: "Estrai tutti i dipendenti usando lo strumento registra_dipendenti_lul.",
            },
          ],
        },
      ],
      tools: [
        {
          name: TOOL_NAME,
          description: "Registra i dati dei dipendenti estratti dalla LUL",
          input_schema: {
            type: "object",
            properties: {
              dipendenti: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    nome: { type: "string" },
                    cognome: { type: "string" },
                    ral: {
                      type: "number",
                      description: "Retribuzione annua lorda in euro",
                    },
                    qualifica: { type: "string" },
                    ore_settimanali: { type: "number" },
                  },
                  required: ["nome", "cognome", "ral"],
                },
              },
            },
            required: ["dipendenti"],
          },
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    }),
  });

  if (!response.ok) {
    const dettaglio = await response.text();
    console.error("Errore Claude import LUL", dettaglio);
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
      Array.isArray(block.input.dipendenti)
    ) {
      return normalizzaDipendentiLul(block.input.dipendenti);
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

    if (!file.name.toLowerCase().endsWith(".pdf"))
      return jsonErr(ERRORI.FILE_NON_SUPPORTATO, HTTP_STATUS.BAD_REQUEST);

    if (file.size > LAVORAZIONI_LIMITI.IMPORT_MAX_FILE_BYTES)
      return jsonErr(ERRORI.FILE_TROPPO_GRANDE, HTTP_STATUS.BAD_REQUEST);

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const dipendenti = await estraiDipendentiConClaude(base64);

    if (dipendenti.length === 0)
      return jsonErr(ERRORI.NESSUN_DIPENDENTE, HTTP_STATUS.BAD_REQUEST);

    return jsonOk(dipendenti);
  } catch (error: unknown) {
    console.error("Errore import LUL", error);
    const msg = error instanceof Error ? error.message : ERRORI.ERRORE_GENERICO;
    return jsonErr(msg, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
