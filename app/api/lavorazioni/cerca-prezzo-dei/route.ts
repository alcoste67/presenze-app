import { isRecord } from "@/lib/typeGuards";
import { API_HEADERS, HTTP_STATUS } from "@/constants/api";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdmin } from "@/services/dipendenti/isAdmin";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-sonnet-4-5";
const ANTHROPIC_VERSION = "2023-06-01";
const TOOL_NAME = "registra_prezzo";
const MAX_TOKENS = 1024;
const MAX_ROUNDS = 4;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function jsonErrore(errore: string, status: number) {
  return Response.json({ errore }, { status, headers: NO_STORE_HEADERS });
}

function estraiAccessToken(request: Request): string | null {
  const auth = request.headers.get(API_HEADERS.AUTHORIZATION);
  if (!auth?.startsWith(API_HEADERS.BEARER_PREFIX)) return null;
  return auth.slice(API_HEADERS.BEARER_PREFIX.length).trim() || null;
}

type ClaudeMessage = {
  role: "user" | "assistant";
  content: unknown;
};

async function chiamaClaude(
  apiKey: string,
  messages: ClaudeMessage[]
): Promise<unknown> {
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      [API_HEADERS.CONTENT_TYPE]: API_HEADERS.APPLICATION_JSON,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      tools: [
        { type: "web_search_20250305", name: "web_search" },
        {
          name: TOOL_NAME,
          description: "Registra il prezzo unitario trovato per la lavorazione edile",
          input_schema: {
            type: "object",
            properties: {
              prezzo: {
                type: "number",
                description: "Prezzo unitario in euro (solo il numero)",
              },
              fonte: {
                type: "string",
                description: "Fonte del prezzo, es. 'Prezziario DEI 2024' o 'Media di mercato italiana'",
              },
            },
            required: ["prezzo", "fonte"],
          },
        },
      ],
      tool_choice: { type: "auto" },
      messages,
    }),
  });

  if (!response.ok) {
    const dettaglio = await response.text();
    console.error("Errore Claude cerca-prezzo-dei", dettaglio);
    throw new Error("Ricerca prezzo non riuscita");
  }

  return response.json();
}

function estraiRegistraPrezzo(
  payload: unknown
): { prezzo: number; fonte: string } | null {
  if (!isRecord(payload) || !Array.isArray(payload.content)) return null;

  for (const block of payload.content) {
    if (
      isRecord(block) &&
      block.type === "tool_use" &&
      block.name === TOOL_NAME &&
      isRecord(block.input) &&
      typeof block.input.prezzo === "number" &&
      typeof block.input.fonte === "string"
    ) {
      return {
        prezzo: block.input.prezzo,
        fonte: block.input.fonte,
      };
    }
  }

  return null;
}

async function cercaPrezzoConClaude(
  nome: string,
  categoria: string | undefined,
  unitaMisura: string | undefined
): Promise<{ prezzo: number; fonte: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI non configurata");

  const prompt =
    `Trova il prezzo unitario aggiornato dal Prezziario DEI o prezzi di mercato italiani ` +
    `per la lavorazione: "${nome}"` +
    (categoria ? `, categoria: ${categoria}` : "") +
    (unitaMisura ? `, unità di misura: ${unitaMisura}` : "") +
    `. Usa lo strumento ${TOOL_NAME} per restituire il prezzo numerico in euro e la fonte.`;

  const messages: ClaudeMessage[] = [{ role: "user", content: prompt }];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const payload = await chiamaClaude(apiKey, messages);

    const risultato = estraiRegistraPrezzo(payload);
    if (risultato) return risultato;

    if (!isRecord(payload) || payload.stop_reason === "end_turn") {
      throw new Error("Prezzo non trovato");
    }

    if (!Array.isArray((payload as Record<string, unknown>).content)) {
      throw new Error("Risposta non valida");
    }

    messages.push({
      role: "assistant",
      content: (payload as Record<string, unknown>).content,
    });

    const toolUses = ((payload as Record<string, unknown>).content as unknown[]).filter(
      (b): b is Record<string, unknown> =>
        isRecord(b) && b.type === "tool_use" && b.name !== TOOL_NAME
    );

    if (toolUses.length === 0) throw new Error("Prezzo non trovato");

    messages.push({
      role: "user",
      content: toolUses.map((tu) => ({
        type: "tool_result",
        tool_use_id: tu.id,
        content: "",
      })),
    });
  }

  throw new Error("Prezzo non trovato");
}

export async function POST(request: Request): Promise<Response> {
  try {
    const accessToken = estraiAccessToken(request);
    if (!accessToken) {
      return jsonErrore("Token autenticazione mancante", HTTP_STATUS.UNAUTHORIZED);
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (authError || !user?.email) {
      return jsonErrore("Token non valido", HTTP_STATUS.UNAUTHORIZED);
    }

    const utenteAdmin = await isAdmin(user.email, supabaseAdmin);
    if (!utenteAdmin) {
      return jsonErrore("Accesso non autorizzato", HTTP_STATUS.FORBIDDEN);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonErrore("Body non valido", HTTP_STATUS.BAD_REQUEST);
    }

    if (!isRecord(body) || typeof body.nome !== "string" || !body.nome.trim()) {
      return jsonErrore("Campo 'nome' obbligatorio", HTTP_STATUS.BAD_REQUEST);
    }

    const nome = body.nome.trim();
    const categoria = typeof body.categoria === "string" ? body.categoria : undefined;
    const unitaMisura = typeof body.unita_misura === "string" ? body.unita_misura : undefined;

    const risultato = await cercaPrezzoConClaude(nome, categoria, unitaMisura);

    return Response.json(risultato, {
      status: HTTP_STATUS.OK,
      headers: NO_STORE_HEADERS,
    });
  } catch (error: unknown) {
    console.error("Errore cerca-prezzo-dei", error);
    const msg = error instanceof Error ? error.message : "Prezzo non trovato";
    return jsonErrore(msg, HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}
